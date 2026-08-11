/**
 * routes/auth.js — Auth Routes (thin layer)
 * All logic lives in controllers/authController.js
 *
 * WHAT THIS FILE DOES: maps HTTP verb + path → middleware chain → controller function
 * WHAT IT DOES NOT DO: any business logic, DB calls, or conditional checks
 */
const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/verifyToken");
const ctrl = require("../controllers/authController");

// Public routes — no token needed
router.post("/register", ctrl.register);
router.post("/login", ctrl.login);
router.post("/google", ctrl.googleLogin);

// Protected — needs valid JWT
router.get("/me", verifyToken, ctrl.me);

module.exports = router;
