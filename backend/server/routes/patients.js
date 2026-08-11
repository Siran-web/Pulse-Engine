// // /**
// //  * routes/patients.js — Patient Routes (thin layer)
// //  * All logic lives in controllers/patientsController.js
// //  *
// //  * ORDER MATTERS: /stats and /insurance must come BEFORE /:patientId
// //  * or Express will interpret "stats" and "insurance" as patientId params.
// //  */
// // const express = require("express");
// // const router = express.Router();
// // const { verifyToken, requireRole } = require("../middleware/verifyToken");
// // const { attachScope } = require("../middleware/attachScope");
// // const ctrl = require("../controllers/patientsController");

// // router.get(
// //   "/stats",
// //   verifyToken,
// //   requireRole("doctor", "admin", "super_admin", "insurance"),
// //   attachScope,
// //   ctrl.getStats,
// // );
// // router.get(
// //   "/network-hospitals",
// //   verifyToken,
// //   requireRole("insurance", "super_admin"),
// //   attachScope,
// //   ctrl.listNetworkHospitals,
// // );
// // router.get(
// //   "/insurance",
// //   verifyToken,
// //   requireRole("insurance", "super_admin"),
// //   attachScope,
// //   ctrl.listInsurancePatients,
// // );
// // router.get(
// //   "/",
// //   verifyToken,
// //   requireRole("doctor", "admin", "super_admin"),
// //   attachScope,
// //   ctrl.listPatients,
// // );
// // router.get(
// //   "/:patientId",
// //   verifyToken,
// //   requireRole("doctor", "admin", "super_admin"),
// //   attachScope,
// //   ctrl.getPatientDetail,
// // );
// // router.delete(
// //   "/",
// //   verifyToken,
// //   requireRole("admin", "super_admin"),
// //   attachScope,
// //   ctrl.deleteAllPatients,
// // );
// // router.delete(
// //   "/:patientId",
// //   verifyToken,
// //   requireRole("admin", "super_admin"),
// //   attachScope,
// //   ctrl.deletePatient,
// // );

// // router.delete(
// //   "/hospital/:hospitalId",
// //   verifyToken,
// //   requireRole("admin", "super_admin"),
// //   attachScope,
// //   ctrl.deletePatientsByHospital,
// // );

// // module.exports = router;

// /**
//  * routes/patients.js — Patient Routes (thin layer)
//  * All logic lives in controllers/patientsController.js
//  *
//  * ORDER MATTERS: /stats, /network-hospitals, /insurance must come BEFORE /:uniqueId
//  * or Express will interpret those literal strings as uniqueId param values.
//  *
//  * FIX: Route param renamed from :patientId → :uniqueId to match what the
//  * controller reads via req.params.uniqueId. Previously getPatientDetail and
//  * deletePatient always received req.params.uniqueId = undefined, causing every
//  * detail request to return 404 and every delete to silently fail.
//  */
// const express = require("express");
// const router = express.Router();
// const { verifyToken, requireRole } = require("../middleware/verifyToken");
// const { attachScope } = require("../middleware/attachScope");
// const ctrl = require("../controllers/patientsController");

// // ── Stats ─────────────────────────────────────────────────────────────────────
// router.get(
//   "/stats",
//   verifyToken,
//   requireRole("doctor", "admin", "super_admin", "insurance"),
//   attachScope,
//   ctrl.getStats,
// );

// // ── Insurance-specific routes ─────────────────────────────────────────────────
// router.get(
//   "/network-hospitals",
//   verifyToken,
//   requireRole("insurance", "super_admin"),
//   attachScope,
//   ctrl.listNetworkHospitals,
// );

// router.get(
//   "/insurance",
//   verifyToken,
//   requireRole("insurance", "super_admin"),
//   attachScope,
//   ctrl.listInsurancePatients,
// );

// // ── List all patients (doctor / admin view) ───────────────────────────────────
// router.get(
//   "/",
//   verifyToken,
//   requireRole("doctor", "admin", "super_admin"),
//   attachScope,
//   ctrl.listPatients,
// );

// // ── Single patient detail ─────────────────────────────────────────────────────
// // FIX: was /:patientId — controller reads req.params.uniqueId, so param name must match
// router.get(
//   "/:uniqueId",
//   verifyToken,
//   requireRole("doctor", "admin", "super_admin"),
//   attachScope,
//   ctrl.getPatientDetail,
// );

// // ── Delete all patients for a hospital ───────────────────────────────────────
// router.delete(
//   "/hospital/:hospitalId",
//   verifyToken,
//   requireRole("admin", "super_admin"),
//   attachScope,
//   ctrl.deletePatientsByHospital,
// );

// // ── Delete all patients (admin = own hospital, super_admin = all) ─────────────
// router.delete(
//   "/",
//   verifyToken,
//   requireRole("admin", "super_admin"),
//   attachScope,
//   ctrl.deleteAllPatients,
// );

// // ── Delete single patient ─────────────────────────────────────────────────────
// // FIX: was /:patientId — must match controller's req.params.uniqueId
// router.delete(
//   "/:uniqueId",
//   verifyToken,
//   requireRole("admin", "super_admin"),
//   attachScope,
//   ctrl.deletePatient,
// );

// module.exports = router;

/**
 * routes/patients.js — Patient Routes (thin layer)
 * All logic lives in controllers/patientsController.js
 *
 * ORDER MATTERS: /stats, /network-hospitals, /insurance must come BEFORE /:uniqueId
 * or Express will interpret those literal strings as uniqueId param values.
 *
 * FIX: Route param renamed from :patientId → :uniqueId to match what the
 * controller reads via req.params.uniqueId. Previously getPatientDetail and
 * deletePatient always received req.params.uniqueId = undefined, causing every
 * detail request to return 404 and every delete to silently fail.
 */
const express = require("express");
const router = express.Router();
const { verifyToken, requireRole } = require("../middleware/verifyToken");
const { attachScope } = require("../middleware/attachScope");
const ctrl = require("../controllers/patientsController");

// ── Stats ─────────────────────────────────────────────────────────────────────
router.get(
  "/stats",
  verifyToken,
  requireRole("doctor", "admin", "super_admin", "insurance"),
  attachScope,
  ctrl.getStats,
);

// ── Insurance-specific routes ─────────────────────────────────────────────────
router.get(
  "/network-hospitals",
  verifyToken,
  requireRole("insurance", "super_admin"),
  attachScope,
  ctrl.listNetworkHospitals,
);

router.get(
  "/insurance",
  verifyToken,
  requireRole("insurance", "super_admin"),
  attachScope,
  ctrl.listInsurancePatients,
);

// ── List all patients (doctor / admin view) ───────────────────────────────────
router.get(
  "/",
  verifyToken,
  requireRole("doctor", "admin", "super_admin"),
  attachScope,
  ctrl.listPatients,
);

// ── Single patient detail ─────────────────────────────────────────────────────
// FIX: was /:patientId — controller reads req.params.uniqueId, so param name must match
router.get(
  "/:uniqueId",
  verifyToken,
  requireRole("doctor", "admin", "super_admin"),
  attachScope,
  ctrl.getPatientDetail,
);

// ── Delete all patients for a hospital ───────────────────────────────────────
router.delete(
  "/hospital/:hospitalId",
  verifyToken,
  requireRole("admin", "super_admin"),
  attachScope,
  ctrl.deletePatientsByHospital,
);

// ── Delete all patients (admin = own hospital, super_admin = all) ─────────────
router.delete(
  "/",
  verifyToken,
  requireRole("admin", "super_admin"),
  attachScope,
  ctrl.deleteAllPatients,
);

// ── Delete single patient ─────────────────────────────────────────────────────
// FIX: was /:patientId — must match controller's req.params.uniqueId
router.delete(
  "/:uniqueId",
  verifyToken,
  requireRole("admin", "super_admin"),
  attachScope,
  ctrl.deletePatient,
);

module.exports = router;
