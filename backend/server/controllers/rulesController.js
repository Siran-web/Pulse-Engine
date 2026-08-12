/**
 * controllers/rulesController.js
 * All rules are now unified — conditions[] + logic field handles AND/OR.
 */
const { Rule } = require("../models/Rule");

const listRules = async (req, res) => {
  try {
    const { scope } = req;
    const { active } = req.query;

    const filter = {
      $or: [
        { scope: "global" },
        { scope: "hospital-specific", hospital_id: scope.hospital_id },
      ],
    };

    if (active === "true") filter.active = true;
    if (active === "false") filter.active = false;

    const rules = await Rule.find(filter).sort({ score: -1 });
    return res.json({ success: true, count: rules.length, rules });
  } catch (err) {
    console.error("[rulesController.listRules]", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch rules" });
  }
};

const createRule = async (req, res) => {
  try {
    const { scope } = req;
    const { name, logic, conditions, score, context, explanation_template } =
      req.body;

    // ── Validate ──────────────────────────────────────────────────────────────
    if (!name || !conditions?.length || score === undefined || !context) {
      return res.status(400).json({
        success: false,
        message: "Required: name, conditions[], score, context",
      });
    }

    for (const c of conditions) {
      if (!c.field || !c.operator || c.value === undefined) {
        return res.status(400).json({
          success: false,
          message: "Each condition requires field, operator, value",
        });
      }
    }

    // ── Scope resolution ─────────────────────────────────────────────────────
    let ruleScope = "hospital-specific";
    let hospital_id = scope.hospital_id;

    if (scope.isSuperAdmin) {
      ruleScope = req.body.scope || "global";
      hospital_id =
        ruleScope === "global" ? null : req.body.hospital_id || null;
    }

    const rule = await Rule.create({
      name: name.trim(),
      logic: logic || "AND",
      conditions: conditions.map((c) => ({
        field: c.field,
        operator: c.operator,
        value: Number(c.value),
      })),
      score: Number(score),
      context: Array.isArray(context) ? context : [context],
      scope: ruleScope,
      hospital_id,
      active: true,
      explanation_template: explanation_template || "",
    });

    return res
      .status(201)
      .json({ success: true, message: "Rule created", rule });
  } catch (err) {
    console.error("[rulesController.createRule]", err.message);
    if (err.name === "ValidationError")
      return res.status(400).json({ success: false, message: err.message });
    return res
      .status(500)
      .json({ success: false, message: "Failed to create rule" });
  }
};

const updateRule = async (req, res) => {
  try {
    const { scope } = req;
    const rule = await Rule.findById(req.params.id);
    if (!rule)
      return res
        .status(404)
        .json({ success: false, message: "Rule not found" });

    if (scope.isAdmin && rule.scope === "global") {
      return res
        .status(403)
        .json({ success: false, message: "Admins cannot modify global rules" });
    }

    const allowed = [
      "name",
      "logic",
      "conditions",
      "score",
      "context",
      "active",
      "explanation_template",
    ];
    const updates = {};
    allowed.forEach((k) => {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    });

    const updated = await Rule.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    return res.json({ success: true, message: "Rule updated", rule: updated });
  } catch (err) {
    console.error("[rulesController.updateRule]", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update rule" });
  }
};

const toggleRuleStatus = async (req, res) => {
  try {
    const { scope } = req;

    const rule = await Rule.findById(req.params.id);
    if (!rule) {
      return res
        .status(404)
        .json({ success: false, message: "Rule not found" });
    }

    if (scope.isAdmin && rule.scope === "global") {
      return res
        .status(403)
        .json({ success: false, message: "Admins cannot modify global rules" });
    }

    rule.active = !rule.active;
    await rule.save();

    return res.json({
      success: true,
      message: `Rule ${rule.active ? "enabled" : "disabled"} successfully`,
      rule,
    });
  } catch (err) {
    console.error("[rulesController.toggleRuleStatus]", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to toggle rule status" });
  }
};

const deleteRule = async (req, res) => {
  try {
    const { scope } = req;
    const rule = await Rule.findById(req.params.id);
    if (!rule) {
      return res
        .status(404)
        .json({ success: false, message: "Rule not found" });
    }

    if (scope.isAdmin && rule.scope === "global") {
      return res
        .status(403)
        .json({ success: false, message: "Admins cannot delete global rules" });
    }

    if (
      scope.isAdmin &&
      rule.hospital_id &&
      rule.hospital_id !== scope.hospital_id
    ) {
      return res
        .status(403)
        .json({ success: false, message: "Unauthorized to delete this rule" });
    }

    await Rule.findByIdAndDelete(req.params.id);
    return res.json({ success: true, message: "Rule deleted" });
  } catch (err) {
    console.error("[rulesController.deleteRule]", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to delete rule" });
  }
};

module.exports = {
  listRules,
  createRule,
  updateRule,
  deleteRule,
  toggleRuleStatus,
};
