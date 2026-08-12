"use strict";

const crypto = require("crypto");
const pythonService = require("../services/pythonService");
const Patient = require("../models/Patient");
const { Evaluation, MatchedRule } = require("../models/Evaluation");
const Hospital = require("../models/Hospital");
const sequelize = require("../db/mysql");

// ══════════════════════════════════════════════════════════════════════════════
// derivePatientUniqueId
//
// Generates a stable, hospital-scoped UUID from the plaintext patient identifier.
//
// WHY DETERMINISTIC?
//   - Same patient re-uploaded by the same hospital → same UUID → bulkCreate
//     triggers updateOnDuplicate → vitals updated, no duplicate rows.
//   - Same patient_id in a different hospital → different UUID (hospital_id is
//     part of the hash input) → completely separate rows, zero cross-contamination.
//   - UUID is never read from Excel/Python → no way for one hospital's UUID to
//     accidentally end up in another hospital's upload.
//
// FORMAT: standard UUID v4 layout (version nibble set to 4, variant bits set)
// ══════════════════════════════════════════════════════════════════════════════
function derivePatientUniqueId(plaintextPatientId, hospitalId) {
  const hash = crypto
    .createHash("sha256")
    .update(`${hospitalId}:${String(plaintextPatientId).trim()}`)
    .digest("hex");

  // Overlay UUID v4 version and variant bits for RFC-4122 compliance
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    "4" + hash.slice(13, 16), // version 4
    ((parseInt(hash[16], 16) & 0x3) | 0x8).toString(16) + hash.slice(17, 20), // variant 10xx
    hash.slice(20, 32),
  ].join("-");
}

// ══════════════════════════════════════════════════════════════════════════════
// uploadFile — POST /api/upload
// ══════════════════════════════════════════════════════════════════════════════
const uploadFile = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    // ── 1. Validate file ──────────────────────────────────────────────────────
    if (!req.file) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message:
          'No file uploaded. Add a file field named "file" in form-data.',
      });
    }

    const { scope } = req;
    const filePath = req.file.path;

    // ── 2. Resolve hospital ID ────────────────────────────────────────────────
    // admin/doctor → from JWT scope (never from request body)
    // super_admin  → must pass hospital_id explicitly in form-data body
    let hospitalId = scope.hospital_id;
    if (!hospitalId && scope.isSuperAdmin) {
      hospitalId = req.body.hospital_id ? Number(req.body.hospital_id) : null;
    }

    if (!hospitalId) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: scope.isSuperAdmin
          ? "super_admin must include hospital_id in form-data body."
          : "Your account has no hospital assigned. Contact super_admin.",
      });
    }

    // ── 3. Verify hospital exists ─────────────────────────────────────────────
    const hospital = await Hospital.findByPk(hospitalId);
    if (!hospital) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: `Hospital id=${hospitalId} does not exist.`,
      });
    }

    const upload_run_id = `run_${Date.now()}_admin${scope.userId}`;
    console.log(
      `📤  Upload started | hospital="${hospital.name}" (id=${hospitalId}) | run=${upload_run_id}`,
    );

    // ── 4. Call Python rule engine for all 3 contexts in parallel ─────────────
    const [doctorResults, adminResults, insuranceResults] = await Promise.all([
      pythonService.evaluate(filePath, "doctor", hospitalId, upload_run_id),
      pythonService.evaluate(filePath, "admin", hospitalId, upload_run_id),
      pythonService.evaluate(filePath, "insurance", hospitalId, upload_run_id),
    ]);

    console.log(
      `🐍  Python evaluated ${doctorResults.length} patients × 3 contexts`,
    );

    // ── 5. Build patient rows with server-side encryption and UUID ────────────
    //
    // CRITICAL: Python returns Excel column names as-is after snake_case
    // normalisation. The encrypted PII fields in the Excel are named:
    //   patient_id_enc, name_enc, gender_enc
    // These hold the PLAINTEXT values from the sheet — the "enc" suffix is just
    // the Excel column header, NOT pre-encrypted data. We encrypt them here.
    //
    // unique_id is ALWAYS derived server-side from (hospitalId, plaintext_patient_id).
    // It is never read from the Excel or from Python results.
    //
    const patientRows = doctorResults.map((p) => {
      // ── Read plaintext values from Python (using the correct field names) ────
      const plainPatientId = String(p.patient_id_enc || "").trim(); // FIX: was p.patient_id
      const plainName = String(p.name_enc || "").trim(); // FIX: was p.name
      const plainGender = String(p.gender_enc || "").trim(); // FIX: was p.gender

      // ── Encrypt PII via model prototype setters ───────────────────────────
      const instance = Patient.build({});
      instance.setPatientId(plainPatientId);
      instance.setName(plainName);
      instance.setGender(plainGender);

      // ── Derive a stable, hospital-scoped UUID ─────────────────────────────
      // FIX: was `p.unique_id || uuidv4()` — never trust UUID from Excel/Python
      const uniqueId = derivePatientUniqueId(plainPatientId, hospitalId);

      return {
        unique_id: uniqueId,
        patient_id_enc: instance.getDataValue("patient_id_enc"),
        name_enc: instance.getDataValue("name_enc"),
        gender_enc: instance.getDataValue("gender_enc"),
        hospital_id: hospitalId, // always from JWT scope
        insurance_id: p.insurance_id ? Number(p.insurance_id) : null,
        age: Number(p.age) || 0,
        heart_rate: Number(p.heart_rate) || 0,
        blood_pressure_sys: Number(p.blood_pressure_sys) || 0,
        blood_pressure_dia: Number(p.blood_pressure_dia) || 0,
        visit_count: Number(p.visit_count) || 0,
        admission_count: Number(p.admission_count) || 0,
        price: p.price ? Number(p.price) : null,
        upload_run_id,
      };
    });

    // ── 6. Bulk upsert patients ───────────────────────────────────────────────
    // Unique index on unique_id:
    //   - NEW patient for this hospital → INSERT
    //   - SAME patient re-uploaded by SAME hospital (same unique_id) → UPDATE vitals
    //   - SAME patient_id in DIFFERENT hospital → different unique_id → INSERT new row
    //
    // hospital_id is intentionally excluded from updateOnDuplicate —
    // it must NEVER change once a patient row is created.
    await Patient.bulkCreate(patientRows, {
      updateOnDuplicate: [
        "patient_id_enc",
        "name_enc",
        "gender_enc",
        "age",
        "heart_rate",
        "blood_pressure_sys",
        "blood_pressure_dia",
        "visit_count",
        "admission_count",
        "price",
        "insurance_id",
        "upload_run_id",
      ],
      transaction,
    });

    // ── 7. Build lookup: plaintext_patient_id → unique_id ─────────────────────
    // FIX: was using r.unique_id (always undefined) to link evaluations to patients.
    // Now we re-derive the same deterministic UUID from the same inputs.
    // Since all three context result arrays come from the same Excel rows in the
    // same order, the lookup is valid for all three.
    const uniqueIdByPatientId = {};
    doctorResults.forEach((p) => {
      const plainPatientId = String(p.patient_id_enc || "").trim();
      uniqueIdByPatientId[plainPatientId] = derivePatientUniqueId(
        plainPatientId,
        hospitalId,
      );
    });

    // ── 8. Insert evaluations + matched_rules for all 3 contexts ─────────────
    const contexts = [
      { context: "doctor", results: doctorResults },
      { context: "admin", results: adminResults },
      { context: "insurance", results: insuranceResults },
    ];

    for (const { context, results } of contexts) {
      for (const r of results) {
        // FIX: was `r.unique_id` (undefined from Python) — now use the lookup map
        const plainPatientId = String(r.patient_id_enc || "").trim();
        const patientUniqueId = uniqueIdByPatientId[plainPatientId];

        if (!patientUniqueId) {
          console.warn(
            `⚠️  Skipping evaluation for unknown patient_id_enc="${r.patient_id_enc}" (context=${context})`,
          );
          continue;
        }

        const evaluation = await Evaluation.create(
          {
            unique_id: patientUniqueId, // FIX: proper FK to patients.unique_id
            hospital_id: hospitalId,
            context,
            risk_score: r.score || 0,
            risk_level: r.level || "Low",
            explanation: r.explanation || "",
          },
          { transaction },
        );

        if (r.matched_names?.length) {
          await MatchedRule.bulkCreate(
            r.matched_names.map((m) => ({
              evaluation_id: evaluation.id,
              rule_id: m.rule_id || null,
              rule_name: m.rule_name || "",
              score_added: m.score_added || 0,
            })),
            { transaction },
          );
        }
      }
    }

    // ── 9. Commit ─────────────────────────────────────────────────────────────
    await transaction.commit();
    console.log(
      `✅  Upload complete | ${patientRows.length} patients saved to "${hospital.name}"`,
    );

    return res.status(201).json({
      success: true,
      message: "Upload and evaluation complete",
      hospital: { id: hospitalId, name: hospital.name },
      upload_run_id,
      patients_count: patientRows.length,
      summary: {
        doctor: summarise(doctorResults),
        admin: summarise(adminResults),
        insurance: summarise(insuranceResults),
      },
    });
  } catch (err) {
    await transaction.rollback();
    console.error("[uploadController.uploadFile]", err.message);

    if (err.message?.includes("Python")) {
      return res.status(503).json({ success: false, message: err.message });
    }
    return res
      .status(500)
      .json({ success: false, message: "Upload failed: " + err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// getHistory — GET /api/upload/history
// ══════════════════════════════════════════════════════════════════════════════
const getHistory = async (req, res) => {
  try {
    const { scope } = req;
    const whereClause = scope.isSuperAdmin
      ? ""
      : "WHERE hospital_id = :hospitalId";

    const [rows] = await sequelize.query(
      `
      SELECT upload_run_id, hospital_id,
             COUNT(DISTINCT unique_id) AS patient_count,
             MIN(uploaded_at)          AS upload_time
      FROM   patients
      ${whereClause}
      GROUP  BY upload_run_id, hospital_id
      ORDER  BY upload_time DESC
      LIMIT  30
      `,
      { replacements: { hospitalId: scope.hospital_id } },
    );

    return res.json({ success: true, history: rows });
  } catch (err) {
    console.error("[uploadController.getHistory]", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch upload history" });
  }
};

// ── Helper: count results by risk level ──────────────────────────────────────
function summarise(results) {
  return results.reduce(
    (acc, r) => {
      acc[r.level] = (acc[r.level] || 0) + 1;
      return acc;
    },
    { Low: 0, Medium: 0, High: 0, Critical: 0 },
  );
}

module.exports = { uploadFile, getHistory };
