/**
 * routes/users.js — User Approval Queue Routes (thin layer)
 * All logic lives in controllers/usersController.js
 */
const express = require("express");
const router = express.Router();
const { verifyToken, requireRole } = require("../middleware/verifyToken");
const { attachScope } = require("../middleware/attachScope");
const ctrl = require("../controllers/usersController");

router.get("/stats", verifyToken, requireRole("super_admin"), ctrl.getStats);

router.get(
  "/pending",
  verifyToken,
  requireRole("admin", "super_admin"),
  attachScope,
  ctrl.listPending,
);

router.get("/", verifyToken, requireRole("super_admin"), ctrl.listAll);

router.get(
  "/hospital/doctors",
  verifyToken,
  requireRole("admin", "super_admin"),
  attachScope,
  ctrl.listHospitalDoctors,
);
router.delete(
  "/hospital/doctors/:id",
  verifyToken,
  requireRole("admin", "super_admin"),
  attachScope,
  ctrl.removeDoctor,
);

router.put(
  "/:id/approve",
  verifyToken,
  requireRole("admin", "super_admin"),
  attachScope,
  ctrl.approveUser,
);

router.put(
  "/:id/reject",
  verifyToken,
  requireRole("admin", "super_admin"),
  ctrl.rejectUser,
);

router.get(
  "/dashboard/stats",
  verifyToken,
  requireRole("super_admin"),
  ctrl.getDashboardStats,
);

router.delete("/:id", verifyToken, requireRole("super_admin"), ctrl.deleteUser);

module.exports = router;
