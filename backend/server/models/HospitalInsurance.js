/**
 * models/HospitalInsurance.js — Bridge table for many-to-many Hospital ↔ InsuranceOrg
 *
 * PURPOSE:
 *  One insurance org (e.g. Star Health) can cover multiple hospitals.
 *  One hospital can be covered by multiple insurance orgs.
 *  This bridge table stores that relationship with an `active` flag so
 *  super_admin can enable/disable links without deleting the record.
 *
 * MODULE FLOW:
 *  super_admin calls POST /api/hospitals/insurance-link to create a row
 *  super_admin calls PUT  /api/hospitals/insurance-link/:id to toggle active
 *  Insurance route uses this table in a subquery:
 *    SELECT hospital_id FROM hospital_insurance
 *    WHERE insurance_org_id = ? AND active = 1
 *  That list of hospital_ids is then used to filter all patient queries.
 */

const { DataTypes } = require("sequelize");
const sequelize = require("../db/mysql");

const HospitalInsurance = sequelize.define(
  "HospitalInsurance",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    hospital_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    insurance_org_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    // ── soft-enable/disable flag (1 = active, 0 = paused) ───────────────────
    active: {
      type: DataTypes.TINYINT,
      defaultValue: 1,
    },
  },
  {
    tableName: "hospital_insurance",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,

    // ── Enforce one link per pair ──────────────────────────────────────────
    indexes: [{ unique: true, fields: ["hospital_id", "insurance_org_id"] }],
  },
);

module.exports = HospitalInsurance;
