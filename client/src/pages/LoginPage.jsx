import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, ArrowRight, Activity, Eye, EyeOff } from "lucide-react";
import axios from "axios";
import Navbar from "../components/Navbar";
import { useGoogleLogin } from '@react-oauth/google';

export default function LoginPage() {
  const [email, setEmail] = useState("superadmin@patienteval.com");
  const [password, setPassword] = useState("SuperAdmin@123");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleAuthSuccess = (user) => {
    setTimeout(() => {
      if (user.role === "super_admin") navigate("/admin-dashboard");
      else if (user.role === "admin") navigate("/hospital-admin-dashboard");
      else if (user.role === "insurance") navigate("/insurance-dashboard");
      else navigate("/doctor-dashboard");
    }, 800);
  };

  const loginWithGoogle = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        setIsLoading(true);
        setError("");
        const response = await axios.post("http://localhost:5001/api/auth/google", {
          credential: tokenResponse.access_token
        });
        if (response.data.success) {
          localStorage.setItem("token", response.data.token);
          localStorage.setItem("user", JSON.stringify(response.data.user));
          handleAuthSuccess(response.data.user);
        }
      } catch (err) {
        setError(err.response?.data?.message || "Google authentication failed");
        setIsLoading(false);
      }
    },
    onError: () => {
      setError("Google Login was closed or failed.");
    }
  });

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const response = await axios.post("http://localhost:5001/api/auth/login", { email, password });
      if (response.data.success) {
        localStorage.setItem("token", response.data.token);
        localStorage.setItem("user", JSON.stringify(response.data.user));
        handleAuthSuccess(response.data.user);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to authenticate to backend");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] selection:bg-brand-100 selection:text-brand-900">
      <Navbar />

      <main className="flex-grow flex items-center justify-center px-4 py-2 relative overflow-hidden">
        {/* Background Decorative Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-[10%] -right-[5%] w-[40%] h-[40%] bg-brand-50 rounded-full blur-[120px] opacity-60" />
          <div className="absolute -bottom-[10%] -left-[5%] w-[40%] h-[40%] bg-blue-50 rounded-full blur-[120px] opacity-60" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[460px] relative z-10"
        >
          <div className="bg-white/80 backdrop-blur-2xl border border-white rounded-[2rem] p-7 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.08)]">

            {/* Header */}
            <div className="text-center mb-5">
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-900 mb-4 shadow-2xl shadow-slate-200"
              >
                <Activity className="w-7 h-7 text-brand-400" />
              </motion.div>
              <h1 className="text-2xl font-display font-black text-slate-900 tracking-tight mb-1">
                Welcome Back
              </h1>
              <p className="text-slate-500 font-medium text-sm">
                PulseEngine Clinical Intelligence Portal
              </p>
            </div>

            <form className="space-y-3" onSubmit={handleLogin}>

              {/* Error Banner */}
              <AnimatePresence mode="wait">
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-3 overflow-hidden"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Email */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">
                  Email
                </label>
                <div className="group relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-slate-400 group-focus-within:text-brand-600 transition-colors" />
                  </div>
                  <input
                    type="email"
                    className="block w-full pl-11 pr-4 py-3 bg-slate-50 border-2 border-transparent rounded-[0.9rem] text-slate-900 font-semibold text-sm placeholder:text-slate-400 focus:bg-white focus:border-brand-500/20 focus:ring-0 transition-all duration-300 outline-none shadow-sm"
                    placeholder="name@apollo-hospitals.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">
                  Password
                </label>
                <div className="group relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-slate-400 group-focus-within:text-brand-600 transition-colors" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    className="block w-full pl-11 pr-11 py-3 bg-slate-50 border-2 border-transparent rounded-[0.9rem] text-slate-900 font-semibold text-sm placeholder:text-slate-400 focus:bg-white focus:border-brand-500/20 focus:ring-0 transition-all duration-300 outline-none shadow-sm"
                    placeholder="Abc@123#"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-brand-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="group w-full relative h-[50px] flex items-center justify-center bg-slate-900 rounded-[0.9rem] shadow-xl shadow-slate-200 overflow-hidden transition-all duration-500 hover:bg-slate-800 disabled:opacity-70 mt-1"
              >
                {isLoading ? (
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-white font-bold text-xs uppercase tracking-widest">Verifying...</span>
                  </div>
                ) : (
                  <>
                    <span className="relative z-10 text-white font-bold text-xs uppercase tracking-[0.2em] group-hover:translate-x-[-8px] transition-transform duration-500">
                      Sign in
                    </span>
                    <ArrowRight className="absolute right-6 w-4 h-4 text-brand-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-500" />
                  </>
                )}
              </button>

              {/* Divider */}
              <div className="relative mt-1">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-slate-400 font-bold uppercase tracking-widest text-[10px]">Or continue with</span>
                </div>
              </div>

              {/* Google Login */}
              <button
                type="button"
                onClick={() => loginWithGoogle()}
                className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-100 rounded-[0.9rem] py-3 text-slate-700 font-black text-xs uppercase tracking-widest hover:bg-slate-50 hover:border-slate-200 transition-all duration-300 shadow-sm"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Sign in with Google
              </button>

            </form>

            {/* Footer */}
            <div className="mt-4 pt-4 border-t border-slate-100 text-center">
              <p className="text-slate-400 text-sm font-semibold">
                Don't have an account?{" "}
                <Link to="/register" className="text-slate-900 hover:text-brand-600 underline underline-offset-4 decoration-slate-200 hover:decoration-brand-500 transition-all">
                  Register
                </Link>
              </p>
            </div>

          </div>
        </motion.div>
      </main>
    </div>
  );
}
