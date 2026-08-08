// /**
//  * models/Evaluation.js — Sequelize Model for `evaluations` table
//  *
//  * An Evaluation is the OUTPUT of the Python rule engine for one patient
//  * in one context (doctor | admin | insurance).
//  *
//  * One patient can have THREE evaluations — one per context.
//  * Each evaluation stores:
//  *  - risk_score  : total points accumulated from matched rules
//  *  - risk_level  : Low / Medium / High / Critical (derived from score)
//  *  - explanation : plain-English summary shown on the dashboard
//  *
//  * WHY NO FK FROM evaluations → patients:
//  *  patients.patient_id is NOT unique alone — it is only unique as a
//  *  composite key (patient_id, hospital_id).  MySQL forbids a FK on a
//  *  non-unique column.  We therefore store patient_id + hospital_id as
//  *  plain VARCHAR/INT columns and join them in queries manually.
//  *  The data integrity is maintained by the upload pipeline (we only
//  *  insert evaluations for patients that already exist in the patients table).
//  *
//  * RELATIONSHIPS:
//  *  Evaluation → hasMany → MatchedRule  (evaluation_id FK — safe, single unique PK)
//  *
//  * MODULE FLOW:
//  *  Python /evaluate endpoint returns results[]
//  *  Node.js pythonService.js receives results
//  *  upload.js route bulk-inserts evaluations + matched_rules into MySQL
//  *  GET /api/patients/:id returns the latest evaluation for the requesting context
//  */

// const { DataTypes } = require("sequelize");
// const sequelize = require("../db/mysql");

// const Evaluation = sequelize.define(
//   "Evaluation",
//   {
//     id: {
//       type: DataTypes.INTEGER,
//       autoIncrement: true,
//       primaryKey: true,
//     },

//     patient_id: {
//       type: DataTypes.STRING(20),
//       allowNull: false,
//     },

//     hospital_id: {
//       type: DataTypes.INTEGER,
//       allowNull: false,
//     },

//     // ── Which role's rules were used for this evaluation ──────────────────────
//     context: {
//       type: DataTypes.ENUM("doctor", "admin", "insurance"),
//       allowNull: false,
//     },

//     // ── Accumulated score from all matched rules ───────────────────────────────
//     risk_score: {
//       type: DataTypes.INTEGER,
//       defaultValue: 0,
//     },

//     // ── Derived band: 0-30=Low, 31-60=Medium, 61-100=High, 101+=Critical ──────
//     risk_level: {
//       type: DataTypes.ENUM("Low", "Medium", "High", "Critical"),
//       allowNull: false,
//     },

//     // ── Full plain-English explanation stored for chatbot + dashboard display ─
//     explanation: {
//       type: DataTypes.TEXT,
//       allowNull: true,
//     },
//   },
//   {
//     tableName: "evaluations",
//     timestamps: true,
//     createdAt: "evaluated_at",
//     updatedAt: false,
//   },
// );

// // ══════════════════════════════════════════════════════════════════════════════
// /**
//  * models/MatchedRule — one row per rule that fired during an evaluation
//  *
//  * MODULE FLOW:
//  *  Python returns matched[] array of rule ObjectIds
//  *  Node.js splits this into individual MatchedRule rows linked to evaluation_id
//  *  Doctor dashboard fetches matched_rules to show "Why is this patient high risk?"
//  */
// // ══════════════════════════════════════════════════════════════════════════════

// const MatchedRule = sequelize.define(
//   "MatchedRule",
//   {
//     id: {
//       type: DataTypes.INTEGER,
//       autoIncrement: true,
//       primaryKey: true,
//     },

//     evaluation_id: {
//       type: DataTypes.INTEGER,
//       allowNull: false,
//     },

//     // ── MongoDB ObjectId stored as string ─────────────────────────────────────
//     rule_id: {
//       type: DataTypes.STRING(50),
//       allowNull: true,
//     },

//     rule_name: {
//       type: DataTypes.STRING(100),
//       allowNull: true,
//     },

//     // ── Points this specific rule contributed to the total score ──────────────
//     score_added: {
//       type: DataTypes.INTEGER,
//       defaultValue: 0,
//     },
//   },
//   {
//     tableName: "matched_rules",
//     timestamps: false, // no timestamps needed for individual rule matches
//   },
// );

// // ── Associations ──────────────────────────────────────────────────────────────
// Evaluation.hasMany(MatchedRule, {
//   foreignKey: "evaluation_id",
//   as: "matchedRules",
//   onDelete: "CASCADE",
// });
// MatchedRule.belongsTo(Evaluation, {
//   foreignKey: "evaluation_id",
// });

// module.exports = { Evaluation, MatchedRule };

/**
 * models/Evaluation.js — UPDATED
 *
 * KEY CHANGE FROM OLD VERSION:
 *  OLD: patient_id (VARCHAR) + hospital_id — no FK possible (composite unique issue)
 *  NEW: unique_id (VARCHAR 36, FK → patients.unique_id) — proper referential integrity
 *
 * We keep hospital_id here as a denormalized query-helper column so that
 * queries like "get all evaluations for hospital X" don't need a JOIN to patients.
 * It is always set from the upload pipeline, not from user input.
 *
 * RELATIONSHIPS:
 *  Evaluation → belongsTo → Patient   (via unique_id FK)
 *  Evaluation → hasMany   → MatchedRule
 */

"use strict";

const { DataTypes } = require("sequelize");
const sequelize = require("../db/mysql");

// ── Evaluation ────────────────────────────────────────────────────────────────
const Evaluation = sequelize.define(
  "Evaluation",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    // ── FK to patients.unique_id ───────────────────────────────────────────────
    // This is now a proper foreign key — possible because unique_id has a
    // simple UNIQUE constraint (not composite).
    unique_id: {
      type: DataTypes.STRING(36),
      allowNull: false,
      references: { model: "patients", key: "unique_id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },

    // ── Denormalized for fast hospital-level queries (no JOIN needed) ─────────
    hospital_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    // ── context: which role's rule set was applied ────────────────────────────
    context: {
      type: DataTypes.ENUM("doctor", "admin", "insurance"),
      allowNull: false,
    },

    // ── Accumulated score from all matched rules ───────────────────────────────
    risk_score: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },

    // ── Derived band from score ────────────────────────────────────────────────
    risk_level: {
      type: DataTypes.ENUM("Low", "Medium", "High", "Critical"),
      allowNull: false,
    },

    // ── Plain-English explanation (shown on dashboard + chatbot) ──────────────
    explanation: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "evaluations",
    timestamps: true,
    createdAt: "evaluated_at",
    updatedAt: false,

    indexes: [
      { fields: ["unique_id"] },
      { fields: ["hospital_id"] },
      { fields: ["unique_id", "context"] }, // one evaluation per patient per context
      { fields: ["hospital_id", "context", "risk_level"] }, // stats queries
    ],
  },
);

// ── MatchedRule ───────────────────────────────────────────────────────────────
const MatchedRule = sequelize.define(
  "MatchedRule",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    evaluation_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "evaluations", key: "id" },
      onDelete: "CASCADE",
    },

    // ── MongoDB ObjectId stored as string ─────────────────────────────────────
    rule_id: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    rule_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    score_added: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  },
  {
    tableName: "matched_rules",
    timestamps: false,
  },
);

// ── Associations ──────────────────────────────────────────────────────────────
Evaluation.hasMany(MatchedRule, {
  foreignKey: "evaluation_id",
  as: "matchedRules",
  onDelete: "CASCADE",
});
MatchedRule.belongsTo(Evaluation, {
  foreignKey: "evaluation_id",
});

module.exports = { Evaluation, MatchedRule };
