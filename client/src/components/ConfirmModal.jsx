import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, CheckCircle, Info } from 'lucide-react';

export default function ConfirmModal({ isOpen, title, message, type = 'confirm', onConfirm, onClose, confirmText = 'Confirm', cancelText = 'Cancel' }) {
    if (!isOpen) return null;

    const isAlert = type !== 'confirm';

    const Icon = type === 'error' ? AlertTriangle : type === 'success' ? CheckCircle : type === 'confirm' ? AlertTriangle : Info;
    const iconColor = type === 'error' ? 'text-rose-500 bg-rose-50 border-rose-100' : type === 'success' ? 'text-emerald-500 bg-emerald-50 border-emerald-100' : type === 'confirm' ? 'text-amber-500 bg-amber-50 border-amber-100' : 'text-blue-500 bg-blue-50 border-blue-100';
    const confirmButtonColor = type === 'error' ? 'bg-rose-600 hover:bg-rose-700' : type === 'success' ? 'bg-emerald-600 hover:bg-emerald-700' : type === 'confirm' ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'bg-slate-900 hover:bg-slate-800 text-white';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden"
            >
                <div className="p-8 text-center pb-6">
                    <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center border-2 mb-5 ${iconColor}`}>
                        <Icon className="w-8 h-8" />
                    </div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight mb-2">{title}</h2>
                    <p className="text-sm font-medium text-slate-500 leading-relaxed">
                        {message}
                    </p>
                </div>

                <div className="flex gap-3 px-8 pb-8 pt-2 shrink-0">
                    {!isAlert && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3.5 text-[12px] font-black text-slate-500 uppercase tracking-widest hover:bg-slate-50 rounded-2xl transition-all border border-slate-200"
                        >
                            {cancelText}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => {
                            if (!isAlert && onConfirm) onConfirm();
                            onClose();
                        }}
                        className={`flex-1 py-3.5 text-[12px] font-black uppercase tracking-widest rounded-2xl shadow-lg transition-all ${confirmButtonColor}`}
                    >
                        {isAlert ? 'OK' : confirmText}
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
