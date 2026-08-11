/**
 * controllers/usersController.js
 *
 * Handles the approval queue — the most security-sensitive part of the system.
 *
 * FLOW — listPending:
 *  admin sees pending users whose org_name matches their hospital name
 *  super_admin sees ALL pending users
 *
 * FLOW — approveUser:
 *  1. Validate role chosen by approver
 *  2. Check permission (admin cannot approve another admin)
 *  3. Fetch the pending user
 *  4. Resolve hospital_id or insurance_org_id from org_name
 *  5. Update user → status=active, role=<chosen>, set id fields
 *  6. Send appropriate welcome email
 *
 * FLOW — rejectUser:
 *  1. Set status=rejected
 *  2. Send rejection email
 *
 * FLOW — getStats:
 *  Raw SQL GROUP BY role + status → user count breakdown
 */

const { Op } = require("sequelize");
const sequelize = require("../db/mysql");

const User = require("../models/User");
const Hospital = require("../models/Hospital");
const InsuranceOrg = require("../models/InsuranceOrg");
const {
  sendApprovalEmail,
  sendRejectionEmail,
  sendAdminApprovalEmail,
} = require("../services/emailService");

// ══════════════════════════════════════════════════════════════════════════════
// listPending — GET /api/users/pending
// ══════════════════════════════════════════════════════════════════════════════
const listPending = async (req, res) => {
  try {
    const { scope } = req;
    const where = { status: "pending" };

    // admin: only see doctors for their own hospital (match by org_name)
    if (scope.isAdmin) {
      const hospital = await Hospital.findByPk(scope.hospital_id);
      if (!hospital)
        return res
          .status(404)
          .json({ success: false, message: "Hospital not found" });
      where.org_name = { [Op.like]: `%${hospital.name}%` };
      where.role = "doctor"; // Strict: Hospital admins only see doctor requests!
    } else if (scope.isSuperAdmin) {
      // super_admin: see ALL admin & insurance requests, and ONLY doctor requests
      // for organizations that DO NOT have an active Hospital Admin.
      const existingAdmins = await User.findAll({
        where: {
          role: "admin",
          status: "active",
          hospital_id: { [Op.ne]: null },
        },
        include: [{ model: Hospital, as: "hospital" }],
      });

      const adminOrgNames = existingAdmins
        .filter((admin) => admin.hospital && admin.hospital.name)
        .map((admin) => admin.hospital.name);

      if (adminOrgNames.length > 0) {
        where[Op.or] = [
          { role: "admin" },
          { role: "insurance" },
          {
            role: "doctor",
            org_name: { [Op.notIn]: adminOrgNames },
          },
        ];
      }
    }

    const users = await User.findAll({
      where,
      attributes: ["id", "name", "email", "org_name", "role", "created_at"],
      order: [["created_at", "ASC"]],
    });

    return res.json({ success: true, count: users.length, users });
  } catch (err) {
    console.error("[usersController.listPending]", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch pending users" });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// approveUser — PUT /api/users/:id/approve
// Body: { "role": "doctor" | "admin" | "insurance" }
// ══════════════════════════════════════════════════════════════════════════════
const approveUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const { scope } = req;

    // ── 1. Validate role value ────────────────────────────────────────────────
    if (!["admin", "doctor", "insurance"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "role must be one of: admin, doctor, insurance",
      });
    }

    // ── 2. Permission check — enforce hierarchy ─────────
    if (scope.isAdmin && role !== "doctor") {
      return res.status(403).json({
        success: false,
        message:
          "Hospital Admins can only approve Doctor accounts for their hospital",
      });
    }

    if (scope.isSuperAdmin && role === "doctor") {
      // While Super Admins can theoretically do anything, enforcing that they stick to
      // Hospital Admins and Insurance makes the hierarchy crystal clear.
      // (Optional: You could remove this if you want Super Admin to be able to jump in and approve doctors directly).
    }

    // ── 3. Fetch the pending user ─────────────────────────────────────────────
    const user = await User.findByPk(id);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    if (user.status !== "pending") {
      return res
        .status(400)
        .json({ success: false, message: `User is already ${user.status}` });
    }

    // ── 4. Resolve hospital_id / insurance_org_id ─────────────────────────────
    let hospital_id = null,
      insurance_org_id = null,
      hospitalName = "";

    if (role === "doctor") {
      if (scope.isAdmin) {
        hospital_id = scope.hospital_id;
      } else {
        const hosp = await Hospital.findOne({
          where: { name: { [Op.like]: `%${user.org_name}%` } },
        });
        if (!hosp)
          return res.status(400).json({
            success: false,
            message: `No hospital found matching "${user.org_name}". Create it first.`,
          });
        hospital_id = hosp.id;
        hospitalName = hosp.name;
      }
      const h = await Hospital.findByPk(hospital_id);
      hospitalName = h?.name || "";
    } else if (role === "admin") {
      const [hosp] = await Hospital.findOrCreate({
        where: { name: user.org_name.trim() },
        defaults: { name: user.org_name.trim(), city: "" },
      });
      hospital_id = hosp.id;
      hospitalName = hosp.name;
    } else if (role === "insurance") {
      const [org] = await InsuranceOrg.findOrCreate({
        where: { name: user.org_name.trim() },
        defaults: { name: user.org_name.trim() },
      });
      insurance_org_id = org.id;
    }

    // ── 5. Update user record ─────────────────────────────────────────────────
    await user.update({
      status: "active",
      role,
      hospital_id,
      insurance_org_id,
      approved_by: scope.userId, // Record the admin who authorized this user
    });

    // ── 6. Send welcome email ─────────────────────────────────────────────────
    if (role === "admin") {
      sendAdminApprovalEmail(user.email, user.name, hospitalName).catch(
        console.error,
      );
    } else {
      sendApprovalEmail(user.email, user.name, role, user.org_name).catch(
        console.error,
      );
    }

    return res.json({
      success: true,
      message: `User approved as ${role}`,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role,
        status: "active",
        hospital_id,
        insurance_org_id,
      },
    });
  } catch (err) {
    console.error("[usersController.approveUser]", err.message);
    return res.status(500).json({ success: false, message: "Approval failed" });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// rejectUser — PUT /api/users/:id/reject
// Body: { "reason": "optional reason text" }
// ══════════════════════════════════════════════════════════════════════════════
const rejectUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const user = await User.findByPk(id);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    if (user.status !== "pending") {
      return res
        .status(400)
        .json({ success: false, message: `User is already ${user.status}` });
    }

    await user.update({ status: "rejected" });
    sendRejectionEmail(user.email, user.name, reason || "").catch(
      console.error,
    );

    return res.json({
      success: true,
      message: "User rejected",
      userId: user.id,
    });
  } catch (err) {
    console.error("[usersController.rejectUser]", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Rejection failed" });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// getStats — GET /api/users/stats  (super_admin dashboard)
// ══════════════════════════════════════════════════════════════════════════════
const getStats = async (req, res) => {
  try {
    const [rows] = await sequelize.query(
      "SELECT role, status, COUNT(*) AS count FROM users GROUP BY role, status",
    );
    return res.json({ success: true, stats: rows });
  } catch (err) {
    console.error("[usersController.getStats]", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch stats" });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// listAll — GET /api/users  (super_admin only)
// ══════════════════════════════════════════════════════════════════════════════
const listAll = async (req, res) => {
  try {
    const users = await User.findAll({
      include: [
        { model: Hospital, as: "hospital", attributes: ["id", "name"] },
        { model: InsuranceOrg, as: "insuranceOrg", attributes: ["id", "name"] },
      ],
      order: [["created_at", "DESC"]],
    });
    return res.json({ success: true, users });
  } catch (err) {
    console.error("[usersController.listAll]", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch users" });
  }
};

const listHospitalDoctors = async (req, res) => {
  try {
    const { scope } = req;

    // admin: only see doctors for their own hospital
    // super_admin: can potentially provide a hospital_id in query if needed, but primarily for admin
    const hospital_id = scope.isAdmin
      ? scope.hospital_id
      : req.query.hospital_id;

    if (!hospital_id) {
      return res
        .status(400)
        .json({ success: false, message: "Hospital ID required" });
    }

    const doctors = await User.findAll({
      where: {
        role: "doctor",
        status: "active",
        hospital_id,
      },
      attributes: ["id", "name", "email", "created_at"],
      order: [["created_at", "DESC"]],
    });

    return res.json({ success: true, count: doctors.length, doctors });
  } catch (err) {
    console.error("[usersController.listHospitalDoctors]", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch doctors" });
  }
};

const removeDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const { scope } = req;
    const user = await User.findByPk(id);

    if (!user || user.role !== "doctor") {
      return res
        .status(404)
        .json({ success: false, message: "Doctor not found" });
    }

    if (scope.isAdmin && user.hospital_id !== scope.hospital_id) {
      return res
        .status(403)
        .json({
          success: false,
          message: "Cannot remove a doctor from another hospital",
        });
    }

    await user.destroy();

    return res.json({
      success: true,
      message: "Doctor removed successfully",
    });
  } catch (err) {
    console.error("[usersController.removeDoctor]", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to remove doctor" });
  }
};

// getDashboardStats — GET /api/users/dashboard/stats (super_admin only)
// ══════════════════════════════════════════════════════════════════════════════
const getDashboardStats = async (req, res) => {
  try {
    const totalUsers = await User.count();
    const totalHospitals = await Hospital.count();
    const totalInsurance = await InsuranceOrg.count();
    const totalDoctors = await User.count({ where: { role: "doctor" } });

    return res.json({
      success: true,
      stats: { totalUsers, totalHospitals, totalInsurance, totalDoctors },
    });
  } catch (err) {
    console.error("[usersController.getDashboardStats]", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch dashboard stats" });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// deleteUser — DELETE /api/users/:id (super_admin only)
// ══════════════════════════════════════════════════════════════════════════════
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    await user.destroy();

    return res.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (err) {
    console.error("[usersController.deleteUser]", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to delete user" });
  }
};

module.exports = {
  listPending,
  approveUser,
  rejectUser,
  getStats,
  listAll,
  listHospitalDoctors,
  removeDoctor,
  deleteUser,
  getDashboardStats,
};
