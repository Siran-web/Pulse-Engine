/**
 * models/Rule.js — Unified Rule Schema
 *
 * Replaces both `rules` + `composite_rules` collections.
 * Each rule has a `conditions[]` array + `logic` (AND/OR).
 * Single conditions are just arrays of length 1.
 */
const mongoose = require("mongoose");

const ConditionSchema = new mongoose.Schema(
  {
    field: {
      type: String,
      required: true,
      enum: [
        "heart_rate",
        "blood_pressure_sys",
        "blood_pressure_dia",
        "spo2",
        "temperature",
        "age",
        "visit_count",
        "admission_count",
        "price",
      ],
    },
    operator: {
      type: String,
      required: true,
      enum: [">", "<", ">=", "<=", "==", "!="],
    },
    value: { type: Number, required: true },
  },
  { _id: false },
);

const RuleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    // AND = all conditions must match, OR = any one condition must match
    logic: { type: String, enum: ["AND", "OR"], default: "AND" },

    // At least one condition required
    conditions: {
      type: [ConditionSchema],
      validate: {
        validator: (v) => v.length > 0,
        message: "At least one condition is required",
      },
    },

    score: { type: Number, required: true, min: 0 },
    context: {
      type: [String],
      enum: ["doctor", "admin", "insurance"],
      default: ["doctor", "admin", "insurance"],
    },
    scope: {
      type: String,
      enum: ["global", "hospital-specific"],
      default: "global",
    },
    hospital_id: { type: Number, default: null },
    active: { type: Boolean, default: true },
    explanation_template: { type: String, default: "" },
  },
  {
    collection: "rules",
    timestamps: true,
  },
);

module.exports = { Rule: mongoose.model("Rule", RuleSchema) };
