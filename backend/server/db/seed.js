/**
 * db/seed.js — Database Seeder
 *
 * PURPOSE:
 *  Seeds the database with the minimum data needed to start using the app:
 *  1. Creates the super_admin user in MySQL
 *  2. Seeds global rules into MongoDB (unified schema with conditions[])
 *  3. Optionally seeds 2 test hospitals
 *
 * HOW TO RUN:
 *  cd server
 *  node db/seed.js
 *
 * IDEMPOTENT: Safe to run multiple times — deletes global rules and re-inserts
 *
 * MODULE FLOW:
 *  1. Connect to both MySQL and MongoDB
 *  2. Sync Sequelize models (creates tables if they don't exist)
 *  3. Hash super_admin password with bcrypt
 *  4. findOrCreate super_admin user
 *  5. Upsert MongoDB rules (delete all global rules, re-insert)
 *  6. Close connections
 */

const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const bcrypt = require("bcryptjs");
const connectMongo = require("./mongo");
const sequelize = require("./mysql");
const { syncDB } = require("./associate");
const User = require("../models/User");
const Hospital = require("../models/Hospital");
const { Rule } = require("../models/Rule"); // CompositeRule no longer needed

// ══════════════════════════════════════════════════════════════════════════════
// SEED DATA — Unified Rule Schema (conditions[] + logic)
// ══════════════════════════════════════════════════════════════════════════════

const GLOBAL_RULES = [
  // ── Single-condition rules ─────────────────────────────────────────────

  {
    name: "Senior Patient",
    logic: "AND",
    conditions: [{ field: "age", operator: ">", value: 60 }],
    score: 50,
    context: ["doctor", "insurance"],
    scope: "global",
    hospital_id: null,
    active: true,
    explanation_template:
      "Patient age exceeds the senior threshold of 60, indicating increased health risk.",
  },
  {
    name: "High Heart Rate",
    logic: "AND",
    conditions: [{ field: "heart_rate", operator: ">", value: 120 }],
    score: 50,
    context: ["doctor"],
    scope: "global",
    hospital_id: null,
    active: true,
    explanation_template:
      "Heart rate is above the safe threshold of 120 bpm, indicating possible cardiac stress.",
  },
  {
    name: "Very High Blood Pressure",
    logic: "AND",
    conditions: [{ field: "blood_pressure_sys", operator: ">=", value: 160 }],
    score: 80,
    context: ["doctor"],
    scope: "global",
    hospital_id: null,
    active: true,
    explanation_template:
      "Systolic blood pressure is at or above 160 mmHg, indicating a hypertensive crisis risk.",
  },
  {
    name: "Frequent Visitor",
    logic: "AND",
    conditions: [{ field: "visit_count", operator: ">=", value: 5 }],
    score: 30,
    context: ["admin"],
    scope: "global",
    hospital_id: null,
    active: true,
    explanation_template:
      "Patient has a high number of hospital visits, indicating frequent healthcare usage.",
  },
  {
    name: "High Admissions",
    logic: "AND",
    conditions: [{ field: "admission_count", operator: ">=", value: 3 }],
    score: 80,
    context: ["admin", "insurance"],
    scope: "global",
    hospital_id: null,
    active: true,
    explanation_template:
      "Patient has multiple hospital admissions, indicating elevated medical risk.",
  },
  {
    name: "Critical Heart Rate",
    logic: "AND",
    conditions: [{ field: "heart_rate", operator: ">", value: 130 }],
    score: 50,
    context: ["doctor"],
    scope: "global",
    hospital_id: null,
    active: true,
    explanation_template:
      "Heart rate is critically high, exceeding safe physiological limits.",
  },

  // ── Multi-condition rules ─────────────────────────────────────────────

  {
    name: "Elderly Critical Risk",
    logic: "AND",
    conditions: [
      { field: "age", operator: ">", value: 60 },
      { field: "heart_rate", operator: ">", value: 120 },
    ],
    score: 80,
    context: ["doctor"],
    scope: "global",
    hospital_id: null,
    active: true,
    explanation_template:
      "Patient is elderly and has an elevated heart rate, indicating compounded cardiovascular risk.",
  },
  {
    name: "Cardiac Risk",
    logic: "OR",
    conditions: [
      { field: "heart_rate", operator: ">", value: 130 },
      { field: "blood_pressure_sys", operator: ">=", value: 160 },
    ],
    score: 50,
    context: ["doctor"],
    scope: "global",
    hospital_id: null,
    active: true,
    explanation_template:
      "Either a critically high heart rate or severe hypertension detected, requiring immediate attention.",
  },
];

// ── Test Hospitals ────────────────────────────────────────────────────────────
const TEST_HOSPITALS = [
  { name: "Apollo Hospital", city: "Mumbai" },
  { name: "Fortis Hospital", city: "Bengaluru" },
];

// ══════════════════════════════════════════════════════════════════════════════
// SEED FUNCTION
// ══════════════════════════════════════════════════════════════════════════════

async function seed() {
  console.log("");
  console.log("════════════════════════════════════════");
  console.log("  Patient Evaluation Engine — DB Seeder");
  console.log("════════════════════════════════════════");
  console.log("");

  try {
    // ── Connect DBs ─────────────────────────────────────────────────────────
    await connectMongo();
    await sequelize.authenticate();
    console.log("✅  Both databases connected");

    // ── Sync tables ──────────────────────────────────────────────────────────
    await syncDB();

    // ════════════════════════════════════════════════════════════════════════
    // 1. SUPER ADMIN
    // ════════════════════════════════════════════════════════════════════════
    const password_hash = await bcrypt.hash(
      process.env.SUPER_ADMIN_PASSWORD || "SuperAdmin@123",
      10,
    );

    const [superAdmin, saCreated] = await User.scope(
      "withPassword",
    ).findOrCreate({
      where: {
        email: process.env.SUPER_ADMIN_EMAIL || "superadmin@patienteval.com",
      },
      defaults: {
        name: process.env.SUPER_ADMIN_NAME || "System Administrator",
        email: process.env.SUPER_ADMIN_EMAIL || "superadmin@patienteval.com",
        password_hash,
        role: "super_admin",
        status: "active",
        hospital_id: null,
        insurance_org_id: null,
        org_name: "System",
      },
    });

    console.log(
      saCreated
        ? `✅  super_admin created: ${superAdmin.email}`
        : `ℹ️   super_admin already exists: ${superAdmin.email}`,
    );

    // ════════════════════════════════════════════════════════════════════════
    // 2. TEST HOSPITALS
    // ════════════════════════════════════════════════════════════════════════
    for (const h of TEST_HOSPITALS) {
      const [hosp, created] = await Hospital.findOrCreate({
        where: { name: h.name },
        defaults: h,
      });
      console.log(
        created
          ? `✅  Hospital created: ${hosp.name} (${hosp.city})`
          : `ℹ️   Hospital already exists: ${hosp.name}`,
      );
    }

    // ════════════════════════════════════════════════════════════════════════
    // 3. MONGODB GLOBAL RULES (unified schema)
    // Delete all global rules and re-insert for a clean state
    // ════════════════════════════════════════════════════════════════════════
    await Rule.deleteMany({ scope: "global" });
    console.log("🗑   Cleared existing global rules");

    const insertedRules = await Rule.insertMany(GLOBAL_RULES);
    console.log(`✅  Inserted ${insertedRules.length} global rules`);
    insertedRules.forEach((r) => {
      const condSummary = r.conditions
        .map((c) => `${c.field} ${c.operator} ${c.value}`)
        .join(` ${r.logic} `);
      console.log(`     • ${r.name}: [${condSummary}] → +${r.score} pts`);
    });

    // ════════════════════════════════════════════════════════════════════════
    // SUMMARY
    // ════════════════════════════════════════════════════════════════════════
    console.log("");
    console.log("════════════════════════════════════════");
    console.log("  Seed complete!");
    console.log("");
    console.log(`  Super Admin Login:`);
    console.log(`    Email:    ${superAdmin.email}`);
    console.log(
      `    Password: ${process.env.SUPER_ADMIN_PASSWORD || "SuperAdmin@123"}`,
    );
    console.log("");
    console.log("  Next steps:");
    console.log("  1. cd server && npm run dev");
    console.log("  2. cd engine && python app.py");
    console.log("  3. cd client && npm start");
    console.log("  4. Login as super_admin at http://localhost:3000");
    console.log("════════════════════════════════════════");
    console.log("");
  } catch (err) {
    console.error("❌  Seed failed:", err.message);
    console.error(err);
    process.exit(1);
  }
  process.exit(0);
}

seed();
