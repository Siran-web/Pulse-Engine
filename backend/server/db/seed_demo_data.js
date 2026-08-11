/**
 * db/seed_demo_data.js — Demo Data Seeder
 * 
 * PURPOSE:
 *  Seeds the database with realistic patient data and evaluations 
 *  so the dashboard is "impressive" immediately.
 */

require("dotenv").config();
const sequelize = require("./mysql");
const Patient = require("../models/Patient");
const { Evaluation, MatchedRule } = require("../models/Evaluation");

const DEMO_PATIENTS = [
  { patient_id: "P101", hospital_id: 1, name: "Dr. Rajesh Kumar", age: 65, gender: "Male", heart_rate: 135, blood_pressure_sys: 170, blood_pressure_dia: 95, admission_count: 4, visit_count: 8 },
  { patient_id: "P102", hospital_id: 1, name: "Sarah Williams", age: 42, gender: "Female", heart_rate: 88, blood_pressure_sys: 122, blood_pressure_dia: 80, admission_count: 0, visit_count: 2 },
  { patient_id: "P103", hospital_id: 1, name: "Michael Chen", age: 72, gender: "Male", heart_rate: 110, blood_pressure_sys: 155, blood_pressure_dia: 90, admission_count: 2, visit_count: 5 },
  { patient_id: "P104", hospital_id: 1, name: "Priya Sharma", age: 28, gender: "Female", heart_rate: 72, blood_pressure_sys: 115, blood_pressure_dia: 75, admission_count: 1, visit_count: 3 },
  { patient_id: "P105", hospital_id: 1, name: "Anand Deshmukh", age: 58, gender: "Male", heart_rate: 125, blood_pressure_sys: 162, blood_pressure_dia: 98, admission_count: 3, visit_count: 6 },
  { patient_id: "P106", hospital_id: 1, name: "Elena Rodriguez", age: 35, gender: "Female", heart_rate: 95, blood_pressure_sys: 130, blood_pressure_dia: 85, admission_count: 0, visit_count: 1 },
  { patient_id: "P107", hospital_id: 1, name: "John Smith", age: 80, gender: "Male", heart_rate: 140, blood_pressure_sys: 180, blood_pressure_dia: 105, admission_count: 5, visit_count: 12 },
  { patient_id: "P108", hospital_id: 1, name: "Meera Nair", age: 50, gender: "Female", heart_rate: 105, blood_pressure_sys: 145, blood_pressure_dia: 88, admission_count: 1, visit_count: 4 },
  { patient_id: "P109", hospital_id: 1, name: "Kevin Varma", age: 62, gender: "Male", heart_rate: 115, blood_pressure_sys: 150, blood_pressure_dia: 92, admission_count: 2, visit_count: 7 },
  { patient_id: "P110", hospital_id: 1, name: "Sofia Gupta", age: 45, gender: "Female", heart_rate: 132, blood_pressure_sys: 168, blood_pressure_dia: 102, admission_count: 3, visit_count: 5 },
];

const EVALUATIONS = [
  { patient_id: "P101", context: "doctor", risk_score: 180, risk_level: "Critical", explanation: "Critical Risk Detected: Patient is elderly with severely elevated heart rate and hypertension." },
  { patient_id: "P102", context: "doctor", risk_score: 20, risk_level: "Low", explanation: "Normal clinical profile. Routine monitoring advised." },
  { patient_id: "P103", context: "doctor", risk_score: 110, risk_level: "High", explanation: "High Risk: Senior patient with uncontrolled hypertension and elevated heart rate." },
  { patient_id: "P104", context: "doctor", risk_score: 15, risk_level: "Low", explanation: "Stable vitals. No immediate clinical concerns." },
  { patient_id: "P105", context: "doctor", risk_score: 140, risk_level: "Critical", explanation: "Critical Risk: High heart rate combined with stage 2 hypertension and multiple previous admissions." },
  { patient_id: "P106", context: "doctor", risk_score: 45, risk_level: "Medium", explanation: "Moderate Risk: Borderline heart rate. Follow-up diagnostic suggested." },
  { patient_id: "P107", context: "doctor", risk_score: 220, risk_level: "Critical", explanation: "SEVERE RISK: Extreme hypertension (180/105) and high heart rate (140) in elderly patient." },
  { patient_id: "P108", context: "doctor", risk_score: 75, risk_level: "High", explanation: "High Risk: Consistent hypertension and rising visit frequency." },
  { patient_id: "P109", context: "doctor", risk_score: 95, risk_level: "High", explanation: "High Risk: Senior patient showing cardiovascular stress indicators." },
  { patient_id: "P110", context: "doctor", risk_score: 165, risk_level: "Critical", explanation: "Critical Risk: Acute tachycardia (132 bpm) and hypertension in middle-aged patient." },
];

async function seed() {
  try {
    await sequelize.authenticate();
    console.log("✅ MySQL Connected");

    // Clear existing data to avoid PK conflicts in demo
    await Evaluation.destroy({ where: { hospital_id: 1 } });
    await Patient.destroy({ where: { hospital_id: 1 } });
    console.log("🗑 Cleared existing patients for Hospital 1");

    // Seed Patients
    const patients = await Patient.bulkCreate(DEMO_PATIENTS);
    console.log(`✅ Seeded ${patients.length} demo patients`);

    // Seed Evaluations
    for (const ev of EVALUATIONS) {
      const evaluation = await Evaluation.create({
        ...ev,
        hospital_id: 1,
      });

      // Add dummy matched rules
      if (ev.risk_level === "Critical" || ev.risk_level === "High") {
        await MatchedRule.create({
          evaluation_id: evaluation.id,
          rule_name: "Tachycardia Detected (>120 bpm)",
          score_added: 50
        });
        await MatchedRule.create({
          evaluation_id: evaluation.id,
          rule_name: "Hypertension Stage 2",
          score_added: 80
        });
      } else if (ev.risk_level === "Medium") {
        await MatchedRule.create({
          evaluation_id: evaluation.id,
          rule_name: "Borderline Heart Rate",
          score_added: 30
        });
      } else {
        await MatchedRule.create({
          evaluation_id: evaluation.id,
          rule_name: "Routine Monitoring",
          score_added: 0
        });
      }
    }
    console.log("✅ Seeded demo evaluations and matched rules");

    process.exit(0);
  } catch (err) {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  }
}

seed();
