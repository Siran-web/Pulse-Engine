const express = require("express");
const router = express.Router();
const { verifyToken, requireRole } = require("../middleware/verifyToken");
const { attachScope } = require("../middleware/attachScope");
const ctrl = require("../controllers/rulesController");

router.get(
  "/",
  verifyToken,
  requireRole("doctor", "admin", "super_admin", "insurance"),
  attachScope,
  ctrl.listRules,
);
router.post(
  "/",
  verifyToken,
  requireRole("admin", "super_admin"),
  attachScope,
  ctrl.createRule,
);

router.patch(
  "/:id/toggle-status",
  verifyToken,
  requireRole("admin", "super_admin"),
  attachScope,
  ctrl.toggleRuleStatus,
);

router.put(
  "/:id",
  verifyToken,
  requireRole("admin", "super_admin"),
  attachScope,
  ctrl.updateRule,
);

router.delete(
  "/:id",
  verifyToken,
  requireRole("admin", "super_admin"),
  attachScope,
  ctrl.deleteRule,
);

module.exports = router;
