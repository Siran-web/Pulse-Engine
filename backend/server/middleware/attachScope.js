/**
 * middleware/attachScope.js — Data Scope Injection Middleware
 *
 * THE MOST CRITICAL SECURITY MIDDLEWARE IN THE SYSTEM.
 *
 * MODULE FLOW:
 *  1. Reads hospital_id, insurance_org_id, role from req.user (set by verifyToken)
 *  2. Attaches them to req.scope
 *  3. Every route handler uses req.scope.hospital_id in its WHERE clause
 *  4. The frontend NEVER dictates which hospital's data is returned
 *
 * WHY THIS EXISTS:
 *  Without this, a malicious user could send:
 *    GET /api/patients?hospital_id=2
 *  and see another hospital's patients.
 *  With attachScope, every query is automatically scoped to the token's hospital.
 *
 * ROLE-BASED SCOPE RULES:
 *  super_admin  → hospital_id = null (can see everything; routes handle this)
 *  admin        → hospital_id = their hospital (from JWT)
 *  doctor       → hospital_id = their hospital (from JWT)
 *  insurance    → insurance_org_id used; hospital_ids resolved at query time
 *                 from hospital_insurance bridge table
 *
 * MUST BE USED AFTER verifyToken:
 *  router.get('/patients', verifyToken, attachScope, handler)
 */

/**
 * attachScope — extracts scope identifiers from JWT payload into req.scope
 */
const attachScope = (req, res, next) => {
  const { userId, role, hospital_id, insurance_org_id } = req.user;

  // Build the scope object — all route handlers read from here
  req.scope = {
    userId,
    role,

    // ── hospital_id is null for super_admin and insurance roles ──────────
    hospital_id: hospital_id || null,

    // ── insurance_org_id is null for all non-insurance roles ─────────────
    insurance_org_id: insurance_org_id || null,

    // ── Convenience flags for cleaner route logic ─────────────────────────
    isSuperAdmin: role === "super_admin",
    isAdmin: role === "admin",
    isDoctor: role === "doctor",
    isInsurance: role === "insurance",
  };

  next();
};

/**
 * buildHospitalFilter — helper used inside route handlers
 *
 * Returns a Sequelize WHERE clause fragment based on the user's scope.
 * - super_admin → no filter (can see all hospitals)
 * - admin/doctor → { hospital_id: req.scope.hospital_id }
 * - insurance → handled separately (multi-hospital subquery)
 *
 * USAGE IN ROUTE:
 *  const filter = buildHospitalFilter(req.scope);
 *  const patients = await Patient.findAll({ where: filter });
 */
const buildHospitalFilter = (scope) => {
  if (scope.isSuperAdmin) {
    return {}; // no hospital_id filter — super_admin sees everything
  }
  if (scope.hospital_id) {
    return { hospital_id: scope.hospital_id };
  }
  // Insurance and unscoped: caller must resolve hospital_ids separately
  return {};
};

module.exports = { attachScope, buildHospitalFilter };
