require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

// ── Database connections ──────────────────────────────────────────────────────
const connectMongo = require("./db/mongo");
const sequelize = require("./db/mysql");

const authRoutes = require("./routes/auth");
const PORT = process.env.PORT || 5000;

const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:3000", // React dev server
      "http://localhost:5173", // Vite dev server (if used)
      process.env.CLIENT_URL, // Production URL from .env
    ].filter(Boolean),
    credentials: true, // allow cookies if needed
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/auth", authRoutes);

app.use((req, res) => {
  res
    .status(404)
    .json({ success: false, message: `Route ${req.path} not found` });
});

const start = async () => {
  try {
    // 1. Connect MongoDB
    await connectMongo();

    // 2. Authenticate MySQL
    await sequelize.authenticate();
    console.log("✅  MySQL connected");

    // 3. Sync Sequelize models → create/alter tables
    await sequelize.sync();

    // 4. Start HTTP server
    app.listen(PORT, () => {
      // console.log("");
      console.log(
        "═══════════════════════════════════════════════ server is listening on port ",
        PORT,
      );
      // console.log(`🚀  Patient Evaluation Engine API`);
      // console.log(`    Running on http://localhost:${PORT}`);
      // console.log(`    Environment: ${process.env.NODE_ENV || "development"}`);
      // console.log("═══════════════════════════════════════════════");
      // console.log("");
      // console.log("📌  API Endpoints:");
      // console.log(`    POST   /api/auth/register`);
      // console.log(`    POST   /api/auth/login`);
      // console.log(`    GET    /api/users/pending`);
      // console.log(`    PUT    /api/users/:id/approve`);
      // console.log(`    POST   /api/upload`);
      // console.log(`    GET    /api/patients`);
      // console.log(`    GET    /api/rules`);
      // console.log(`    GET    /api/hospitals`);
      // console.log(`    POST   /api/chat`);
      // console.log(`    GET    /api/health`);
      // console.log("");
    });
  } catch (err) {
    console.error("❌  Server startup failed:", err.message);
    process.exit(1);
  }
};

start();
