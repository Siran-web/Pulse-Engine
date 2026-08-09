/**
 * middleware/verifyToken.js — JWT Authentication Middleware
 *
 * MODULE FLOW:
 *  1. Extract Bearer token from Authorization header
 *  2. Verify signature using JWT_SECRET
 *  3. Attach decoded payload to req.user
 *  4. Call next() to proceed to the route handler
 *  5. Return 401/403 if token is missing, invalid, or expired
 *
 * USAGE:
 *  router.get('/patients', verifyToken, attachScope, patientsController.list)
 *
 * JWT PAYLOAD STRUCTURE:
 *  {
 *    userId:           42,
 *    role:             'doctor',         // super_admin | admin | doctor | insurance
 *    hospital_id:      3,                // null for insurance/super_admin
 *    insurance_org_id: null,             // null for hospital roles
 *    status:           'active'
 *  }
 *
 * SECURITY NOTE:
 *  req.user is the ONLY source of truth for scope — routes must NEVER trust
 *  any hospital_id or role sent in the request body or query params.
 */

const jwt = require("jsonwebtoken");

/**
 * verifyToken — validates JWT and attaches decoded payload to req.user
 */
const verifyToken = (req, res, next) => {
  // ── Extract token from "Authorization: Bearer <token>" header ────────────
  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Access denied. No token provided.",
    });
  }

  const token = authHeader.split(" ")[1]; // everything after "Bearer "

  try {
    // ── Verify signature + expiry ─────────────────────────────────────────
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ── Reject tokens belonging to non-active users ───────────────────────
    // This catches users who were rejected AFTER their token was issued
    if (decoded.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Account is not active. Contact your administrator.",
      });
    }

    // ── Attach decoded payload for downstream middleware ───────────────────
    req.user = decoded;
    console.log("=====> user from verifyToken", req.user);

    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Session expired. Please log in again.",
      });
    }
    return res.status(401).json({
      success: false,
      message: "Invalid token.",
    });
  }
};

/**
 * requireRole — factory function that returns a middleware restricting access
 * to specific roles. Must be used AFTER verifyToken.
 *
 * USAGE:
 *  router.post('/hospitals', verifyToken, requireRole('super_admin'), handler)
 *  router.get('/patients',   verifyToken, requireRole('doctor','admin'), handler)
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${allowedRoles.join(" or ")}`,
      });
    }
    next();
  };
};

module.exports = { verifyToken, requireRole };
