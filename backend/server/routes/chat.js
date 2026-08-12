/**
 * routes/chat.js — Chat Route (thin layer)
 * All logic lives in controllers/chatController.js
 */
const express = require("express");
const router = express.Router();
const { verifyToken, requireRole } = require("../middleware/verifyToken");
const { attachScope } = require("../middleware/attachScope");
const ctrl = require("../controllers/chatController");

router.post(
  "/",
  verifyToken,
  requireRole("doctor", "admin", "insurance", "super_admin"),
  attachScope,
  ctrl.handleChat,
);

module.exports = router;
