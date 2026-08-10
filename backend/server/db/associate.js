/**
 * db/associate.js — Model Associations + DB Sync
 *
 * MODULE FLOW:
 *  1. Import all Sequelize models
 *  2. Declare all associations in ONE place (avoids circular require issues)
 *  3. Export syncDB() which is called ONCE at server startup in index.js
 *  4. syncDB() calls sequelize.sync({ alter: true }) to create/update tables
 *
 * WHY CENTRALIZED ASSOCIATIONS:
 *  Sequelize associations must be defined before sync().
 *  Defining them in each model file causes circular dependency problems
 *  (Hospital needs User, User needs Hospital — circular import).
 *  Centralizing here breaks the cycle.
 *
 * sync({ alter: true }):
 *  - Creates tables that don't exist
 *  - Adds columns that are new in models
 *  - Does NOT delete columns (safe for iterative development)
 *  - In production, use Sequelize migrations instead
 */

const sequelize = require("./mysql");
const Hospital = require("../models/Hospital");
const InsuranceOrg = require("../models/InsuranceOrg");
const HospitalInsurance = require("../models/HospitalInsurance");
const User = require("../models/User");
const Patient = require("../models/Patient");
const { Evaluation, MatchedRule } = require("../models/Evaluation");

// ══════════════════════════════════════════════════════════════════════════════
// ASSOCIATIONS
// ══════════════════════════════════════════════════════════════════════════════

// ── Hospital ↔ User ───────────────────────────────────────────────────────────
// A hospital has many users (admin, doctor)
// A user (admin/doctor) belongs to one hospital
Hospital.hasMany(User, { foreignKey: "hospital_id", as: "users" });
User.belongsTo(Hospital, { foreignKey: "hospital_id", as: "hospital" });

// ── InsuranceOrg ↔ User ───────────────────────────────────────────────────────
InsuranceOrg.hasMany(User, { foreignKey: "insurance_org_id", as: "users" });
User.belongsTo(InsuranceOrg, {
  foreignKey: "insurance_org_id",
  as: "insuranceOrg",
});

// ── Hospital ↔ InsuranceOrg (many-to-many via bridge) ────────────────────────
Hospital.belongsToMany(InsuranceOrg, {
  through: HospitalInsurance,
  foreignKey: "hospital_id",
  as: "insuranceOrgs",
});
InsuranceOrg.belongsToMany(Hospital, {
  through: HospitalInsurance,
  foreignKey: "insurance_org_id",
  as: "hospitals",
});

// ── Hospital ↔ Patient ────────────────────────────────────────────────────────
Hospital.hasMany(Patient, { foreignKey: "hospital_id", as: "patients" });
Patient.belongsTo(Hospital, { foreignKey: "hospital_id", as: "hospital" });

// ── Hospital ↔ Evaluation ─────────────────────────────────────────────────────
Hospital.hasMany(Evaluation, { foreignKey: "hospital_id", as: "evaluations" });
Evaluation.belongsTo(Hospital, { foreignKey: "hospital_id", as: "hospital" });

// ── Evaluation ↔ MatchedRule is declared inside models/Evaluation.js ─────────

// ══════════════════════════════════════════════════════════════════════════════
// SYNC
// ══════════════════════════════════════════════════════════════════════════════

/**
 * syncDB — creates/updates all MySQL tables from Sequelize model definitions
 * Called once in server/index.js after DB connection is verified
 */
const syncDB = async () => {
  try {
    // alter:true fails on MySQL when too many keys are created due to repeated syncs
    await sequelize.sync({ alter: false });
    console.log("✅  MySQL tables synced via Sequelize");
  } catch (err) {
    console.error("❌  Sequelize sync failed:", err.message);
    // Continue running the server even if sync fails, table structures are mostly stable
  }
};

// Export all models so routes can import from one place if needed
module.exports = {
  syncDB,
  sequelize,
  Hospital,
  InsuranceOrg,
  HospitalInsurance,
  User,
  Patient,
  Evaluation,
  MatchedRule,
};
