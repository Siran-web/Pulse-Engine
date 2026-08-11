/**
 * routes/hospitals.js — Hospital & Insurance Org Routes (thin layer)
 * All logic lives in controllers/hospitalsController.js
 */
const express = require("express");
const router = express.Router();
const { verifyToken, requireRole } = require("../middleware/verifyToken");
const ctrl = require("../controllers/hospitalsController");

router.get(
  "/stats",
  verifyToken,
  requireRole("super_admin"),
  ctrl.getSystemStats,
);
router.get(
  "/insurance-orgs",
  verifyToken,
  requireRole("super_admin"),
  ctrl.listInsuranceOrgs,
);
router.post(
  "/insurance-orgs",
  verifyToken,
  requireRole("super_admin"),
  ctrl.createInsuranceOrg,
);
router.delete(
  "/insurance-orgs/:id",
  verifyToken,
  requireRole("super_admin"),
  ctrl.deleteInsuranceOrg,
);
router.post(
  "/insurance-link",
  verifyToken,
  requireRole("super_admin"),
  ctrl.linkInsuranceOrg,
);
router.put(
  "/insurance-link/:id",
  verifyToken,
  requireRole("super_admin"),
  ctrl.toggleInsuranceLink,
);
router.get(
  "/",
  verifyToken,
  requireRole("super_admin", "admin"),
  ctrl.listHospitals,
);
router.post("/", verifyToken, requireRole("super_admin"), ctrl.createHospital);
router.delete(
  "/:id",
  verifyToken,
  requireRole("super_admin"),
  ctrl.deleteHospital,
);
router.get(
  "/:id",
  verifyToken,
  requireRole("super_admin", "admin"),
  ctrl.getHospital,
);
router.put(
  "/:id",
  verifyToken,
  requireRole("super_admin"),
  ctrl.updateHospital,
);

module.exports = router;
