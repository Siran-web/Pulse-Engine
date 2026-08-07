"""
engine/rule_engine.py — Unified rule evaluation with short-circuit AND/OR.

Each rule now has:
  logic:      'AND' | 'OR'
  conditions: [{ field, operator, value }, ...]

Short-circuit:
  AND — return False immediately when first condition fails
  OR  — return True immediately when first condition passes
"""
import pandas as pd

REQUIRED_COLUMNS = {'patient_id_enc', 'name_enc','insurance_id', 'age', 'heart_rate', 'gender_enc',
                    'blood_pressure_sys', 'visit_count', 'admission_count', 'price','blood_pressure_dia'}

SCORE_BANDS = [
    (0,   50,  'Low'),
    (51,  100,  'Medium'),
    (101,  150, 'High'),
    (151, float('inf'), 'Critical')
]

OPERATORS = {
    '>':  lambda a, b: a > b,
    '<':  lambda a, b: a < b,
    '>=': lambda a, b: a >= b,
    '<=': lambda a, b: a <= b,
    '==': lambda a, b: a == b,
    '!=': lambda a, b: a != b,
}


def parse_excel(file_path: str) -> list:
    try:
        df = pd.read_excel(file_path, engine='openpyxl')
    except Exception as e:
        raise ValueError(f'Failed to read Excel file: {e}')

    df.columns = [col.lower().strip().replace(' ', '_').replace('-', '_') for col in df.columns]

    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise ValueError(f'Missing required columns: {", ".join(sorted(missing))}')

    df = df.fillna(0)
    df['patient_id_enc'] = df['patient_id_enc'].astype(str).str.strip()
    df = df[df['patient_id_enc'] != '']
    df = df[df['patient_id_enc'] != '0']

    numeric_cols = ['age','heart_rate','blood_pressure_sys','blood_pressure_dia','visit_count','admission_count']
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0).astype(int)

    return df.to_dict(orient='records')


def _evaluate_conditions(patient: dict, conditions: list, logic: str) -> bool:
    """
    Evaluate a list of conditions against a patient with short-circuit.
    
    AND: returns False on first failing condition (short-circuit)
    OR:  returns True on first passing condition (short-circuit)
    """
    if not conditions:
        return False

    for condition in conditions:
        field     = condition.get('field', '')
        operator  = condition.get('operator', '>')
        threshold = condition.get('value', 0)

        patient_value = float(patient.get(field, 0) or 0)
        op_fn = OPERATORS.get(operator)
        if op_fn is None:
            result = False
        else:
            result = op_fn(patient_value, float(threshold))

        # ── Short-circuit ─────────────────────────────────────────────────────
        if logic == 'AND' and not result:
            return False   # one failure kills the AND chain
        if logic == 'OR' and result:
            return True    # one success satisfies the OR chain

    # AND: all passed → True  |  OR: none passed → False
    return logic == 'AND'


def evaluate_patient(patient: dict, rules: list, composite_rules: list = None) -> dict:
    """
    Evaluate one patient against unified rules.
    
    `composite_rules` param kept for backward compatibility but ignored —
    pass an empty list or omit it when using the new unified schema.
    """
    total_score  = 0
    matched_ids  = []
    matched_info = []
    exp_lines    = []

    patient_id_enc = str(patient.get('patient_id_enc', 'UNKNOWN'))

    for rule in rules:
        logic      = rule.get('logic', 'AND')
        conditions = rule.get('conditions', [])
        score      = rule.get('score', 0)
        rule_id    = str(rule.get('_id', ''))
        rule_name  = rule.get('name', '')

        # ── Evaluate with short-circuit ───────────────────────────────────────
        triggered = _evaluate_conditions(patient, conditions, logic)

        if triggered:
            total_score += score
            matched_ids.append(rule_id)
            matched_info.append({
                'rule_id':    rule_id,
                'rule_name':  rule_name,
                'score_added': score
            })

            template = rule.get('explanation_template', '')
            if template:
                exp_lines.append(f'• {template} (+{score} pts)')
            else:
                # Build default explanation from conditions
                cond_strs = [
                    f"{c.get('field')}={int(float(patient.get(c.get('field', ''), 0) or 0))} "
                    f"{c.get('operator')} {int(float(c.get('value', 0)))}"
                    for c in conditions
                ]
                joined = f' {logic} '.join(cond_strs)
                exp_lines.append(f'• {rule_name}: {joined} (+{score} pts)')

    level = score_to_level(total_score)

    if exp_lines:
        explanation = (
            f'Patient {patient_id_enc} is {level.upper()}.\n'
            f'Matched Rules:\n' + '\n'.join(exp_lines) +
            f'\nTotal Score: {total_score} → Risk Level: {level}'
        )
    else:
        explanation = (
            f'Patient {patient_id_enc} is {level.upper()} (score: {total_score}). '
            f'No rules matched — all vitals within normal range.'
        )

    return {
        'score':         total_score,
        'level':         level,
        'matched':       matched_ids,
        'matched_names': matched_info,
        'explanation':   explanation
    }


def score_to_level(score: int) -> str:
    for low, high, label in SCORE_BANDS:
        if low <= score <= high:
            return label
    return 'Critical'