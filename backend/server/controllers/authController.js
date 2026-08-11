/**
 * controllers/authController.js
 *
 * WHAT IS A CONTROLLER?
 *  A controller holds the actual business logic for a route.
 *  The route file (routes/auth.js) just maps HTTP verbs + paths to controller functions.
 *  This gives us "separation of concerns":
 *    routes/auth.js      → WHAT endpoint exists and which middleware runs
 *    authController.js   → WHAT actually happens when that endpoint is hit
 *
 * FLOW FOR EACH FUNCTION:
 *  register → validate input → check duplicate → hash password → create user → notify admin → respond
 *  login    → find user → compare password → check status → sign JWT → respond
 *  me       → find user by id from token → respond
 */

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");

const User = require("../models/User");
const Hospital = require("../models/Hospital");
const { sendNewSignupAlert } = require("../services/emailService");
const axios = require("axios");

// ═════════════════════════════════════════════════════════════════════════════
// register — POST /api/auth/register
// Creates a PENDING account. No JWT issued. No role assigned.
// ═════════════════════════════════════════════════════════════════════════════
const register = async (req, res) => {
  try {
    const { name, email, password, org_name, role } = req.body;

    // ── 1. Validate all required fields are present ───────────────────────────────
    if (!name || !email || !password || !org_name || !role) {
      return res.status(400).json({
        success: false,
        message: "All fields required: name, email, password, org_name, role",
      });
    }

    if (!["doctor", "admin", "insurance"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role specified",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters",
      });
    }

    // ── 2. Check email is not already taken ──────────────────────────────────────
    const existing = await User.findOne({
      where: { email: email.toLowerCase().trim() },
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    // ── 3. Hash password (bcrypt, 10 rounds ≈ 100ms — prevents brute force) ──
    const password_hash = await bcrypt.hash(password, 10);

    // ── 4. Create user with pending status, role set from frontend ───────────────
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password_hash,
      org_name: org_name.trim(),
      status: "pending",
      role: role,
      hospital_id: null,
      insurance_org_id: null,
    });

    // ── 5. Notify the appropriate admin (non-blocking) ───────────────────────────
    if (role === "doctor") {
      const matchingHospital = await Hospital.findOne({
        where: { name: { [Op.like]: `%${org_name}%` } },
      });

      if (matchingHospital) {
        const admins = await User.findAll({
          where: {
            hospital_id: matchingHospital.id,
            role: "admin",
            status: "active",
          },
          attributes: ["email", "name"],
        });
        admins.forEach((admin) => {
          sendNewSignupAlert(
            admin.email,
            admin.name,
            user.name,
            user.email,
            matchingHospital.name
          ).catch((err) => console.error("Email error:", err.message));
        });
      }
    } else {
      const superAdmins = await User.findAll({
        where: {
          role: "super_admin",
          status: "active",
        },
        attributes: ["email", "name"],
      });
      superAdmins.forEach((superAdmin) => {
        sendNewSignupAlert(
          superAdmin.email,
          superAdmin.name,
          user.name,
          user.email,
          `New ${role} request for ${org_name}`
        ).catch((err) => console.error("Email error:", err.message));
      });
    }

    // ── 6. Respond — no JWT yet, user must wait for approval ─────────────────────
    return res.status(201).json({
      success: true,
      message:
        "Registration submitted. You will receive an email once your account is approved.",
      userId: user.id,
    });
  } catch (err) {
    console.error("========== REGISTER ERROR ==========");
    console.error("Message:", err.message);
    console.error("Name:", err.name);
    console.error("Stack:", err.stack);
    console.error("====================================");

    return res.status(500).json({
      success: false,
      message: "Registration failed",
      error: err.message
    });
  }
}
// ══════════════════════════════════════════════════════════════════════════════
// login — POST /api/auth/login
// Returns a signed JWT only if user is active.
// ══════════════════════════════════════════════════════════════════════════════
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Email and password are required" });
    }

    // ── 1. Find user WITH password_hash (default scope excludes it) ───────────
    const user = await User.scope("withPassword").findOne({
      where: { email: email.toLowerCase().trim() },
    });

    // ── 2. Generic error — do NOT reveal whether the email exists ────────────
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password" });
    }

    // ── 3. Compare submitted password against the stored bcrypt hash ──────────
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password" });
    }

    // ── 4. Block login for non-active accounts with a clear message ───────────
    if (user.status === "pending") {
      return res.status(403).json({
        success: false,
        status: "pending",
        message:
          "Your account is pending approval. You will receive an email when approved.",
      });
    }
    if (user.status === "rejected") {
      return res.status(403).json({
        success: false,
        status: "rejected",
        message: "Your account was not approved. Contact your administrator.",
      });
    }

    // ── 5. Sign JWT with all scope info baked in ──────────────────────────────
    //    This payload is what verifyToken.js reads on every protected request
    const payload = {
      userId: user.id,
      role: user.role, // super_admin | admin | doctor | insurance
      hospital_id: user.hospital_id, // null for super_admin / insurance
      insurance_org_id: user.insurance_org_id, // null for hospital roles
      status: "active",
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    });

    // ── 6. Return token + safe user object (no password_hash) ─────────────────
    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        hospital_id: user.hospital_id,
        insurance_org_id: user.insurance_org_id,
        org_name: user.org_name,
      },
    });
  } catch (err) {
    console.error("[authController.login]", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Login failed. Try again." });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// me — GET /api/auth/me
// Used by the React frontend to restore session data after page refresh.
// Reads userId from the verified JWT (set by verifyToken middleware).
// ══════════════════════════════════════════════════════════════════════════════
const me = async (req, res) => {
  try {
    // req.user.userId comes from verifyToken middleware
    const user = await User.findByPk(req.user.userId, {
      include: [
        { model: Hospital, as: "hospital", attributes: ["id", "name", "city"] },
      ],
    });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    return res.json({ success: true, user });
  } catch (err) {
    console.error("[authController.me]", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch user info" });
  }
};

const googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ success: false, message: "No Google credential provided." });
    }

    // Verify the access token with Google's UserInfo API
    const googleResponse = await axios.get("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${credential}` }
    });

    if (!googleResponse.data || !googleResponse.data.email) {
      return res.status(400).json({ success: false, message: "Invalid Google credential." });
    }

    const email = googleResponse.data.email;
    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(404).json({ success: false, message: "No registered account found with your Google email." });
    }

    if (user.status !== "active") {
      return res.status(403).json({ success: false, message: "Your account is currently pending or inactive." });
    }

    // Match exactly how normal login issues JWT
    const payload = {
      userId: user.id,
      role: user.role,
      hospital_id: user.hospital_id,
      insurance_org_id: user.insurance_org_id,
      org_name: user.org_name,
      status: "active",
      isAdmin: user.role === 'admin' || user.role === 'super_admin'
    };

    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET || "fallback_secret",
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        hospital_id: user.hospital_id,
        insurance_org_id: user.insurance_org_id,
        org_name: user.org_name,
        status: user.status
      }
    });

  } catch (err) {
    console.error("[authController.googleLogin]", err.message);
    return res.status(500).json({ success: false, message: "Google authentication failed." });
  }
};

module.exports = { register, login, me, googleLogin };
