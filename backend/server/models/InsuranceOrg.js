/**
 * models/InsuranceOrg.js — Sequelize Model for `insurance_orgs` table
 *
 * RELATIONSHIPS:
 *  InsuranceOrg → hasMany  → User             (insurance users belong to an org)
 *  InsuranceOrg → belongsToMany → Hospital    (via HospitalInsurance bridge)
 *
 * MODULE FLOW:
 *  Created by super_admin via POST /api/hospitals/insurance-orgs
 *  Linked to hospitals via POST /api/hospitals/insurance-link
 *  insurance_org_id is embedded in JWT for insurance users
 *  All patient queries for insurance role resolve accessible hospital_ids
 *  from the hospital_insurance bridge table at query time
 */

const { DataTypes } = require("sequelize");
const sequelize = require("../db/mysql");

const InsuranceOrg = sequelize.define(
  "InsuranceOrg",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    // ── Organisation name (e.g. "Star Health", "HDFC Ergo") ─────────────────
    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
      validate: { notEmpty: { msg: "Insurance org name cannot be empty" } },
    },
  },
  {
    tableName: "insurance_orgs",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
  },
);

module.exports = InsuranceOrg;
