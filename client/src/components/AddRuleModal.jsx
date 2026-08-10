import { useEffect, useState } from "react";
import axios from "axios";
import { X, Plus, Trash2, Check } from "lucide-react";

const API_BASE = "http://localhost:5001";

const FIELD_OPTIONS = [
    { value: "heart_rate", label: "Heart Rate" },
    { value: "blood_pressure_sys", label: "Blood Pressure (Systolic)" },
    { value: "blood_pressure_dia", label: "Blood Pressure (Diastolic)" },
    { value: "spo2", label: "Oxygen Saturation (SpO2)" },
    { value: "temperature", label: "Temperature" },
    { value: "age", label: "Age" },
    { value: "visit_count", label: "Visit Count" },
    { value: "admission_count", label: "Admission Count" },
    { value: "price", label: "Cost" },
];

const OPERATOR_OPTIONS = [
    { value: ">", label: ">" },
    { value: ">=", label: ">=" },
    { value: "<", label: "<" },
    { value: "<=", label: "<=" },
    { value: "==", label: "==" },
    { value: "!=", label: "!=" },
];

const EMPTY_CONDITION = { field: "", operator: ">=", value: "" };

const getAllowedContexts = (role) => {
    if (role === "super_admin") {
        return [
            { value: "doctor", label: "Doctor" },
            { value: "admin", label: "Admin" },
            { value: "insurance", label: "Insurance" },
        ];
    }

    return [
        { value: "doctor", label: "Doctor" },
        { value: "admin", label: "Admin" },
    ];
};

const getDefaultForm = (role) => ({
    name: "",
    logic: "AND",
    conditions: [{ ...EMPTY_CONDITION }],
    score: "",
    explanation_template: "",
    context: role === "super_admin" ? ["doctor", "admin", "insurance"] : ["doctor", "admin"],
    scope: role === "admin" ? "hospital-specific" : "global",
    hospital_id: null,
});

export default function AddRuleModal({ isOpen, role, onClose, onSuccess }) {
    const [form, setForm] = useState(getDefaultForm(role));
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const allowedContexts = getAllowedContexts(role);

    useEffect(() => {
        if (isOpen) {
            setForm(getDefaultForm(role));
            setError("");
            setLoading(false);
        }
    }, [isOpen, role]);

    if (!isOpen) return null;

    const updateCondition = (index, field, value) => {
        const updated = form.conditions.map((c, i) =>
            i === index ? { ...c, [field]: value } : c
        );
        setForm({ ...form, conditions: updated });
    };

    const addCondition = () => {
        setForm({ ...form, conditions: [...form.conditions, { ...EMPTY_CONDITION }] });
    };

    const removeCondition = (index) => {
        if (form.conditions.length === 1) return;
        setForm({ ...form, conditions: form.conditions.filter((_, i) => i !== index) });
    };

    const toggleContext = (ctx) => {
        setForm((prev) => {
            const exists = prev.context.includes(ctx);
            const nextContext = exists
                ? prev.context.filter((c) => c !== ctx)
                : [...prev.context, ctx];

            return { ...prev, context: nextContext };
        });
    };

    const handleSubmit = async () => {
        setError("");

        if (!form.name.trim()) {
            setError("Rule name is required.");
            return;
        }

        if (!form.context || form.context.length === 0) {
            setError("Please select at least one context.");
            return;
        }

        for (let i = 0; i < form.conditions.length; i++) {
            const c = form.conditions[i];
            if (!c.field) {
                setError(`Condition ${i + 1}: select a vital field.`);
                return;
            }
            if (c.value === "" || isNaN(Number(c.value))) {
                setError(`Condition ${i + 1}: enter a numeric threshold.`);
                return;
            }
        }

        if (!form.score || isNaN(Number(form.score))) {
            setError("Risk score must be a number.");
            return;
        }

        const payload = {
            name: form.name.trim(),
            logic: form.logic,
            conditions: form.conditions.map((c) => ({
                field: c.field,
                operator: c.operator,
                value: Number(c.value),
            })),
            score: Number(form.score),
            context: Array.from(new Set(form.context)),
            scope: form.scope,
            hospital_id: form.hospital_id,
            explanation_template: form.explanation_template.trim(),
        };

        try {
            setLoading(true);
            const token = localStorage.getItem("token");

            const res = await axios.post(`${API_BASE}/api/rules`, payload, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (res.data.success) {
                setForm(getDefaultForm(role));
                onSuccess?.();
            } else {
                setError(res.data.message || "Failed to create rule.");
            }
        } catch (err) {
            setError(err.response?.data?.message || err.message || "Failed to create rule.");
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setForm(getDefaultForm(role));
        setError("");
        setLoading(false);
        onClose?.();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between px-8 pt-8 pb-0 shrink-0">
                    <div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">New Risk Rule</h2>
                        <p className="text-xs text-slate-400 font-medium mt-0.5">
                            Define when this rule fires and how much risk score it adds.
                        </p>
                    </div>
                    <button
                        onClick={handleClose}
                        className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="overflow-y-auto flex-1 px-8 py-6 space-y-6">
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                            Rule Name
                        </label>
                        <input
                            type="text"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            placeholder="e.g. Critical Hypertension"
                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all shadow-sm"
                        />
                    </div>

                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                            Rule Context
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {allowedContexts.map((opt) => {
                                const active = form.context.includes(opt.value);

                                return (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => toggleContext(opt.value)}
                                        className={`flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border text-sm font-black uppercase tracking-widest transition-all ${active
                                            ? "bg-slate-900 text-white border-slate-900 shadow-lg"
                                            : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                                            }`}
                                    >
                                        <span>{opt.label}</span>
                                        <span
                                            className={`w-5 h-5 rounded-full flex items-center justify-center border ${active
                                                ? "bg-white text-slate-900 border-white"
                                                : "bg-transparent border-slate-300"
                                                }`}
                                        >
                                            {active && <Check className="w-3 h-3" />}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1.5 px-1">
                            {role === "super_admin"
                                ? "Super admin can assign the rule to doctor, admin, and insurance."
                                : "Hospital admin can assign the rule only to doctor and admin."}
                        </p>
                    </div>

                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                            Condition Logic
                        </label>
                        <div className="inline-flex rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                            {["AND", "OR"].map((opt) => (
                                <button
                                    key={opt}
                                    type="button"
                                    onClick={() => setForm({ ...form, logic: opt })}
                                    className={`px-6 py-2.5 text-xs font-black uppercase tracking-widest transition-colors ${form.logic === opt
                                        ? "bg-slate-900 text-white"
                                        : "bg-white text-slate-500 hover:bg-slate-50"
                                        }`}
                                >
                                    {opt === "AND" ? "Match ALL (AND)" : "Match ANY (OR)"}
                                </button>
                            ))}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1.5 px-1">
                            {form.logic === "AND"
                                ? "All conditions below must match for this rule to fire."
                                : "Any single condition below is enough to fire this rule."}
                        </p>
                    </div>

                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">
                            Conditions
                        </label>
                        <div className="space-y-2">
                            {form.conditions.map((condition, index) => (
                                <div
                                    key={index}
                                    className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3"
                                >
                                    <select
                                        value={condition.field}
                                        onChange={(e) => updateCondition(index, "field", e.target.value)}
                                        className="flex-1 min-w-0 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                                    >
                                        <option value="">Select vital...</option>
                                        {FIELD_OPTIONS.map((f) => (
                                            <option key={f.value} value={f.value}>
                                                {f.label}
                                            </option>
                                        ))}
                                    </select>

                                    <select
                                        value={condition.operator}
                                        onChange={(e) => updateCondition(index, "operator", e.target.value)}
                                        className="w-20 shrink-0 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-black text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                                    >
                                        {OPERATOR_OPTIONS.map((o) => (
                                            <option key={o.value} value={o.value}>
                                                {o.label}
                                            </option>
                                        ))}
                                    </select>

                                    <input
                                        type="number"
                                        value={condition.value}
                                        onChange={(e) => updateCondition(index, "value", e.target.value)}
                                        placeholder="Threshold"
                                        className="w-28 shrink-0 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                                    />

                                    <button
                                        type="button"
                                        onClick={() => removeCondition(index)}
                                        disabled={form.conditions.length === 1}
                                        className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-rose-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>

                        <button
                            type="button"
                            onClick={addCondition}
                            className="mt-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors py-1 px-1"
                        >
                            <Plus className="w-3 h-3" />
                            Add condition
                        </button>
                    </div>

                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                            Risk Score Added
                        </label>
                        <input
                            type="number"
                            value={form.score}
                            onChange={(e) => setForm({ ...form, score: e.target.value })}
                            placeholder="e.g. 50"
                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400"
                        />
                        <p className="text-[11px] text-slate-400 mt-1.5 px-1">
                            Bands: 0–50 Low · 51–100 Medium · 101–150 High · 151+ Critical
                        </p>
                    </div>

                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                            Clinical Reasoning <span className="font-medium normal-case tracking-normal">(optional)</span>
                        </label>
                        <textarea
                            rows={3}
                            value={form.explanation_template}
                            onChange={(e) => setForm({ ...form, explanation_template: e.target.value })}
                            placeholder="Hypertensive crisis detected. Requires immediate review."
                            className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-400 transition-all resize-none placeholder:text-slate-300"
                        />
                    </div>

                    {error && (
                        <p className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-4 py-3">
                            {error}
                        </p>
                    )}
                </div>

                <div className="flex gap-3 px-8 pb-8 pt-2 shrink-0">
                    <button
                        type="button"
                        onClick={handleClose}
                        className="flex-1 py-4 text-[12px] font-black text-slate-500 uppercase tracking-widest hover:bg-slate-50 rounded-2xl transition-all border border-slate-200"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={loading}
                        className="flex-[2] py-4 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white text-[12px] font-black uppercase tracking-widest rounded-2xl shadow-lg transition-all"
                    >
                        {loading ? "Saving..." : "Create Rule"}
                    </button>
                </div>
            </div>
        </div>
    );
}