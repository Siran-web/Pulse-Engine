const { Op } = require("sequelize");
const crypto = require("crypto");
const sequelize = require("../db/mysql");
const { Groq } = require("groq-sdk");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || "YOUR_GROQ_API_KEY",
});

const Patient = require("../models/Patient");
const { Evaluation, MatchedRule } = require("../models/Evaluation");
const { Rule } = require("../models/Rule");
const Hospital = require("../models/Hospital");
const HospitalInsurance = require("../models/HospitalInsurance");

/**
 * Helper: Derive the Deterministic Blind Index (unique_id)
 */
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

const handleChat = async (req, res) => {
  try {
    const { query, history = [] } = req.body;
    if (!query)
      return res
        .status(400)
        .json({ success: false, message: "Query is required" });

    const { scope } = req;
    const q = query.toLowerCase().trim();
    const hospitalIds = await resolveHospitalIds(scope);
    const context = scope.isInsurance ? "insurance" : "doctor";

    // 1. IMPROVED ID EXTRACTION
    const idRegex = /([a-z0-9-]+)/gi;
    const words = query.split(/\s+/);
    let pid = null;

    for (const word of words) {
      if (word.match(/[0-9]/) && word.length >= 2) {
        pid = word.replace(/[?,.!]/g, "").toUpperCase();
        break;
      }
    }

    // 2. Generate possible unique_ids
    let possibleUids = [];
    if (pid) {
      possibleUids = hospitalIds.map((hId) => derivePatientUniqueId(pid, hId));
    }

    // ── Pattern 1: Why is Patient ID at risk ───────────────────────────────────────
    if (
      pid &&
      (q.includes("why") || q.includes("reason") || q.includes("risk"))
    ) {
      const ev = await Evaluation.findOne({
        where: {
          unique_id: { [Op.in]: possibleUids },
          context,
        },
        order: [["evaluated_at", "DESC"]],
      });

      if (!ev) {
        console.log(`Debug: Searched for ${pid} using UIDs:`, possibleUids);
        return res.json({
          success: true,
          response: `I found ID "${pid}", but there is no evaluation record for them in the ${context} context.`,
        });
      }

      return res.json({
        success: true,
        response: `Patient ${pid} is ${ev.risk_level.toUpperCase()} risk (score: ${ev.risk_score}).\n\n${ev.explanation}`,
      });
    }

    // ── Pattern 2: Vitals (Doctor only) ──────────────────────────────
    if (
      pid &&
      (q.includes("vital") ||
        q.includes("heart") ||
        q.includes("bp") ||
        q.includes("stat"))
    ) {
      if (scope.isInsurance) {
        return res.json({
          success: true,
          response: "Insurance users cannot access clinical vitals.",
        });
      }

      const patient = await Patient.findOne({
        where: {
          unique_id: { [Op.in]: possibleUids },
          hospital_id: { [Op.in]: hospitalIds },
        },
      });

      if (!patient) {
        return res.json({
          success: true,
          response: `Patient ${pid} not found in your hospital records.`,
        });
      }
      return res.json({ success: true, response: formatVitals(patient) });
    }

    // ── Pattern 3: List by Risk Level (Strict Mapping) ─────────────────────────
    const levelMatch = q.match(/\b(critical|high|medium|low)\b/i);
    if (
      levelMatch &&
      (q.includes("list") || q.includes("show") || q.includes("who is"))
    ) {
      const level =
        levelMatch[1].charAt(0).toUpperCase() +
        levelMatch[1].slice(1).toLowerCase();

      const evals = await Evaluation.findAll({
        where: {
          hospital_id: { [Op.in]: hospitalIds },
          risk_level: level,
          context,
        },
        limit: 10,
        order: [["evaluated_at", "DESC"]],
      });

      if (!evals.length) {
        return res.json({
          success: true,
          response: `No ${level} risk patients found.`,
        });
      }

      const foundUids = evals.map((e) => e.unique_id);
      const patients = await Patient.findAll({
        where: { unique_id: { [Op.in]: foundUids } },
      });

      const list = patients
        .map((p) => {
          const data = p.toSafeJSON();
          const ev = evals.find((e) => e.unique_id === p.unique_id);
          return `${data.patient_id} (Score: ${ev?.risk_score || "N/A"})`;
        })
        .join(", ");

      return res.json({
        success: true,
        response: `Here are the latest ${level} risk patients: ${list}`,
      });
    }

    // ── Pattern 4: Counts (Always reliable) ───────────────────────────────────
    if (q.includes("how many") || q.includes("count") || q.includes("total")) {
      const [rows] = await sequelize.query(
        `SELECT risk_level, COUNT(*) AS count FROM evaluations 
         WHERE hospital_id IN (:hospitalIds) AND context = :context 
         AND id IN (SELECT MAX(id) FROM evaluations GROUP BY unique_id, context)
         GROUP BY risk_level`,
        { replacements: { hospitalIds, context } },
      );
      const c = { Low: 0, Medium: 0, High: 0, Critical: 0 };
      rows.forEach((r) => {
        c[r.risk_level] = Number(r.count);
      });
      return res.json({
        success: true,
        response: `In your network: ${c.Critical} Critical, ${c.High} High, ${c.Medium} Medium, and ${c.Low} Low risk patients.`,
      });
    }

    // ── Pattern 7 & Fallback: Groq AI ───────────────────────────────────────
    if (pid) {
      const aiResponse = await callGroqWithContext(
        pid,
        possibleUids,
        hospitalIds,
        context,
        query,
        scope,
        history,
      );
      return res.json({ success: true, response: aiResponse });
    }

    const genericResponse = await callGroqGeneric(query, history);
    return res.json({ success: true, response: genericResponse });
  } catch (err) {
    console.error("[chatController]", err);
    return res.status(500).json({ success: false, message: "Chatbot error" });
  }
};

// ── GROQ AI HELPER FUNCTIONS ────────────────────────────────────────────────

async function callGroqWithContext(
  pid,
  possibleUids,
  hospitalIds,
  context,
  userQuery,
  scope,
  history,
) {
  const patient = await Patient.findOne({
    where: {
      unique_id: { [Op.in]: possibleUids },
      hospital_id: { [Op.in]: hospitalIds },
    },
  });

  const ev = patient
    ? await Evaluation.findOne({
        where: { unique_id: patient.unique_id, context },
        order: [["evaluated_at", "DESC"]],
      })
    : null;

  let ctx = `[CONTEXT FOR PATIENT ${pid}]:\n`;
  if (patient) {
    const safeData = patient.toSafeJSON();
    if (!scope.isInsurance) {
      ctx += `Demographics: age=${safeData.age}, gender=${safeData.gender}. Vitals: HR=${safeData.heart_rate}, BP=${safeData.blood_pressure_sys}/${safeData.blood_pressure_dia}. `;
    }
    if (ev)
      ctx += `Risk: Score=${ev.risk_score} (Level: ${ev.risk_level}). Summary: ${ev.explanation}`;
  }

  const systemPrompt = `You are a medical assistant. Use this context: ${ctx}. Base your answer ONLY on this data. If asked about ${pid}, provide a concise summary.`;
  return callGroqAPI(systemPrompt, userQuery, history);
}

// MISSING FUNCTION ADDED HERE
async function callGroqGeneric(query, history) {
  const systemPrompt = `You are a specialized medical risk assistant for a hospital system. Answer in 2-3 sentences.
STRICTLY REFUSE to answer any questions that are not related to medicine, healthcare, patients, risk evaluation, hospital administration, or your capabilities as a medical AI.
If the user's question is unrelated to these topics, you must reply: "I can only assist with medical, patient risk, and hospital administration queries."`;
  return callGroqAPI(systemPrompt, query, history);
}

async function callGroqAPI(systemPrompt, userQuery, history = []) {
  try {
    const messages = [{ role: "system", content: systemPrompt }];
    history.slice(-5).forEach((msg) => {
      messages.push({
        role: msg.role === "ai" ? "assistant" : "user",
        content: msg.content,
      });
    });
    messages.push({ role: "user", content: userQuery });

    const completion = await groq.chat.completions.create({
      messages,
      // Llama 3.3 70B is currently the most stable high-performance model on Groq
      model: "llama-3.3-70b-versatile",
      temperature: 0.5,
    });
    return completion.choices[0]?.message?.content || "No response.";
  } catch (err) {
    console.error("[Groq API Error]", err);

    // Fallback logic: If 70B fails, try the smaller, faster 8B model automatically
    try {
      const fallback = await groq.chat.completions.create({
        messages,
        model: "llama-3.1-8b-instant",
        temperature: 0.5,
      });
      return fallback.choices[0]?.message?.content || "No response.";
    } catch (fallbackErr) {
      return "AI service temporarily unavailable. Please try again later.";
    }
  }
}

// ── UTILITY FUNCTIONS ───────────────────────────────────────────────────────

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

function formatVitals(p) {
  const data = p.toSafeJSON();
  return `Vitals for ${data.patient_id} (${data.name}):\n• Age: ${data.age}\n• Heart Rate: ${data.heart_rate} bpm\n• BP: ${data.blood_pressure_sys}/${data.blood_pressure_dia} mmHg`;
}

module.exports = { handleChat };
