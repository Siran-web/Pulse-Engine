// /**
//  * controllers/patientsController.js
//  *
//  * FLOW — getStats:
//  *  resolveHospitalIds → raw SQL COUNT GROUP BY risk_level → return counts
//  *
//  * FLOW — listPatients (doctor/admin):
//  *  1. Resolve hospital IDs from scope
//  *  2. Fetch patients with optional filters (gender, age, risk_level)
//  *  3. Fetch evaluations separately (no FK join possible — composite unique key)
//  *  4. Merge: attach latestEvaluation to each patient
//  *  5. Sort by risk_score DESC (Critical first)
//  *
//  * FLOW — getPatientDetail:
//  *  1. Find patient (hospital-scoped)
//  *  2. Fetch all evaluations + matched_rules for that patient
//  *  3. Fetch historical vitals for trend detection
//  *
//  * FLOW — listInsurancePatients:
//  *  Same as listPatients but attributes restricted — no vitals columns returned
//  */

// const { Op } = require("sequelize");
// const sequelize = require("../db/mysql");

// const Patient = require("../models/Patient");
// const { Evaluation, MatchedRule } = require("../models/Evaluation");
// const Hospital = require("../models/Hospital");
// const HospitalInsurance = require("../models/HospitalInsurance");

// // ══════════════════════════════════════════════════════════════════════════════
// // getStats — GET /api/patients/stats
// // ══════════════════════════════════════════════════════════════════════════════
// const getStats = async (req, res) => {
//   try {
//     const { scope } = req;
//     const context = req.query.context || "doctor";
//     const filterHospitalId = req.query.hospital_id;
//     let hospitalIds = await resolveHospitalIds(scope);

//     if (filterHospitalId) {
//       const idToFilter = Number(filterHospitalId);
//       if (!hospitalIds.includes(idToFilter)) {
//         return res
//           .status(403)
//           .json({ success: false, message: "Unauthorized hospital access" });
//       }
//       hospitalIds = [idToFilter];
//     }

//     if (!hospitalIds.length) {
//       return res.json({
//         success: true,
//         stats: { Low: 0, Medium: 0, High: 0, Critical: 0, Total: 0 },
//       });
//     }

//     const [rows] = await sequelize.query(
//       `
//       SELECT risk_level, COUNT(*) AS count
//       FROM (
//         SELECT e.risk_level, ROW_NUMBER() OVER (PARTITION BY e.patient_id ORDER BY e.evaluated_at DESC) as rn
//         FROM evaluations e
//         INNER JOIN patients p ON e.patient_id = p.patient_id AND e.hospital_id = p.hospital_id
//         WHERE e.hospital_id IN (:hospitalIds) AND e.context = :context
//       ) latest_evals
//       WHERE rn = 1
//       GROUP BY risk_level
//     `,
//       { replacements: { hospitalIds, context } },
//     );

//     const stats = { Low: 0, Medium: 0, High: 0, Critical: 0 };
//     rows.forEach((r) => {
//       stats[r.risk_level] = Number(r.count);
//     });
//     stats.Total = stats.Low + stats.Medium + stats.High + stats.Critical;

//     return res.json({ success: true, stats });
//   } catch (err) {
//     console.error("[patientsController.getStats]", err.message);
//     return res
//       .status(500)
//       .json({ success: false, message: "Failed to fetch stats" });
//   }
// };

// // ══════════════════════════════════════════════════════════════════════════════
// // listPatients — GET /api/patients
// // Query params: context, risk_level, gender, min_age, max_age, page, limit
// // ══════════════════════════════════════════════════════════════════════════════
// const listPatients = async (req, res) => {
//   try {
//     const { scope } = req;
//     const {
//       risk_level,
//       gender,
//       min_age,
//       max_age,
//       search,
//       context = "doctor",
//       page = 1,
//       limit = 1000,
//     } = req.query;

//     const hospitalIds = await resolveHospitalIds(scope);
//     if (!hospitalIds.length)
//       return res.json({ success: true, patients: [], total: 0 });

//     const offset = (Number(page) - 1) * Number(limit);

//     // ── Patient filter ────────────────────────────────────────────────────────
//     const patientWhere = { hospital_id: { [Op.in]: hospitalIds } };
//     if (gender) patientWhere.gender = gender;
//     if (min_age)
//       patientWhere.age = { ...patientWhere.age, [Op.gte]: Number(min_age) };
//     if (max_age)
//       patientWhere.age = { ...patientWhere.age, [Op.lte]: Number(max_age) };
//     if (search) {
//       patientWhere[Op.or] = [
//         { name: { [Op.like]: `%${search}%` } },
//         { patient_id: { [Op.like]: `%${search}%` } }
//       ];
//     }

//     if (risk_level) {
//       const [rows] = await sequelize.query(`
//         SELECT e1.patient_id
//         FROM evaluations e1
//         INNER JOIN (
//             SELECT patient_id, MAX(evaluated_at) as max_at
//             FROM evaluations
//             WHERE hospital_id IN (:hospitalIds) AND context = :context
//             GROUP BY patient_id
//         ) e2 ON e1.patient_id = e2.patient_id AND e1.evaluated_at = e2.max_at
//         WHERE e1.risk_level = :risk_level AND e1.hospital_id IN (:hospitalIds) AND e1.context = :context
//       `, {
//         replacements: { hospitalIds, context, risk_level }
//       });
//       const validIds = rows.map(r => r.patient_id);
//       patientWhere.patient_id = { [Op.in]: validIds.length ? validIds : ['__NONE__'] };
//     }

//     // ── Fetch patients ────────────────────────────────────────────────────────
//     const { count, rows: patients } = await Patient.findAndCountAll({
//       where: patientWhere,
//       include: [
//         { model: Hospital, as: "hospital", attributes: ["id", "name", "city"] },
//       ],
//       limit: Number(limit),
//       offset,
//       order: [["patient_id", "ASC"]],
//       distinct: true,
//     });

//     if (!patients.length)
//       return res.json({
//         success: true,
//         patients: [],
//         total: count,
//         page: Number(page),
//         pages: 0,
//       });

//     // ── Fetch evaluations separately (two-query merge pattern) ────────────────
//     const patientIds = patients.map((p) => p.patient_id);
//     const evalWhere = {
//       patient_id: { [Op.in]: patientIds },
//       hospital_id: { [Op.in]: hospitalIds },
//       context,
//     };

//     const evaluations = await Evaluation.findAll({
//       where: evalWhere,
//       include: [
//         {
//           model: MatchedRule,
//           as: "matchedRules",
//           attributes: ["rule_name", "score_added"],
//         },
//       ],
//       order: [["evaluated_at", "DESC"]],
//     });

//     // ── Build map: "P101_3" → latest evaluation ───────────────────────────────
//     const evalMap = {};
//     evaluations.forEach((e) => {
//       const key = `${e.patient_id}_${e.hospital_id}`;
//       if (!evalMap[key]) evalMap[key] = e;
//     });

//     // ── Merge and sort ────────────────────────────────────────────────────────
//     const merged = patients
//       .map((p) => ({
//         ...p.toJSON(),
//         latestEvaluation:
//           evalMap[`${p.patient_id}_${p.hospital_id}`]?.toJSON() || null,
//       }))
//       .sort(
//         (a, b) =>
//           (b.latestEvaluation?.risk_score || 0) -
//           (a.latestEvaluation?.risk_score || 0),
//       );

//     return res.json({
//       success: true,
//       patients: merged,
//       total: count,
//       page: Number(page),
//       pages: Math.ceil(count / Number(limit)),
//     });
//   } catch (err) {
//     console.error("[patientsController.listPatients]", err.message);
//     return res
//       .status(500)
//       .json({ success: false, message: "Failed to fetch patients" });
//   }
// };

// // ══════════════════════════════════════════════════════════════════════════════
// // getPatientDetail — GET /api/patients/:patientId
// // ══════════════════════════════════════════════════════════════════════════════
// const getPatientDetail = async (req, res) => {
//   try {
//     const { patientId } = req.params;
//     const { scope } = req;
//     const hospitalIds = await resolveHospitalIds(scope);

//     const patient = await Patient.findOne({
//       where: { patient_id: patientId, hospital_id: { [Op.in]: hospitalIds } },
//       include: [
//         { model: Hospital, as: "hospital", attributes: ["id", "name"] },
//       ],
//     });

//     if (!patient)
//       return res
//         .status(404)
//         .json({ success: false, message: `Patient ${patientId} not found` });

//     const evaluations = await Evaluation.findAll({
//       where: { patient_id: patientId, hospital_id: patient.hospital_id },
//       include: [
//         {
//           model: MatchedRule,
//           as: "matchedRules",
//           attributes: ["rule_id", "rule_name", "score_added"],
//         },
//       ],
//       order: [["evaluated_at", "DESC"]],
//     });

//     const [trendRows] = await sequelize.query(
//       `
//       SELECT heart_rate, uploaded_at, upload_run_id
//       FROM   patients
//       WHERE  patient_id = :patientId AND hospital_id = :hospitalId
//       ORDER  BY uploaded_at ASC LIMIT 10
//     `,
//       { replacements: { patientId, hospitalId: patient.hospital_id } },
//     );

//     return res.json({
//       success: true,
//       patient: {
//         ...patient.toJSON(),
//         evaluations,
//         trend: computeTrend(trendRows),
//       },
//     });
//   } catch (err) {
//     console.error("[patientsController.getPatientDetail]", err.message);
//     return res
//       .status(500)
//       .json({ success: false, message: "Failed to fetch patient" });
//   }
// };

// // ══════════════════════════════════════════════════════════════════════════════
// // listInsurancePatients — GET /api/patients/insurance
// // Returns RESTRICTED columns — no clinical vitals
// // ══════════════════════════════════════════════════════════════════════════════
// const listInsurancePatients = async (req, res) => {
//   try {
//     const { scope } = req;
//     const {
//       risk_level,
//       hospital_id: filterHospitalId,
//       search,
//       page = 1,
//       limit = 50,
//     } = req.query;

//     let hospitalIds = await resolveHospitalIds(scope);
//     if (!hospitalIds.length)
//       return res.json({ success: true, patients: [], total: 0 });

//     if (filterHospitalId) {
//       const id = Number(filterHospitalId);
//       if (!hospitalIds.includes(id))
//         return res
//           .status(403)
//           .json({ success: false, message: "Access denied to that hospital" });
//       hospitalIds = [id];
//     }

//     const patientWhere = { hospital_id: { [Op.in]: hospitalIds } };

//     if (search) {
//       patientWhere.patient_id = { [Op.like]: `%${search}%` };
//     }

//     if (risk_level) {
//       const [rows] = await sequelize.query(`
//         SELECT e1.patient_id
//         FROM evaluations e1
//         INNER JOIN (
//             SELECT patient_id, MAX(evaluated_at) as max_at
//             FROM evaluations
//             WHERE hospital_id IN (:hospitalIds) AND context = 'insurance'
//             GROUP BY patient_id
//         ) e2 ON e1.patient_id = e2.patient_id AND e1.evaluated_at = e2.max_at
//         WHERE e1.risk_level = :risk_level AND e1.hospital_id IN (:hospitalIds) AND e1.context = 'insurance'
//       `, {
//         replacements: { hospitalIds, risk_level }
//       });
//       const validIds = rows.map(r => r.patient_id);

//       if (patientWhere.patient_id) {
//         patientWhere.patient_id = {
//           [Op.and]: [
//             patientWhere.patient_id,
//             { [Op.in]: validIds.length ? validIds : ['__NONE__'] }
//           ]
//         };
//       } else {
//         patientWhere.patient_id = { [Op.in]: validIds.length ? validIds : ['__NONE__'] };
//       }
//     }

//     const offset = (Number(page) - 1) * Number(limit);
//     const patients = await Patient.findAll({
//       where: patientWhere,
//       attributes: [
//         "patient_id",
//         "age",
//         "gender",
//         "admission_count",
//         "price",
//         "hospital_id",
//       ], // NO vitals
//       include: [
//         { model: Hospital, as: "hospital", attributes: ["id", "name"] },
//       ],
//       limit: Number(limit),
//       offset,
//       order: [["patient_id", "ASC"]],
//     });

//     if (!patients.length)
//       return res.json({ success: true, patients: [], total: 0 });

//     const patientIds = patients.map((p) => p.patient_id);
//     const evalWhere = {
//       patient_id: { [Op.in]: patientIds },
//       hospital_id: { [Op.in]: hospitalIds },
//       context: "insurance",
//     };

//     const evaluations = await Evaluation.findAll({
//       where: evalWhere,
//       attributes: [
//         "patient_id",
//         "hospital_id",
//         "risk_score",
//         "risk_level",
//         "evaluated_at",
//       ],
//       order: [["evaluated_at", "DESC"]],
//     });

//     const evalMap = {};
//     evaluations.forEach((e) => {
//       const k = `${e.patient_id}_${e.hospital_id}`;
//       if (!evalMap[k]) evalMap[k] = e;
//     });

//     const merged = patients
//       .map((p) => ({
//         ...p.toJSON(),
//         evaluation: evalMap[`${p.patient_id}_${p.hospital_id}`] || null,
//       }))
//       .sort(
//         (a, b) =>
//           (b.evaluation?.risk_score || 0) - (a.evaluation?.risk_score || 0),
//       );

//     const total = await Patient.count({
//       where: patientWhere,
//     });

//     return res.json({
//       success: true,
//       patients: merged,
//       total,
//       page: Number(page),
//       pages: Math.ceil(total / Number(limit)),
//     });
//   } catch (err) {
//     console.error("[patientsController.listInsurancePatients]", err.message);
//     return res
//       .status(500)
//       .json({ success: false, message: "Failed to fetch insurance data" });
//   }
// };

// // ══════════════════════════════════════════════════════════════════════════════
// // listNetworkHospitals — GET /api/patients/network-hospitals
// // Returns all hospitals linked to the scope
// // ══════════════════════════════════════════════════════════════════════════════
// const listNetworkHospitals = async (req, res) => {
//   try {
//     const { scope } = req;
//     const hospitalIds = await resolveHospitalIds(scope);

//     if (!hospitalIds.length) {
//       return res.json({ success: true, hospitals: [] });
//     }

//     const hospitals = await Hospital.findAll({
//       where: { id: { [Op.in]: hospitalIds } },
//       attributes: ["id", "name", "city"]
//     });

//     const [patientCounts] = await sequelize.query(`
//       SELECT hospital_id, COUNT(*) as count
//       FROM patients
//       WHERE hospital_id IN (:hospitalIds)
//       GROUP BY hospital_id
//     `, { replacements: { hospitalIds } });

//     const [criticalCounts] = await sequelize.query(`
//       SELECT e.hospital_id, COUNT(*) as count
//       FROM (
//         SELECT e2.hospital_id, e2.patient_id, e2.risk_level, ROW_NUMBER() OVER (PARTITION BY e2.patient_id ORDER BY e2.evaluated_at DESC) as rn
//         FROM evaluations e2
//         WHERE e2.hospital_id IN (:hospitalIds) AND e2.context = 'insurance'
//       ) e
//       INNER JOIN patients p ON e.patient_id = p.patient_id AND e.hospital_id = p.hospital_id
//       WHERE e.rn = 1 AND e.risk_level = 'Critical'
//       GROUP BY e.hospital_id
//     `, { replacements: { hospitalIds } });

//     const finalHospitals = hospitals.map(h => {
//       const pRow = patientCounts.find(r => r.hospital_id === h.id);
//       const cRow = criticalCounts.find(r => r.hospital_id === h.id);
//       return {
//         ...h.toJSON(),
//         total_patients: pRow ? Number(pRow.count) : 0,
//         critical_cases: cRow ? Number(cRow.count) : 0,
//       };
//     });

//     return res.json({ success: true, hospitals: finalHospitals });
//   } catch (err) {
//     console.error("[patientsController.listNetworkHospitals]", err.message);
//     return res
//       .status(500)
//       .json({ success: false, message: "Failed to fetch network hospitals" });
//   }
// };

// // ══════════════════════════════════════════════════════════════════════════════
// // HELPERS (shared across functions in this controller)
// // ══════════════════════════════════════════════════════════════════════════════
// async function resolveHospitalIds(scope) {
//   if (scope.isSuperAdmin) {
//     const all = await Hospital.findAll({ attributes: ["id"] });
//     return all.map((h) => h.id);
//   }
//   if (scope.isInsurance && scope.insurance_org_id) {
//     const links = await HospitalInsurance.findAll({
//       where: { insurance_org_id: scope.insurance_org_id, active: 1 },
//       attributes: ["hospital_id"],
//     });
//     return links.map((l) => l.hospital_id);
//   }
//   return scope.hospital_id ? [scope.hospital_id] : [];
// }

// function computeTrend(records) {
//   if (!records || records.length < 2)
//     return { direction: "INSUFFICIENT_DATA", readings: records || [] };
//   const first = records[0].heart_rate;
//   const last = records[records.length - 1].heart_rate;
//   return {
//     direction:
//       last > first ? "INCREASING" : last < first ? "DECREASING" : "STABLE",
//     readings: records.map((r) => ({ rate: r.heart_rate, at: r.uploaded_at })),
//   };
// }

// async function deletePatient(req, res) {
//   try {
//     const { patientId } = req.params;
//     const scope = req.scope;
//     if (!scope || !scope.hospital_id) {
//       if (!scope.isSuperAdmin)
//         return res
//           .status(403)
//           .json({ success: false, message: "Unauthorized delete." });
//     }

//     const whereClause = { patient_id: patientId };
//     if (!scope.isSuperAdmin) {
//       whereClause.hospital_id = scope.hospital_id;
//     }

//     const patient = await Patient.findOne({ where: whereClause });
//     if (!patient)
//       return res
//         .status(404)
//         .json({ success: false, message: "Patient not found." });

//     await patient.destroy();
//     await Evaluation.destroy({ where: { patient_id: patientId, hospital_id: whereClause.hospital_id || { [Op.gt]: 0 } } });
//     return res.json({ success: true, message: "Patient deleted." });
//   } catch (error) {
//     console.error("Delete Patient Error:", error.message);
//     res
//       .status(500)
//       .json({ success: false, message: "Server error deleting patient." });
//   }
// }

// async function deleteAllPatients(req, res) {
//   try {
//     const scope = req.scope;
//     if (!scope || !scope.hospital_id) {
//       if (!scope.isSuperAdmin)
//         return res
//           .status(403)
//           .json({ success: false, message: "Unauthorized delete all." });
//     }

//     const whereClause = {};
//     if (!scope.isSuperAdmin) {
//       whereClause.hospital_id = scope.hospital_id;
//     }

//     await Patient.destroy({ where: whereClause });
//     await Evaluation.destroy({ where: whereClause });
//     return res.json({ success: true, message: "All patients deleted." });
//   } catch (error) {
//     console.error("Delete All Patients Error:", error.message);
//     res
//       .status(500)
//       .json({ success: false, message: "Server error deleting all patients." });
//   }
// }

// const deletePatientsByHospital = async (req, res) => {
//   try {
//     const { scope } = req;
//     const hospitalId = Number(req.params.hospitalId);

//     if (!hospitalId) {
//       return res.status(400).json({
//         success: false,
//         message: "Hospital ID is required",
//       });
//     }

//     if (scope.isAdmin && Number(scope.hospital_id) !== hospitalId) {
//       return res.status(403).json({
//         success: false,
//         message: "You can only delete patients for your own hospital.",
//       });
//     }

//     const deletedCount = await Patient.destroy({
//       where: { hospital_id: hospitalId },
//     });

//     await Evaluation.destroy({
//       where: { hospital_id: hospitalId },
//     });

//     return res.json({
//       success: true,
//       message: "Hospital patients deleted successfully",
//       deletedCount,
//     });
//   } catch (err) {
//     console.error("[patientsController.deletePatientsByHospital]", err.message);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to delete hospital patients",
//     });
//   }
// };

// module.exports = {
//   getStats,
//   listPatients,
//   getPatientDetail,
//   listInsurancePatients,
//   deletePatient,
//   deleteAllPatients,
//   deletePatientsByHospital,
//   listNetworkHospitals,
// };

/**
 * controllers/patientsController.js — UPDATED
 *
 * KEY CHANGES FROM OLD VERSION:
 *
 * 1. INSURANCE SCOPING (dual condition):
 *    An insurance company sees a patient only when BOTH are true:
 *      a) HospitalInsurance link is active  (their org ↔ patient's hospital)
 *      b) patient.insurance_id === their insurance_org_id
 *    Either condition alone is NOT enough.
 *
 *    In SQL terms:
 *      WHERE hospital_id IN (
 *              SELECT hospital_id FROM hospital_insurance
 *              WHERE insurance_org_id = ? AND active = 1
 *            )
 *      AND   insurance_id = ?          ← patient must be explicitly registered
 *
 * 2. DECRYPTION:
 *    p.getName(), p.getGender(), p.getPatientId() decrypt on the fly.
 *    Use p.toSafeJSON() which bundles all three into a plain object.
 *    Do NOT use p.toJSON() directly — it returns raw ciphertext.
 *
 * 3. SEARCH:
 *    We cannot do a SQL LIKE on encrypted columns.
 *    Search by unique_id (exact) or by age range instead.
 *    Full-text search on name would require fetching+decrypting all rows
 *    — not feasible at scale. Acceptable limitation for HIPAA compliance.
 *
 * 4. Evaluation FK changed from (patient_id, hospital_id) → unique_id.
 *    All evalMap keys updated accordingly.
 */

"use strict";

const { Op } = require("sequelize");
const sequelize = require("../db/mysql");

const Patient = require("../models/Patient");
const { Evaluation, MatchedRule } = require("../models/Evaluation");
const Hospital = require("../models/Hospital");
const HospitalInsurance = require("../models/HospitalInsurance");

// ══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * resolveHospitalIds
 * Returns the list of hospital IDs that the requester is allowed to query.
 * For insurance role this is every hospital linked (and active) to their org.
 */
async function resolveHospitalIds(scope) {
  if (scope.isSuperAdmin) {
    const all = await Hospital.findAll({ attributes: ["id"] });
    return all.map((h) => h.id);
  }
  if (scope.isInsurance && scope.insurance_org_id) {
    const links = await HospitalInsurance.findAll({
      where: { insurance_org_id: scope.insurance_org_id, active: 1 },
      attributes: ["hospital_id"],
    });
    return links.map((l) => l.hospital_id);
  }
  return scope.hospital_id ? [scope.hospital_id] : [];
}

/**
 * buildInsurancePatientWhere
 * Adds the second condition: patient.insurance_id must match the insurer's id.
 * Used in every query when role === insurance.
 */
function buildInsurancePatientWhere(scope, linkedHospitalIds) {
  return {
    hospital_id: { [Op.in]: linkedHospitalIds },
    insurance_id: scope.insurance_org_id, // ← the critical second gate
  };
}

function computeTrend(records) {
  if (!records || records.length < 2)
    return { direction: "INSUFFICIENT_DATA", readings: records || [] };
  const first = records[0].heart_rate;
  const last = records[records.length - 1].heart_rate;
  return {
    direction:
      last > first ? "INCREASING" : last < first ? "DECREASING" : "STABLE",
    readings: records.map((r) => ({ rate: r.heart_rate, at: r.uploaded_at })),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// getStats — GET /api/patients/stats
// ══════════════════════════════════════════════════════════════════════════════
const getStats = async (req, res) => {
  try {
    const { scope } = req;
    const context = req.query.context || "doctor";
    const filterHospitalId = req.query.hospital_id;

    let hospitalIds = await resolveHospitalIds(scope);
    if (filterHospitalId) {
      const id = Number(filterHospitalId);
      if (!hospitalIds.includes(id))
        return res
          .status(403)
          .json({ success: false, message: "Unauthorized hospital access" });
      hospitalIds = [id];
    }

    if (!hospitalIds.length)
      return res.json({
        success: true,
        stats: { Low: 0, Medium: 0, High: 0, Critical: 0, Total: 0 },
      });

    // For insurance: also restrict to patients registered with their org
    const insuranceJoin = scope.isInsurance
      ? `INNER JOIN patients p ON e.unique_id = p.unique_id AND p.insurance_id = ${scope.insurance_org_id}`
      : `INNER JOIN patients p ON e.unique_id = p.unique_id`;

    const [rows] = await sequelize.query(
      `
      SELECT risk_level, COUNT(*) AS count
      FROM (
        SELECT e.risk_level,
               ROW_NUMBER() OVER (PARTITION BY e.unique_id ORDER BY e.evaluated_at DESC) AS rn
        FROM evaluations e
        ${insuranceJoin}
        WHERE e.hospital_id IN (:hospitalIds) AND e.context = :context
      ) latest
      WHERE rn = 1
      GROUP BY risk_level
      `,
      { replacements: { hospitalIds, context } },
    );

    const stats = { Low: 0, Medium: 0, High: 0, Critical: 0 };
    rows.forEach((r) => {
      stats[r.risk_level] = Number(r.count);
    });
    stats.Total = stats.Low + stats.Medium + stats.High + stats.Critical;

    return res.json({ success: true, stats });
  } catch (err) {
    console.error("[patientsController.getStats]", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch stats" });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// listPatients — GET /api/patients
// Doctors / admins: all patients of their hospital
// Insurance:        only patients where hospital is linked AND insurance_id matches
// ══════════════════════════════════════════════════════════════════════════════

const listPatients = async (req, res) => {
  try {
    const { scope } = req;
    const {
      search, // <--- New search param
      risk_level,
      gender,
      min_age,
      max_age,
      context = "doctor",
      page = 1,
      limit = 12,
    } = req.query;

    const hospitalIds = await resolveHospitalIds(scope);
    if (!hospitalIds.length) {
      return res.json({
        success: true,
        patients: [],
        total: 0,
        page: 1,
        pages: 0,
      });
    }

    const offset = (Number(page) - 1) * Number(limit);

    // ── Build patient WHERE ───────────────────────────────────────────────────
    let patientWhere = {};

    if (scope.isInsurance) {
      patientWhere = buildInsurancePatientWhere(scope, hospitalIds);
    } else {
      patientWhere.hospital_id = { [Op.in]: hospitalIds };
    }

    // Age range filter
    if (min_age)
      patientWhere.age = { ...patientWhere.age, [Op.gte]: Number(min_age) };
    if (max_age)
      patientWhere.age = { ...patientWhere.age, [Op.lte]: Number(max_age) };

    // ── 1. Handle Search Logic (Deterministic Hash) ───────────────────────────
    let searchUids = null;
    if (search && search.trim()) {
      const term = search.trim();
      // Generate possible unique_ids across ALL accessible hospitals
      searchUids = hospitalIds.map((hId) => derivePatientUniqueId(term, hId));
    }

    // ── 2. Handle Risk Level Logic (Subquery) ──────────────────────────────────
    let riskUids = null;
    if (risk_level) {
      const [filtered] = await sequelize.query(
        `
        SELECT e1.unique_id
        FROM evaluations e1
        INNER JOIN (
          SELECT unique_id, MAX(evaluated_at) AS max_at
          FROM evaluations
          WHERE hospital_id IN (:hospitalIds) AND context = :context
          GROUP BY unique_id
        ) e2 ON e1.unique_id = e2.unique_id AND e1.evaluated_at = e2.max_at
        WHERE e1.risk_level = :risk_level
          AND e1.hospital_id IN (:hospitalIds)
          AND e1.context = :context
        `,
        { replacements: { hospitalIds, context, risk_level } },
      );
      riskUids = filtered.map((r) => r.unique_id);
      if (riskUids.length === 0) riskUids = ["__NONE__"];
    }

    // ── 3. Apply Unique ID Filters (Intersect if both present) ─────────────────
    if (searchUids && riskUids) {
      // Both filters active: Patient must match search AND have the specific risk level
      const intersect = searchUids.filter((id) => riskUids.includes(id));
      patientWhere.unique_id = {
        [Op.in]: intersect.length ? intersect : ["__NONE__"],
      };
    } else if (searchUids) {
      patientWhere.unique_id = { [Op.in]: searchUids };
    } else if (riskUids) {
      patientWhere.unique_id = { [Op.in]: riskUids };
    }

    // ── Fetch patients ────────────────────────────────────────────────────────
    const { count, rows: patients } = await Patient.findAndCountAll({
      where: patientWhere,
      include: [
        { model: Hospital, as: "hospital", attributes: ["id", "name", "city"] },
      ],
      limit: Number(limit),
      offset,
      order: [["uploaded_at", "DESC"]],
      distinct: true,
    });

    if (!patients.length) {
      return res.json({
        success: true,
        patients: [],
        total: count,
        page: Number(page),
        pages: 0,
      });
    }

    // ── Fetch latest evaluations ──────────────────────────────────────────────
    const uniqueIdsForEvals = patients.map((p) => p.unique_id);
    const evaluations = await Evaluation.findAll({
      where: {
        unique_id: { [Op.in]: uniqueIdsForEvals },
        hospital_id: { [Op.in]: hospitalIds },
        context,
      },
      include: [
        {
          model: MatchedRule,
          as: "matchedRules",
          attributes: ["rule_name", "score_added"],
        },
      ],
      order: [["evaluated_at", "DESC"]],
    });

    const evalMap = {};
    evaluations.forEach((e) => {
      if (!evalMap[e.unique_id]) evalMap[e.unique_id] = e;
    });

    // ── Merge + decrypt PII ───────────────────────────────────────────────────
    const merged = patients
      .map((p) => ({
        ...p.toSafeJSON(), // Decrypts patient_id, name, gender
        latestEvaluation: evalMap[p.unique_id]?.toJSON() || null,
      }))
      .sort(
        (a, b) =>
          (b.latestEvaluation?.risk_score || 0) -
          (a.latestEvaluation?.risk_score || 0),
      );

    return res.json({
      success: true,
      patients: merged,
      total: count,
      page: Number(page),
      pages: Math.ceil(count / Number(limit)),
    });
  } catch (err) {
    console.error("[patientsController.listPatients]", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch patients" });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// getPatientDetail — GET /api/patients/:uniqueId
// ══════════════════════════════════════════════════════════════════════════════
const getPatientDetail = async (req, res) => {
  try {
    const { uniqueId } = req.params;
    const { scope } = req;
    const hospitalIds = await resolveHospitalIds(scope);

    const patient = await Patient.findOne({
      where: { unique_id: uniqueId },
      include: [
        { model: Hospital, as: "hospital", attributes: ["id", "name"] },
      ],
    });

    if (!patient)
      return res
        .status(404)
        .json({ success: false, message: "Patient not found" });

    // ── Access check ──────────────────────────────────────────────────────────
    if (!hospitalIds.includes(patient.hospital_id)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    // Insurance: additionally check that this patient belongs to their org
    if (scope.isInsurance && patient.insurance_id !== scope.insurance_org_id) {
      return res.status(403).json({
        success: false,
        message: "This patient is not registered with your organisation",
      });
    }

    // ── Evaluations ───────────────────────────────────────────────────────────
    const evaluations = await Evaluation.findAll({
      where: { unique_id: uniqueId },
      include: [
        {
          model: MatchedRule,
          as: "matchedRules",
          attributes: ["rule_id", "rule_name", "score_added"],
        },
      ],
      order: [["evaluated_at", "DESC"]],
    });

    // ── Trend (heart rate across upload runs) ─────────────────────────────────
    const [trendRows] = await sequelize.query(
      `
      SELECT heart_rate, uploaded_at, upload_run_id
      FROM   patients
      WHERE  unique_id = :uniqueId
      ORDER  BY uploaded_at ASC
      LIMIT  10
      `,
      { replacements: { uniqueId } },
    );

    return res.json({
      success: true,
      patient: {
        ...patient.toSafeJSON(),
        evaluations,
        trend: computeTrend(trendRows),
      },
    });
  } catch (err) {
    console.error("[patientsController.getPatientDetail]", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch patient" });
  }
};

const crypto = require("crypto");

// The exact function you provided
function derivePatientUniqueId(plaintextPatientId, hospitalId) {
  const hash = crypto
    .createHash("sha256")
    .update(`${hospitalId}:${String(plaintextPatientId).trim()}`)
    .digest("hex");

  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    "4" + hash.slice(13, 16),
    ((parseInt(hash[16], 16) & 0x3) | 0x8).toString(16) + hash.slice(17, 20),
    hash.slice(20, 32),
  ].join("-");
}

// const listInsurancePatients = async (req, res) => {
//   try {
//     const { scope } = req;
//     if (!scope.isInsurance) {
//       return res
//         .status(403)
//         .json({ success: false, message: "Insurance role required" });
//     }

//     const {
//       risk_level,
//       hospital_id: filterHospitalId,
//       search,
//       page = 1,
//       limit = 50,
//     } = req.query;

//     // Step 1: Resolve linked hospitals
//     let hospitalIds = await resolveHospitalIds(scope);
//     if (!hospitalIds.length)
//       return res.json({ success: true, patients: [], total: 0 });

//     if (filterHospitalId) {
//       const id = Number(filterHospitalId);
//       if (!hospitalIds.includes(id))
//         return res.status(403).json({ message: "Access denied" });
//       hospitalIds = [id];
//     }

//     const patientWhere = buildInsurancePatientWhere(scope, hospitalIds);

//     // Step 2: APPLY YOUR SEARCH LOGIC
//     if (search && search.trim()) {
//       const term = search.trim();

//       // We generate a list of possible unique_ids for THIS patient ID
//       // across ALL hospitals this insurance user can see.
//       const possibleUids = hospitalIds.map((hId) =>
//         derivePatientUniqueId(term, hId),
//       );

//       // Now we search the database for any of those unique_ids
//       patientWhere.unique_id = { [Op.in]: possibleUids };
//     }

//     // Step 3: Risk Level filter
//     if (risk_level) {
//       const [filtered] = await sequelize.query(
//         `SELECT e1.unique_id FROM evaluations e1
//          INNER JOIN (
//            SELECT unique_id, MAX(evaluated_at) AS max_at FROM evaluations
//            WHERE hospital_id IN (:hospitalIds) AND context = 'insurance'
//            GROUP BY unique_id
//          ) e2 ON e1.unique_id = e2.unique_id AND e1.evaluated_at = e2.max_at
//          WHERE e1.risk_level = :risk_level AND e1.hospital_id IN (:hospitalIds)`,
//         { replacements: { hospitalIds, risk_level } },
//       );
//       const uids = filtered.map((r) => r.unique_id);

//       // Merge with existing search filter if applicable
//       if (patientWhere.unique_id) {
//         const searchUids = patientWhere.unique_id[Op.in];
//         const intersected = uids.filter((id) => searchUids.includes(id));
//         patientWhere.unique_id = {
//           [Op.in]: intersected.length ? intersected : ["__NONE__"],
//         };
//       } else {
//         patientWhere.unique_id = { [Op.in]: uids.length ? uids : ["__NONE__"] };
//       }
//     }

//     const offset = (Number(page) - 1) * Number(limit);

//     // Step 4: Fetch Patients (including encrypted columns for decryption)
//     const { count, rows: patients } = await Patient.findAndCountAll({
//       where: patientWhere,
//       attributes: [
//         "unique_id",
//         "insurance_id",
//         "hospital_id",
//         "age",
//         "admission_count",
//         "price",
//         "upload_run_id",
//         "uploaded_at",
//         "patient_id_enc",
//         "gender_enc",
//       ],
//       include: [
//         { model: Hospital, as: "hospital", attributes: ["id", "name"] },
//       ],
//       limit: Number(limit),
//       offset,
//       order: [["uploaded_at", "DESC"]],
//       distinct: true,
//     });

//     // Step 5: Fetch Evaluations and Merge
//     const uniqueIds = patients.map((p) => p.unique_id);
//     const evaluations = await Evaluation.findAll({
//       where: { unique_id: { [Op.in]: uniqueIds }, context: "insurance" },
//     });

//     const evalMap = {};
//     evaluations.forEach((e) => {
//       if (!evalMap[e.unique_id]) evalMap[e.unique_id] = e;
//     });

//     const merged = patients
//       .map((p) => ({
//         ...p.toSafeJSON(), // This decrypts the ID for the UI
//         hospital: p.hospital,
//         evaluation: evalMap[p.unique_id]?.toJSON() || null,
//       }))
//       .sort(
//         (a, b) =>
//           (b.evaluation?.risk_score || 0) - (a.evaluation?.risk_score || 0),
//       );

//     return res.json({
//       success: true,
//       patients: merged,
//       total: count,
//       page: Number(page),
//       pages: Math.ceil(count / Number(limit)),
//     });
//   } catch (err) {
//     console.error("[listInsurancePatients]", err.message);
//     return res
//       .status(500)
//       .json({ success: false, message: "Failed to fetch data" });
//   }
// };

// ══════════════════════════════════════════════════════════════════════════════
// listNetworkHospitals — GET /api/patients/network-hospitals
// ══════════════════════════════════════════════════════════════════════════════

const listInsurancePatients = async (req, res) => {
  try {
    const { scope } = req;
    if (!scope.isInsurance) {
      return res
        .status(403)
        .json({ success: false, message: "Insurance role required" });
    }

    const {
      risk_level,
      hospital_id: filterHospitalId,
      search,
      page = 1,
      limit = 50,
    } = req.query;

    // Step 1: Resolve linked hospitals
    let hospitalIds = await resolveHospitalIds(scope);
    if (!hospitalIds.length)
      return res.json({ success: true, patients: [], total: 0 });

    if (filterHospitalId) {
      const id = Number(filterHospitalId);
      if (!hospitalIds.includes(id))
        return res.status(403).json({ message: "Access denied" });
      hospitalIds = [id];
    }

    const patientWhere = buildInsurancePatientWhere(scope, hospitalIds);

    // Step 2: Search Logic
    if (search && search.trim()) {
      const term = search.trim();
      const possibleUids = hospitalIds.map((hId) =>
        derivePatientUniqueId(term, hId),
      );
      patientWhere.unique_id = { [Op.in]: possibleUids };
    }

    // Step 3: Risk Level filter - STRICT LATEST ONLY
    if (risk_level) {
      const [filtered] = await sequelize.query(
        `SELECT e1.unique_id FROM evaluations e1
         INNER JOIN (
           SELECT unique_id, MAX(evaluated_at) AS max_at FROM evaluations
           WHERE hospital_id IN (:hospitalIds) AND context = 'insurance'
           GROUP BY unique_id
         ) e2 ON e1.unique_id = e2.unique_id AND e1.evaluated_at = e2.max_at
         WHERE e1.risk_level = :risk_level 
           AND e1.context = 'insurance' 
           AND e1.hospital_id IN (:hospitalIds)`,
        { replacements: { hospitalIds, risk_level } },
      );
      const uids = filtered.map((r) => r.unique_id);

      if (patientWhere.unique_id) {
        const searchUids = patientWhere.unique_id[Op.in];
        const intersected = uids.filter((id) => searchUids.includes(id));
        patientWhere.unique_id = {
          [Op.in]: intersected.length ? intersected : ["__NONE__"],
        };
      } else {
        patientWhere.unique_id = { [Op.in]: uids.length ? uids : ["__NONE__"] };
      }
    }

    const offset = (Number(page) - 1) * Number(limit);

    // Step 4: Fetch Patients
    const { count, rows: patients } = await Patient.findAndCountAll({
      where: patientWhere,
      attributes: [
        "unique_id",
        "insurance_id",
        "hospital_id",
        "age",
        "admission_count",
        "price",
        "upload_run_id",
        "uploaded_at",
        "patient_id_enc",
        "gender_enc",
      ],
      include: [
        { model: Hospital, as: "hospital", attributes: ["id", "name"] },
      ],
      limit: Number(limit),
      offset,
      order: [["uploaded_at", "DESC"]],
      distinct: true,
    });

    // Step 5: Fetch Evaluations - ADDED ORDERING TO ENSURE LATEST IS PICKED
    const uniqueIds = patients.map((p) => p.unique_id);
    const evaluations = await Evaluation.findAll({
      where: {
        unique_id: { [Op.in]: uniqueIds },
        context: "insurance",
      },
      order: [["evaluated_at", "DESC"]], // CRITICAL: Latest evaluations first
    });

    const evalMap = {};
    evaluations.forEach((e) => {
      // Since we ordered by DESC, the first time we see a unique_id, it is the latest
      if (!evalMap[e.unique_id]) {
        evalMap[e.unique_id] = e;
      }
    });

    const merged = patients
      .map((p) => ({
        ...p.toSafeJSON(),
        hospital: p.hospital,
        evaluation: evalMap[p.unique_id]?.toJSON() || null,
      }))
      // Final verification: if user filtered by risk_level, double check the mapped evaluation matches
      .filter((p) => {
        if (!risk_level) return true;
        return p.evaluation?.risk_level === risk_level;
      })
      .sort(
        (a, b) =>
          (b.evaluation?.risk_score || 0) - (a.evaluation?.risk_score || 0),
      );

    return res.json({
      success: true,
      patients: merged,
      total: count,
      page: Number(page),
      pages: Math.ceil(count / Number(limit)),
    });
  } catch (err) {
    console.error("[listInsurancePatients]", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch data" });
  }
};

const listNetworkHospitals = async (req, res) => {
  try {
    const { scope } = req;
    const hospitalIds = await resolveHospitalIds(scope);
    if (!hospitalIds.length) return res.json({ success: true, hospitals: [] });

    const hospitals = await Hospital.findAll({
      where: { id: { [Op.in]: hospitalIds } },
      attributes: ["id", "name", "city"],
    });

    // For insurance: only count their registered patients per hospital
    const insuranceFilter = scope.isInsurance
      ? `AND insurance_id = ${scope.insurance_org_id}`
      : "";

    const [patientCounts] = await sequelize.query(
      `SELECT hospital_id, COUNT(DISTINCT unique_id) AS count
       FROM patients
       WHERE hospital_id IN (:hospitalIds) ${insuranceFilter}
       GROUP BY hospital_id`,
      { replacements: { hospitalIds } },
    );

    const [criticalCounts] = await sequelize.query(
      `SELECT e.hospital_id, COUNT(*) AS count
       FROM (
         SELECT e2.hospital_id, e2.unique_id, e2.risk_level,
                ROW_NUMBER() OVER (PARTITION BY e2.unique_id ORDER BY e2.evaluated_at DESC) AS rn
         FROM evaluations e2
         WHERE e2.hospital_id IN (:hospitalIds) AND e2.context = 'insurance'
       ) e
       WHERE e.rn = 1 AND e.risk_level = 'Critical'
       GROUP BY e.hospital_id`,
      { replacements: { hospitalIds } },
    );

    const result = hospitals.map((h) => {
      const pRow = patientCounts.find((r) => r.hospital_id === h.id);
      const cRow = criticalCounts.find((r) => r.hospital_id === h.id);
      return {
        ...h.toJSON(),
        total_patients: pRow ? Number(pRow.count) : 0,
        critical_cases: cRow ? Number(cRow.count) : 0,
      };
    });

    return res.json({ success: true, hospitals: result });
  } catch (err) {
    console.error("[patientsController.listNetworkHospitals]", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch network hospitals" });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// deletePatient — DELETE /api/patients/:uniqueId
// ══════════════════════════════════════════════════════════════════════════════
const deletePatient = async (req, res) => {
  try {
    const { uniqueId } = req.params;
    const { scope } = req;

    const where = { unique_id: uniqueId };
    if (!scope.isSuperAdmin) where.hospital_id = scope.hospital_id;

    const patient = await Patient.findOne({ where });
    if (!patient)
      return res
        .status(404)
        .json({ success: false, message: "Patient not found" });

    // CASCADE on Evaluation FK will clean up evaluations + matched_rules
    await patient.destroy();
    return res.json({ success: true, message: "Patient deleted" });
  } catch (err) {
    console.error("[patientsController.deletePatient]", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Server error deleting patient" });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// deleteAllPatients — DELETE /api/patients  (admin = own hospital only)
// ══════════════════════════════════════════════════════════════════════════════
const deleteAllPatients = async (req, res) => {
  try {
    const { scope } = req;
    const where = scope.isSuperAdmin ? {} : { hospital_id: scope.hospital_id };
    await Patient.destroy({ where });
    // Evaluations CASCADE via FK; if not on DB level, delete explicitly:
    await require("./models/Evaluation").Evaluation.destroy({ where });
    return res.json({ success: true, message: "All patients deleted" });
  } catch (err) {
    console.error("[patientsController.deleteAllPatients]", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// deletePatientsByHospital — DELETE /api/patients/hospital/:hospitalId
// ══════════════════════════════════════════════════════════════════════════════
const deletePatientsByHospital = async (req, res) => {
  try {
    const { scope } = req;
    const hospitalId = Number(req.params.hospitalId);
    if (!hospitalId)
      return res
        .status(400)
        .json({ success: false, message: "Hospital ID required" });

    if (scope.isAdmin && Number(scope.hospital_id) !== hospitalId)
      return res.status(403).json({
        success: false,
        message: "You can only delete your own hospital's patients",
      });

    const deletedCount = await Patient.destroy({
      where: { hospital_id: hospitalId },
    });
    return res.json({
      success: true,
      message: "Hospital patients deleted",
      deletedCount,
    });
  } catch (err) {
    console.error("[patientsController.deletePatientsByHospital]", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to delete hospital patients" });
  }
};

module.exports = {
  getStats,
  listPatients,
  getPatientDetail,
  listInsurancePatients,
  listNetworkHospitals,
  deletePatient,
  deleteAllPatients,
  deletePatientsByHospital,
};
