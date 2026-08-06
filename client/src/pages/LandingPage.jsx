import { Link } from "react-router-dom";
import { ArrowRight, Shield, Zap, Database, Activity } from "lucide-react";
import { motion } from "framer-motion";
import Navbar from "../components/Navbar";

export default function LandingPage() {
  return (
    <div className="flex-grow flex flex-col relative overflow-hidden">
      <Navbar />

      {/* Hero Section */}
      <section className="relative pt-24 sm:pt-28 lg:pt-32 pb-20 sm:pb-28 lg:pb-36 px-4 sm:px-6 lg:px-8 max-w-screen-2xl mx-auto w-full">
        <div className="flex flex-col md:flex-row items-center gap-12 lg:gap-16">
          <div className="w-full md:w-1/2 z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <span className="inline-block py-2 px-4 sm:px-5 rounded-full bg-brand-50 border border-brand-200 text-brand-700 text-sm sm:text-base lg:text-lg font-bold mb-6 sm:mb-8">
                AI-Powered Healthcare Analytics
              </span>

              <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-tight sm:leading-[1.1] mb-6 sm:mb-8">
                Evaluate Patient Risk <br className="hidden md:block" />
                <span className="text-gradient">Intelligently.</span>
              </h1>

              <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-slate-600 mb-8 sm:mb-10 lg:mb-12 max-w-2xl leading-relaxed">
                A robust, rule-based engine that ingests bulk records, computes
                explainable risk scores, and isolates data across hospitals securely.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 max-w-md sm:max-w-none">
                <Link
                  to="/register"
                  className="w-full sm:w-auto flex items-center justify-center gap-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-base sm:text-lg lg:text-xl px-6 sm:px-8 lg:px-10 py-4 sm:py-5 rounded-full shadow-lg transition-all hover:-translate-y-1"
                >
                  Get Started <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" />
                </Link>

                <Link
                  to="/login"
                  className="w-full sm:w-auto flex items-center justify-center gap-3 glass-card font-semibold text-base sm:text-lg lg:text-xl px-6 sm:px-8 lg:px-10 py-4 sm:py-5 rounded-full text-slate-800 hover:text-brand-600 transition-all"
                >
                  Log In
                </Link>
              </div>
            </motion.div>
          </div>

          {/* Right side visual */}
          <div className="w-full md:w-1/2 relative mt-8 md:mt-0 h-[380px] sm:h-[460px] lg:h-[550px] md:pl-6 lg:pl-10">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="absolute inset-0 z-10 glass rounded-[1.5rem] sm:rounded-[2rem] p-4 sm:p-6 md:p-8 lg:p-10 flex flex-col transform md:rotate-3 hover:rotate-0 transition-transform duration-500 shadow-2xl"
            >
              <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-10">
                <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-red-400 border-2 border-white/40 shadow-sm" />
                <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-amber-400 border-2 border-white/40 shadow-sm" />
                <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-green-400 border-2 border-white/40 shadow-sm" />
                <div className="ml-2 sm:ml-4 h-3 w-24 sm:w-32 md:w-40 bg-slate-200/50 rounded-full" />
              </div>

              <div className="space-y-4 sm:space-y-5 lg:space-y-6">
                {[
                  { color: "red", label: "CRITICAL" },
                  { color: "amber", label: "HIGH" },
                  { color: "green", label: "LOW" },
                ].map((item) => {
                  const bgMap = {
                    red: "bg-red-100",
                    amber: "bg-amber-100",
                    green: "bg-green-100",
                  };
                  const dotMap = {
                    red: "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]",
                    amber: "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]",
                    green: "bg-green-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]",
                  };
                  const labelMap = {
                    red: "bg-red-500/10 text-red-600 border-red-500/20",
                    amber: "bg-amber-500/10 text-amber-600 border-amber-500/20",
                    green: "bg-green-500/10 text-green-600 border-green-500/20",
                  };

                  return (
                    <div
                      key={item.label}
                      className="min-h-16 sm:h-20 w-full bg-white/60 backdrop-blur-md rounded-2xl flex items-center px-4 sm:px-6 gap-4 sm:gap-6 border border-white/40 shadow-md"
                    >
                      <div
                        className={`h-10 w-10 sm:h-12 sm:w-12 rounded-full ${bgMap[item.color]} flex items-center justify-center flex-shrink-0 shadow-inner`}
                      >
                        <div className={`h-4 w-4 sm:h-5 sm:w-5 rounded-full ${dotMap[item.color]}`} />
                      </div>

                      <div className="space-y-2 sm:space-y-3 w-full min-w-0">
                        <div className="flex justify-between items-center w-full gap-3">
                          <div className="h-2.5 sm:h-3 w-1/2 sm:w-1/3 bg-slate-400/40 rounded-full" />
                          <div className="h-2.5 sm:h-3 w-10 sm:w-12 bg-slate-400/30 rounded-full" />
                        </div>
                        <div className="h-2.5 sm:h-3 w-1/3 sm:w-1/4 bg-slate-400/30 rounded-full" />
                      </div>

                      <div
                        className={`h-7 sm:h-8 px-3 sm:w-28 flex items-center justify-center rounded-full flex-shrink-0 border tracking-wider text-[10px] sm:text-xs font-black ${labelMap[item.color]}`}
                      >
                        {item.label}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom summary bar */}
              <div className="mt-auto pt-5 sm:pt-8 border-t-2 border-slate-200/50 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <div>
                  <div className="h-4 w-28 sm:w-32 bg-slate-400/40 rounded-full mb-3" />
                  <div className="h-3 w-16 sm:w-20 bg-slate-400/30 rounded-full" />
                </div>

                <div className="text-sm sm:text-base font-semibold text-slate-700">
                  Engine ready for evaluation
                </div>
              </div>
            </motion.div>

            <div className="absolute -inset-4 sm:-inset-6 lg:-inset-8 z-0 bg-gradient-to-r from-brand-300 to-indigo-300 opacity-40 blur-3xl rounded-[3rem]" />
          </div>
        </div>
      </section>

      {/* Features snippet */}
      <section className="bg-white/60 backdrop-blur-sm py-20 sm:py-24 lg:py-32 border-t border-white/40">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14 sm:mb-16 lg:mb-20">
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6">
              Enterprise Grade Rules Processing
            </h2>
            <p className="text-slate-600 max-w-3xl mx-auto text-base sm:text-lg lg:text-xl leading-relaxed">
              Our engine is designed for security and speed, separating roles while
              ensuring data constraints and low latency.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 lg:gap-10 relative z-10">
            <div className="p-8 sm:p-10 lg:p-12 rounded-[2rem] sm:rounded-[2.5rem] glass-card text-center group hover:bg-white/90 transition-colors">
              <div className="mx-auto bg-brand-50 w-16 h-16 sm:w-20 sm:h-20 rounded-[1.25rem] sm:rounded-[1.5rem] flex items-center justify-center mb-6 sm:mb-8 border border-brand-100 group-hover:scale-110 transition-transform">
                <Shield className="w-8 h-8 sm:w-10 sm:h-10 text-brand-600" />
              </div>
              <h3 className="font-display font-semibold text-xl sm:text-2xl mb-3 sm:mb-4">
                Hospital Scoping
              </h3>
              <p className="text-slate-600 leading-relaxed text-base sm:text-lg">
                Strict data isolation guarantees users only access records bound to their
                direct organizational clearance.
              </p>
            </div>

            <div className="p-8 sm:p-10 lg:p-12 rounded-[2rem] sm:rounded-[2.5rem] glass-card text-center group hover:bg-white/90 transition-colors md:-translate-y-4 lg:-translate-y-6">
              <div className="mx-auto bg-indigo-50 w-16 h-16 sm:w-20 sm:h-20 rounded-[1.25rem] sm:rounded-[1.5rem] flex items-center justify-center mb-6 sm:mb-8 border border-indigo-100 group-hover:scale-110 transition-transform">
                <Zap className="w-8 h-8 sm:w-10 sm:h-10 text-indigo-600" />
              </div>
              <h3 className="font-display font-semibold text-xl sm:text-2xl mb-3 sm:mb-4">
                Real-Time Evaluation
              </h3>
              <p className="text-slate-600 leading-relaxed text-base sm:text-lg">
                Instantly apply global and custom rules, processing complex conditions to
                aggregate live risk assessments.
              </p>
            </div>

            <div className="p-8 sm:p-10 lg:p-12 rounded-[2rem] sm:rounded-[2.5rem] glass-card text-center group hover:bg-white/90 transition-colors">
              <div className="mx-auto bg-emerald-50 w-16 h-16 sm:w-20 sm:h-20 rounded-[1.25rem] sm:rounded-[1.5rem] flex items-center justify-center mb-6 sm:mb-8 border border-emerald-100 group-hover:scale-110 transition-transform">
                <Database className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-600" />
              </div>
              <h3 className="font-display font-semibold text-xl sm:text-2xl mb-3 sm:mb-4">
                Data Ingestion
              </h3>
              <p className="text-slate-600 leading-relaxed text-base sm:text-lg">
                Effortlessly batch-import large scale historical spreadsheets normalizing
                fields dynamically via Python automation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer Section */}
      <footer className="bg-slate-950 text-slate-400 py-14 sm:py-16 md:py-20 relative overflow-hidden border-t-4 border-brand-500">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 w-72 h-72 sm:w-96 sm:h-96 bg-brand-900/20 blur-3xl rounded-full" />
          <div className="absolute -bottom-24 -left-24 w-72 h-72 sm:w-96 sm:h-96 bg-indigo-900/20 blur-3xl rounded-full" />
        </div>

        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10 lg:gap-8 mb-12 lg:mb-16">
            <div className="md:col-span-5 lg:col-span-4 pr-0 md:pr-6 lg:pr-8">
              <Link to="/" className="flex items-center gap-3 mb-6 sm:mb-8">
                <Activity className="w-7 h-7 sm:w-8 sm:h-8 text-brand-500" />
                <span className="font-display font-bold text-2xl sm:text-3xl text-white tracking-tight">
                  Pulse<span className="text-brand-500">Engine</span>
                </span>
              </Link>

              <p className="mb-8 sm:mb-10 text-base sm:text-lg leading-relaxed">
                Empowering healthcare organizations with AI-driven risk evaluation,
                real-time analytics, and secure data scoping.
              </p>

              <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                <Link
                  to="#"
                  className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-slate-900 flex items-center justify-center border border-slate-800 hover:border-brand-500 hover:bg-brand-500/10 hover:text-brand-400 transition-all cursor-pointer"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z" />
                  </svg>
                </Link>

                <Link
                  to="#"
                  className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-slate-900 flex items-center justify-center border border-slate-800 hover:border-brand-500 hover:bg-brand-500/10 hover:text-brand-400 transition-all cursor-pointer"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path
                      fillRule="evenodd"
                      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                      clipRule="evenodd"
                    />
                  </svg>
                </Link>

                <Link
                  to="#"
                  className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-slate-900 flex items-center justify-center border border-slate-800 hover:border-brand-500 hover:bg-brand-500/10 hover:text-brand-400 transition-all cursor-pointer"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                  </svg>
                </Link>
              </div>
            </div>

            <div className="md:col-span-7 lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              <div>
                <h4 className="text-white font-bold text-lg sm:text-xl mb-6 sm:mb-8">
                  Platform
                </h4>
                <ul className="space-y-3 sm:space-y-4">
                  <li><Link to="#" className="hover:text-brand-400 transition-colors text-base sm:text-lg">Risk Analytics</Link></li>
                  <li><Link to="#" className="hover:text-brand-400 transition-colors text-base sm:text-lg">Rules Engine</Link></li>
                  <li><Link to="#" className="hover:text-brand-400 transition-colors text-base sm:text-lg">Hospital Scoping</Link></li>
                  <li><Link to="#" className="hover:text-brand-400 transition-colors text-base sm:text-lg">Security Details</Link></li>
                </ul>
              </div>

              <div>
                <h4 className="text-white font-bold text-lg sm:text-xl mb-6 sm:mb-8">
                  Solutions
                </h4>
                <ul className="space-y-3 sm:space-y-4">
                  <li><Link to="#" className="hover:text-brand-400 transition-colors text-base sm:text-lg">For Doctors</Link></li>
                  <li><Link to="#" className="hover:text-brand-400 transition-colors text-base sm:text-lg">For Insurance</Link></li>
                  <li><Link to="#" className="hover:text-brand-400 transition-colors text-base sm:text-lg">System Admins</Link></li>
                  <li><Link to="#" className="hover:text-brand-400 transition-colors text-base sm:text-lg">API Integrations</Link></li>
                </ul>
              </div>

              <div className="col-span-1 sm:col-span-2 lg:col-span-1">
                <h4 className="text-white font-bold text-lg sm:text-xl mb-6 sm:mb-8">
                  Legal
                </h4>
                <ul className="space-y-3 sm:space-y-4">
                  <li><Link to="#" className="hover:text-brand-400 transition-colors text-base sm:text-lg">Privacy Policy</Link></li>
                  <li><Link to="#" className="hover:text-brand-400 transition-colors text-base sm:text-lg">Terms of Service</Link></li>
                  <li><Link to="#" className="hover:text-brand-400 transition-colors text-base sm:text-lg">HIPAA Compliance</Link></li>
                  <li><Link to="#" className="hover:text-brand-400 transition-colors text-base sm:text-lg">Support Desk</Link></li>
                </ul>
              </div>
            </div>
          </div>

          <div className="pt-6 sm:pt-8 border-t border-slate-800/80 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-slate-500 font-medium text-sm sm:text-base text-center md:text-left">
              &copy; {new Date().getFullYear()} PulseEngine Inc. All rights reserved.
            </p>
            <div className="flex flex-wrap items-center justify-center md:justify-end gap-2 text-slate-500 font-medium text-sm sm:text-base text-center">
              Built securely for{" "}
              <span className="text-slate-300 font-bold px-2 py-1 bg-slate-900 rounded mx-1">
                Modern Healthcare
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}