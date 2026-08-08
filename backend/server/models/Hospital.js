/**
 * models/Hospital.js — Sequelize Model for `hospitals` table
 *
 * RELATIONSHIPS:
 *  Hospital → hasMany → User          (admin, doctor belong to a hospital)
 *  Hospital → hasMany → Patient       (every patient is scoped to a hospital)
 *  Hospital → hasMany → Evaluation    (evaluations are hospital-scoped)
 *  Hospital → belongsToMany → InsuranceOrg  (via HospitalInsurance bridge)
 *
 * MODULE FLOW:
 *  Imported by db/associate.js which sets up all cross-model associations.
 *  super_admin can create hospitals via POST /api/hospitals.
 *  hospital_id from this table is embedded in every JWT token for scoping.
 */

const { DataTypes } = require("sequelize");
const sequelize = require("../db/mysql");

const Hospital = sequelize.define(
  "Hospital",
  {
    // ── Primary Key ──────────────────────────────────────────────────────────
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    // ── Hospital name — must be unique across the system ─────────────────────
    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
      validate: { notEmpty: { msg: "Hospital name cannot be empty" } },
    },

    // ── Optional city for display purposes ───────────────────────────────────
    city: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
  },
  {
    tableName: "hospitals",
    timestamps: true, // adds createdAt, updatedAt
    createdAt: "created_at",
    updatedAt: false, // we don't need updatedAt for hospitals
  },
);

module.exports = Hospital;
