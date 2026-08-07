"""
engine/app.py — Python Flask Rule Engine Entry Point

MODULE FLOW:
  POST /evaluate:
    1. Receive JSON: { file_path, context, hospital_id, run_id }
    2. parse_excel(file_path) → list of patient dicts
    3. get_rules(context, hospital_id) → (simple_rules, composite_rules) from MongoDB
    4. For each patient: evaluate_patient(patient, simple_rules, composite_rules)
       → { score, level, matched, matched_names, explanation }
    5. Merge patient data + evaluation → return JSON array

  GET /health:
    Returns { status: 'ok' } for Node.js health check

  POST /evaluate-records:
    Accepts raw patient records (list of dicts) instead of a file path.
    Used for time-based evaluation where Node.js pre-fetches historical records.

STARTUP:
  cd engine
  pip install -r requirements.txt
  python app.py
  # Runs on http://localhost:8000
"""

from dotenv import load_dotenv
import os

load_dotenv()  # loads engine/.env automatically
from flask import Flask, request, jsonify
from flask_cors import CORS

from rule_engine    import parse_excel, evaluate_patient, score_to_level
from mongo_client   import get_rules
from time_evaluator import get_worst_case

app = Flask(__name__)
CORS(app)   # Allow requests from Node.js (localhost:5000)


# ──────────────────────────────────────────────────────────────────────────────
# GET /health — liveness check for Node.js healthCheck() call
# ──────────────────────────────────────────────────────────────────────────────

@app.route('/health', methods=['GET'])
def health():
    return jsonify({ 'status': 'ok', 'service': 'Patient Evaluation Rule Engine' })


# ──────────────────────────────────────────────────────────────────────────────
# POST /evaluate — main evaluation endpoint
#
# Request body:
#   {
#     "file_path":   "/absolute/path/to/file.xlsx",
#     "context":     "doctor" | "admin" | "insurance",
#     "hospital_id": 3,
#     "run_id":      "run_1700000000_admin42"   (optional)
#   }
#
# Response:
#   [
#     {
#       "patient_id": "P101",
#       "name": "Rajesh Kumar",
#       "age": 65,
#       ... (all patient fields),
#       "score": 180,
#       "level": "Critical",
#       "matched": ["<mongoId1>", "<mongoId2>"],
#       "matched_names": [
#         { "rule_id": "...", "rule_name": "Senior Patient", "score_added": 50 }
#       ],
#       "explanation": "Patient P101 is CRITICAL. ..."
#     },
#     ...
#   ]
# ──────────────────────────────────────────────────────────────────────────────

@app.route('/evaluate', methods=['POST'])
def evaluate():
    try:
        data        = request.get_json(force=True)
        file_path   = data.get('file_path')
        context     = data.get('context',     'doctor')
        hospital_id = data.get('hospital_id', None)
        run_id      = data.get('run_id',      None)

        # ── Validate required fields ─────────────────────────────────────────
        if not file_path:
            return jsonify({ 'error': 'file_path is required' }), 400

        if context not in ('doctor', 'admin', 'insurance'):
            return jsonify({ 'error': f'Invalid context: {context}' }), 400

        # ── Step 1: Parse Excel file into list of patient dicts ───────────────
        patients = parse_excel(file_path)

        if not patients:
            return jsonify({ 'error': 'No valid patient records found in file' }), 400

        # ── Step 2: Fetch rules from MongoDB for this context + hospital ───────
        # simple_rules, composite_rules = get_rules(context, hospital_id)

        rules = get_rules(context, hospital_id)
        # ── Step 3: Evaluate each patient against all rules ───────────────────
        results = []
        for patient in patients:
            evaluation = evaluate_patient(patient, rules)
            results.append({ **patient, **evaluation })


        return jsonify(results), 200

    except FileNotFoundError as e:
        return jsonify({ 'error': f'File not found: {str(e)}' }), 404
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({ 'error': str(e) }), 500


# ──────────────────────────────────────────────────────────────────────────────
# POST /evaluate-records — evaluate pre-fetched patient records (no file)
# Used by time-based evaluation: Node.js passes last 3 runs' records,
# Python computes worst-case and evaluates against rules.
#
# Request body:
#   {
#     "records":     [ { ...patient fields... }, ... ],   (historical records)
#     "context":     "doctor",
#     "hospital_id": 3
#   }
# ──────────────────────────────────────────────────────────────────────────────

@app.route('/evaluate-records', methods=['POST'])
def evaluate_records():
    try:
        data        = request.get_json(force=True)
        records     = data.get('records', [])
        context     = data.get('context', 'doctor')
        hospital_id = data.get('hospital_id', None)

        if not records:
            return jsonify({ 'error': 'records array is required' }), 400

        # ── Group records by patient_id ───────────────────────────────────────
        from collections import defaultdict
        grouped = defaultdict(list)
        for r in records:
            grouped[str(r.get('patient_id', ''))].append(r)

        # ── Fetch rules ───────────────────────────────────────────────────────
        # simple_rules, composite_rules = get_rules(context, hospital_id)
        rules = get_rules(context, hospital_id)
        # ── For each patient: compute worst-case vitals across all runs ────────
        results = []
        for patient_id, patient_records in grouped.items():
            worst_case = get_worst_case(patient_records)
            evaluation = evaluate_patient(worst_case, rules)
            results.append({ **worst_case, **evaluation })

        return jsonify(results), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({ 'error': str(e) }), 500


# ──────────────────────────────────────────────────────────────────────────────
# MAIN
# ──────────────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    print('')
    print('═══════════════════════════════════════════════')
    print('  Patient Evaluation Engine — Python Flask')
    print('  Running on http://localhost:8000')
    print('═══════════════════════════════════════════════')
    print('')
    app.run(host='0.0.0.0', port=8000, debug=True)