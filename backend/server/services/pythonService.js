/**
 * services/pythonService.js — Node.js → Python Flask Bridge
 *
 * MODULE FLOW:
 *  1. Admin uploads Excel → upload.js route saves file via Multer
 *  2. upload.js calls pythonService.evaluate() with filePath + context + hospitalId
 *  3. This service POSTs to the Python Flask /evaluate endpoint
 *  4. Flask runs parse_excel() → fetch_rules() → evaluate_patient() for each row
 *  5. Returns an array of { patient_id, score, level, matched, explanation, ... }
 *  6. upload.js saves evaluation results to MySQL evaluations table
 *
 * The Python engine runs as a SEPARATE PROCESS on port 8000.
 * It must be started before Node.js (or Node.js will return 503).
 *
 * ERROR HANDLING:
 *  If Python is down, upload returns a 503 with a clear message.
 *  Partial failure (some patients fail) — Python handles internally and
 *  returns score=0 with explanation="evaluation_error" for failed patients.
 */

const axios = require("axios");

// ── Base URL for the Python Flask engine ─────────────────────────────────────
const PYTHON_URL = process.env.PYTHON_SERVICE_URL || "http://localhost:8000";

// ── Timeout: 2 minutes — large Excel files may take time to evaluate ──────────
const TIMEOUT_MS = 120_000;

/**
 * evaluate — calls Python /evaluate to score all patients in a file
 *
 * @param {string} filePath   - absolute path to the uploaded Excel file on disk
 * @param {string} context    - 'doctor' | 'admin' | 'insurance'
 * @param {number} hospitalId - the hospital these patients belong to
 * @param {string} [runId]    - upload_run_id for time-based evaluation
 * @returns {Array} results   - array of evaluated patient objects
 *
 * Each result object shape:
 * {
 *   patient_id: 'P101',
 *   name: 'Rajesh Kumar',
 *   age: 65,
 *   heart_rate: 128,
 *   ...vitals,
 *   score: 180,
 *   level: 'Critical',
 *   matched: ['<mongoId1>', '<mongoId2>'],
 *   matched_names: [{ rule_id, rule_name, score_added }],
 *   explanation: 'Patient P101 is CRITICAL. Matched Rules: ...'
 * }
 */
const evaluate = async (filePath, context, hospitalId, runId = null) => {
  try {
    const payload = {
      file_path: filePath,
      context: context,
      hospital_id: hospitalId,
      run_id: runId,
    };

    const response = await axios.post(`${PYTHON_URL}/evaluate`, payload, {
      timeout: TIMEOUT_MS,
      headers: { "Content-Type": "application/json" },
    });

    return response.data; // array of evaluated patient results
  } catch (err) {
    // ── Python engine is not running ─────────────────────────────────────
    if (err.code === "ECONNREFUSED") {
      throw new Error(
        "Python rule engine is not running. Start it with: cd engine && python app.py",
      );
    }

    // ── Python returned an error response ─────────────────────────────────
    if (err.response) {
      throw new Error(
        `Python engine error [${err.response.status}]: ${
          err.response.data?.error || "Unknown error"
        }`,
      );
    }

    // ── Timeout or network error ──────────────────────────────────────────
    throw new Error(`Failed to reach Python engine: ${err.message}`);
  }
};

/**
 * healthCheck — verify the Python engine is alive
 * Called by GET /api/health to report system status
 *
 * @returns {{ alive: boolean, message: string }}
 */
const healthCheck = async () => {
  try {
    const res = await axios.get(`${PYTHON_URL}/health`, { timeout: 5000 });
    return { alive: true, message: res.data?.status || "ok" };
  } catch {
    return { alive: false, message: "Python engine unreachable" };
  }
};

module.exports = { evaluate, healthCheck };
