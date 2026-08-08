// /**
//  * models/Patient.js — Sequelize Model for `patients` table
//  *
//  * Every row is tagged with hospital_id — the single most important column
//  * for data isolation. Every SELECT on this table MUST include
//  * WHERE hospital_id = req.scope.hospital_id (enforced by attachScope middleware).
//  *
//  * upload_run_id groups all rows from a single Excel upload.
//  * Time-based evaluation uses the last 3 distinct upload_run_ids per hospital
//  * to compute worst-case vitals and detect trends.
//  *
//  * RELATIONSHIPS:
//  *  Patient → belongsTo → Hospital
//  *  Patient → hasMany   → Evaluation  (one patient, multiple context evaluations)
//  *
//  * MODULE FLOW:
//  *  POST /api/upload → Python parses Excel → Node.js bulk-inserts rows here
//  *  GET  /api/patients → Doctor/Admin queries patients (hospital-scoped)
//  *  GET  /api/patients/:id → Single patient + latest evaluation
//  *  GET  /api/patients/insurance → Insurance view (limited columns, multi-hospital)
//  */

// const { DataTypes } = require("sequelize");
// const sequelize = require("../db/mysql");

// const Patient = sequelize.define(
//   "Patient",
//   {
//     id: {
//       type: DataTypes.INTEGER,
//       autoIncrement: true,
//       primaryKey: true,
//     },

//     // ── Business-level patient identifier (e.g. "P101") ──────────────────────
//     patient_id: {
//       type: DataTypes.STRING(20),
//       allowNull: false,
//     },

//     // ── CRITICAL: every patient belongs to exactly one hospital ──────────────
//     hospital_id: {
//       type: DataTypes.INTEGER,
//       allowNull: false,
//     },

//     name: {
//       type: DataTypes.STRING(100),
//       allowNull: true,
//     },

//     age: {
//       type: DataTypes.INTEGER,
//       allowNull: true,
//       validate: { min: 0, max: 150 },
//     },

//     gender: {
//       type: DataTypes.STRING(10),
//       allowNull: true,
//     },

//     // ── Clinical vitals ───────────────────────────────────────────────────────
//     heart_rate: {
//       type: DataTypes.INTEGER,
//       allowNull: true,
//     },

//     blood_pressure_sys: {
//       type: DataTypes.INTEGER, // systolic BP
//       allowNull: true,
//     },

//     blood_pressure_dia: {
//       type: DataTypes.INTEGER, // diastolic BP
//       allowNull: true,
//     },

//     // ── Operational fields (used by admin and insurance rules) ────────────────
//     visit_count: {
//       type: DataTypes.INTEGER,
//       defaultValue: 0,
//     },

//     admission_count: {
//       type: DataTypes.INTEGER,
//       defaultValue: 0,
//     },

//     price: {
//       type: DataTypes.DECIMAL(10, 2),
//       allowNull: true,
//     },

//     // ── Groups all rows from the same Excel upload (for time-based eval) ──────
//     upload_run_id: {
//       type: DataTypes.STRING(50),
//       allowNull: true,
//     },
//   },
//   {
//     tableName: "patients",
//     timestamps: true,
//     createdAt: "uploaded_at",
//     updatedAt: false,

//     // ── Enforce uniqueness of patient_id within a hospital ───────────────────
//     // Two different hospitals can have a patient "P101" — they are separate patients
//     indexes: [{ unique: true, fields: ["patient_id", "hospital_id"] }],
//   },
// );

// module.exports = Patient;

/**
 * models/Patient.js — UPDATED
 *
 * KEY CHANGES FROM OLD VERSION:
 *
 *  1. unique_id (UUID v4) replaces the composite (patient_id, hospital_id) key.
 *     Every patient now has a globally unique identifier independent of hospital.
 *     This also allows a proper FK from evaluations → patients.
 *
 *  2. insurance_id (FK → insurance_orgs.id) is stored directly on the patient row.
 *     An insurance company can ONLY see a patient when BOTH conditions are true:
 *       a) HospitalInsurance link is active between their org and the patient's hospital
 *       b) patient.insurance_id === the insurance org's id
 *     Without BOTH conditions, the patient is invisible to that insurer.
 *
 *  3. HIPAA field-level encryption via AES-256-GCM (utils/encryption.js):
 *       ENCRYPTED  → name, gender, patient_id (original Excel identifier)
 *       PLAIN TEXT → age, all vitals, visit_count, admission_count, price
 *     Vitals are left unencrypted because the Python rule engine needs raw integers.
 *     Sequelize virtual getters/setters handle encrypt-on-write / decrypt-on-read
 *     transparently — the rest of the codebase just reads p.name, p.gender etc.
 *
 *  4. Composite unique index on (patient_id, hospital_id) is REPLACED by a
 *     unique index on unique_id only.
 *
 * COLUMN NAMING CONVENTION:
 *  Encrypted columns are stored in DB as  name_enc, gender_enc, patient_id_enc.
 *  The Sequelize model exposes them as virtual aliases  name, gender, patient_id
 *  via get/set so existing controller code needs minimal changes.
 *
 * MODULE FLOW:
 *  POST /api/upload → Excel parsed by Python → Node.js sets patient.name = "John"
 *                     → Sequelize setter encrypts → DB stores ciphertext
 *  GET  /api/patients → Sequelize getter decrypts → controller returns plaintext
 *  Python engine     → receives heart_rate, blood_pressure_sys etc. unencrypted
 */

"use strict";

const { DataTypes } = require("sequelize");
const { v4: uuidv4 } = require("uuid");
const sequelize = require("../db/mysql");
const { encryptField, decryptField } = require("../utils/encryption");

const Patient = sequelize.define(
  "Patient",
  {
    // ── Internal auto-increment PK (never exposed externally) ────────────────
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    // ── GLOBALLY UNIQUE patient identifier (UUID v4) ──────────────────────────
    // Generated server-side on first upload, or provided by the hospital in Excel.
    // Used as the FK target in evaluations (replaces composite patient_id+hospital_id).
    // Never changes once created.
    unique_id: {
      type: DataTypes.STRING(36),
      allowNull: false,
      unique: true,
      defaultValue: () => uuidv4(),
    },

    // ── ENCRYPTED: Original patient identifier from Excel ("P101", "MRN00123") ─
    // Stored encrypted — rule engine never needs this, it uses unique_id.
    patient_id_enc: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // ── Hospital that owns this patient record ────────────────────────────────
    hospital_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    // ── Insurance org this patient is registered with (optional) ─────────────
    // When set, the matching insurance company can see this patient — but ONLY
    // if their HospitalInsurance link to this hospital is also active.
    // If null, no insurance org has direct visibility of this patient.
    insurance_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
      references: { model: "insurance_orgs", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },

    // ── ENCRYPTED: Patient name (PII) ─────────────────────────────────────────
    name_enc: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // ── NOT ENCRYPTED: Age — used directly in rule conditions (e.g. age >= 65) ─
    age: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: { min: 0, max: 150 },
    },

    // ── ENCRYPTED: Gender (PII) ───────────────────────────────────────────────
    gender_enc: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // ── NOT ENCRYPTED: Clinical vitals — rule engine needs raw integers ────────
    heart_rate: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    blood_pressure_sys: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    blood_pressure_dia: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    // ── NOT ENCRYPTED: Operational fields — used in admin / insurance rules ───
    visit_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    admission_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },

    // ── NOT ENCRYPTED: Upload batch identifier ────────────────────────────────
    upload_run_id: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
  },
  {
    tableName: "patients",
    timestamps: true,
    createdAt: "uploaded_at",
    updatedAt: false,

    indexes: [
      { unique: true, fields: ["unique_id"] }, // globally unique
      { fields: ["hospital_id"] }, // fast lookup by hospital
      { fields: ["insurance_id"] }, // fast lookup by insurance org
      { fields: ["hospital_id", "upload_run_id"] }, // time-based evaluation
    ],
  },
);

// ══════════════════════════════════════════════════════════════════════════════
// VIRTUAL PROPERTIES — encrypt on write, decrypt on read
// The rest of the codebase uses  p.name / p.patient_id / p.gender  as before.
// ══════════════════════════════════════════════════════════════════════════════

// patient_id  (original Excel identifier, e.g. "P101")
Patient.prototype.getPatientId = function () {
  return decryptField(this.getDataValue("patient_id_enc"));
};
Patient.prototype.setPatientId = function (value) {
  this.setDataValue("patient_id_enc", encryptField(value));
};

// name
Patient.prototype.getName = function () {
  return decryptField(this.getDataValue("name_enc"));
};
Patient.prototype.setName = function (value) {
  this.setDataValue("name_enc", encryptField(value));
};

// gender
Patient.prototype.getGender = function () {
  return decryptField(this.getDataValue("gender_enc"));
};
Patient.prototype.setGender = function (value) {
  this.setDataValue("gender_enc", encryptField(value));
};

// ══════════════════════════════════════════════════════════════════════════════
// toSafeJSON — returns a plain object with decrypted PII
// Use this instead of .toJSON() in controllers.
// ══════════════════════════════════════════════════════════════════════════════
Patient.prototype.toSafeJSON = function () {
  const raw = this.toJSON();
  return {
    unique_id: raw.unique_id,
    patient_id: this.getPatientId(),
    hospital_id: raw.hospital_id,
    insurance_id: raw.insurance_id,
    name: this.getName(),
    age: raw.age,
    gender: this.getGender(),
    heart_rate: raw.heart_rate,
    blood_pressure_sys: raw.blood_pressure_sys,
    blood_pressure_dia: raw.blood_pressure_dia,
    visit_count: raw.visit_count,
    admission_count: raw.admission_count,
    price: raw.price,
    upload_run_id: raw.upload_run_id,
    uploaded_at: raw.uploaded_at,
    // hospital / evaluations are attached separately by controllers
    hospital: raw.hospital,
    evaluations: raw.evaluations,
  };
};

module.exports = Patient;
