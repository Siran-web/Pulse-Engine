/**
 * routes/upload.js — Upload Routes (thin layer)
 * Multer config stays here (it's middleware, not business logic)
 * All pipeline logic lives in controllers/uploadController.js
 */
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const router = express.Router();

const { verifyToken, requireRole } = require("../middleware/verifyToken");
const { attachScope } = require("../middleware/attachScope");
const ctrl = require("../controllers/uploadController");

// ── Multer disk storage ───────────────────────────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-admin${req.user?.userId}-${safe}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
  ];
  allowed.includes(file.mimetype)
    ? cb(null, true)
    : cb(new Error("Only Excel files (.xlsx, .xls) are accepted"), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ── Routes ────────────────────────────────────────────────────────────────────
router.post(
  "/",
  verifyToken,
  requireRole("admin", "super_admin"),
  attachScope,
  upload.single("file"),
  ctrl.uploadFile,
);
router.get(
  "/history",
  verifyToken,
  requireRole("admin", "super_admin"),
  attachScope,
  ctrl.getHistory,
);

module.exports = router;
