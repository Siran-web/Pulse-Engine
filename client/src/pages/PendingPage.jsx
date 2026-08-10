import { motion } from 'framer-motion';
import { Clock, CheckCircle2, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PendingPage() {
  return (
    <div className="flex-grow flex items-center justify-center p-4 relative z-10">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-lg w-full text-center p-10 glass-card rounded-[2.5rem] shadow-xl border border-white/60"
      >
        <div className="mx-auto w-24 h-24 bg-amber-50 rounded-full flex items-center justify-center mb-6 border border-amber-100 shadow-inner">
          <Clock className="w-12 h-12 text-amber-500 animate-pulse" />
        </div>

        <h2 className="font-display text-3xl font-bold text-slate-900 mb-4">Request Pending Review</h2>
        <p className="text-slate-600 text-lg mb-8 leading-relaxed">
          Your access request has been submitted. For strict security, an administrator must manually verify your credentials, before that you can't access patient data.
        </p>

        <div className="bg-white/50 backdrop-blur-sm border border-slate-100/50 rounded-2xl p-6 text-left mb-8 shadow-sm">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-4">
            <ShieldAlert className="w-5 h-5 text-brand-600" /> Next Steps
          </h3>
          <ul className="space-y-4">
            <li className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
              <span className="text-slate-600 text-sm">Request submitted successfully</span>
            </li>
            <li className="flex items-start gap-3 opacity-60">
              <Clock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <span className="text-slate-600 text-sm">Administrator reviews details</span>
            </li>
            <li className="flex items-start gap-3 opacity-60">
              <Clock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <span className="text-slate-600 text-sm">You will receive an email notification indicating approval or rejection</span>
            </li>
          </ul>
        </div>

        <Link to="/" className="inline-block px-8 py-3.5 rounded-full bg-slate-900 text-white font-medium hover:bg-slate-800 transition-colors shadow-lg hover:-translate-y-0.5 transform">
          Return to Home
        </Link>
      </motion.div>
    </div>
  );
}
