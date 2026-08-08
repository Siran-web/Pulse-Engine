/**
 * models/User.js — Sequelize Model for `users` table
 *
 * ALL roles (super_admin, admin, doctor, insurance) share this table.
 * Role is NULL at signup — assigned by an approver before account activation.
 *
 * SECURITY NOTE:
 *  Users self-select NOTHING about their role. They only provide:
 *  name, email, password, org_name
 *  The approver (super_admin or hospital admin) sets `role` and `status=active`.
 *
 * RELATIONSHIPS:
 *  User → belongsTo → Hospital      (for admin/doctor roles)
 *  User → belongsTo → InsuranceOrg  (for insurance role)
 *
 * MODULE FLOW:
 *  POST /api/auth/register → create User with status=pending, role=null
 *  GET  /api/users/pending → list users awaiting approval
 *  PUT  /api/users/:id/approve → set role + status=active + send email
 *  PUT  /api/users/:id/reject  → set status=rejected + send email
 *  POST /api/auth/login → verify password, check status=active, issue JWT
 */

const { DataTypes } = require("sequelize");
const sequelize = require("../db/mysql");

const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: { notEmpty: { msg: "Name is required" } },
    },

    email: {
      type: DataTypes.STRING(150),
      allowNull: false,
      unique: true,
      validate: { isEmail: { msg: "Must be a valid email address" } },
    },

    // ── bcrypt hash — raw password is NEVER stored ───────────────────────────
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },

    // ── Role is NULL until an approver sets it ───────────────────────────────
    role: {
      type: DataTypes.ENUM("super_admin", "admin", "doctor", "insurance"),
      allowNull: true,
      defaultValue: null,
    },

    // ── Lifecycle status ─────────────────────────────────────────────────────
    status: {
      type: DataTypes.ENUM("pending", "active", "rejected"),
      defaultValue: "pending",
    },

    // ── hospital_id: set for admin and doctor roles ───────────────────────────
    hospital_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
    },

    // ── insurance_org_id: set for insurance role ─────────────────────────────
    insurance_org_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
    },

    // ── Raw org name entered at signup — used by approver to route to right hospital ──
    org_name: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },

    // ── Tracks which admin approved this account ─────────────────────────────
    approved_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    tableName: "users",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,

    // ── Never return password_hash in JSON responses ─────────────────────────
    defaultScope: {
      attributes: { exclude: ["password_hash"] },
    },

    // ── Named scope to include password_hash (only for login verification) ───
    scopes: {
      withPassword: { attributes: {} }, // empty override → include everything
    },
  },
);

module.exports = User;
