"""
engine/time_evaluator.py — Time-Based (Multi-Run) Patient Evaluation

PURPOSE:
  Instead of evaluating a patient on their CURRENT reading alone,
  time-based evaluation looks at the LAST 3 upload runs and uses the
  WORST CASE value for each vital field.

  Why this matters:
    A patient with heart_rate 110 today may have had 125 last month.
    Without time-based evaluation, they'd score lower today and might be
    missed as High risk. With worst-case, 125 is used → correctly flagged.

MODULE FLOW:
  get_worst_case(records):
    1. Receive list of patient records from last N upload runs
    2. For each vital field, take the maximum value across all records
    3. Set trend flag: INCREASING if last reading > first reading
    4. Return a single merged dict representing the worst-case patient

  group_by_patient(records):
    1. Group a flat list of records by patient_id
    2. Return dict: { patient_id → [record1, record2, ...] }
    3. Each sublist is sorted by upload_run_id (chronological order)

USAGE:
  Called from engine/app.py POST /evaluate-records endpoint.
  Node.js fetches last 3 distinct upload_run_ids from MySQL,
  then sends all patient records from those runs to Python.
  Python groups them per patient and computes worst-case before evaluation.

TREND FLAGS:
  INCREASING  — last heart_rate reading > first (worsening)
  DECREASING  — last heart_rate reading < first (improving)
  STABLE      — no change in heart_rate across runs
  SINGLE_READ — only one record available (no trend possible)
"""

from collections import defaultdict


# ── Fields to compute worst-case (maximum) across runs ───────────────────────
WORST_CASE_FIELDS = [
    'heart_rate',
    'blood_pressure_sys',
    'blood_pressure_dia',
    'age',
    'visit_count',
    'admission_count'
]


def get_worst_case(records: list) -> dict:
    """
    Compute the worst-case values across multiple records for one patient.

    Args:
        records: List of patient record dicts for the SAME patient,
                 sorted chronologically (oldest first).
                 Each dict has patient vitals + upload_run_id field.

    Returns:
        A single merged patient dict where each vital field holds
        the maximum value seen across all records.
        Also includes 'trend' key.

    Example:
        Input records (3 uploads for patient P101):
          [ {heart_rate: 95, age: 64, ...},
            {heart_rate: 110, age: 64, ...},
            {heart_rate: 128, age: 65, ...} ]

        Output (worst-case):
          { heart_rate: 128, age: 65, ..., trend: 'INCREASING' }
    """
    if not records:
        return {}

    # Take the most recent record as the base (has all fields including name, gender)
    base = dict(records[-1])

    # ── Compute worst-case (maximum) for each vital field ─────────────────────
    for field in WORST_CASE_FIELDS:
        values = [
            float(r.get(field, 0) or 0)
            for r in records
        ]
        # Use max across all historical records for this field
        base[field] = int(max(values)) if values else 0

    # ── Compute trend based on heart_rate across runs ─────────────────────────
    base['trend'] = compute_trend(records)

    # ── Record how many runs were used for this evaluation ────────────────────
    base['runs_evaluated'] = len(records)

    return base


def compute_trend(records: list) -> str:
    """
    Determine if the patient's heart rate trend is increasing or stable.

    Args:
        records: Chronologically sorted list of patient records

    Returns:
        'INCREASING'  — risk is worsening (last HR > first HR)
        'DECREASING'  — patient improving (last HR < first HR)
        'STABLE'      — no change in heart rate
        'SINGLE_READ' — only one record, no trend possible
    """
    if len(records) < 2:
        return 'SINGLE_READ'

    first_hr = float(records[0].get('heart_rate', 0) or 0)
    last_hr  = float(records[-1].get('heart_rate', 0) or 0)

    if last_hr > first_hr:
        return 'INCREASING'
    elif last_hr < first_hr:
        return 'DECREASING'
    else:
        return 'STABLE'


def group_by_patient(records: list) -> dict:
    """
    Group a flat list of mixed patient records by patient_id.

    Used when Node.js sends records from multiple upload runs in one batch.
    Each patient_id gets a list of their records sorted by upload_run_id
    so chronological order is maintained.

    Args:
        records: Flat list of patient dicts from multiple upload runs.
                 Each record must have 'patient_id' and 'upload_run_id'.

    Returns:
        Dict mapping patient_id (str) → sorted list of that patient's records.

    Example:
        Input: [
            { patient_id: 'P101', heart_rate: 95, upload_run_id: 'run_1' },
            { patient_id: 'P202', heart_rate: 80, upload_run_id: 'run_1' },
            { patient_id: 'P101', heart_rate: 128, upload_run_id: 'run_2' }
        ]
        Output: {
            'P101': [
                { patient_id: 'P101', heart_rate: 95, upload_run_id: 'run_1' },
                { patient_id: 'P101', heart_rate: 128, upload_run_id: 'run_2' }
            ],
            'P202': [
                { patient_id: 'P202', heart_rate: 80, upload_run_id: 'run_1' }
            ]
        }
    """
    grouped = defaultdict(list)

    for record in records:
        pid = str(record.get('patient_id_enc', '')).strip()
        if pid:
            grouped[pid].append(record)

    # Sort each patient's records by upload_run_id (chronological order)
    # upload_run_id format: 'run_<timestamp>_admin<id>' — sorts correctly lexicographically
    for pid in grouped:
        grouped[pid].sort(key=lambda r: r.get('upload_run_id', ''))

    return dict(grouped)