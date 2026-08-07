
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, User, Building, ArrowRight, Stethoscope, Shield, Briefcase, Eye, EyeOff } from "lucide-react";
import axios from "axios";
import Navbar from "../components/Navbar";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ name: "", email: "", org_name: "", password: "", confirmPassword: "", role: "doctor" });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");

    // 1. Password Match Validation
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    // 2. Email Verification (@gmail.com only)
    if (!formData.email.toLowerCase().trim().endsWith("@gmail.com")) {
      setError("Email must end with '@gmail.com'");
      return;
    }

    // 3. Organization Name Validation (letters and spaces only)
    // const orgNameRegex = /^[A-Za-z\s]+$/;
    // if (!orgNameRegex.test(formData.org_name.trim())) {
    //   setError("Organization name must contain letters and spaces only");
    //   return;
    // }

    // 4. Password Complexity Validation
    // - At least 8 characters
    // - 1 Uppercase
    // - 1 Lowercase
    // - 1 Numeric
    // - 1 Special Character (any non-alphanumeric)
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,}$/;
    if (!passwordRegex.test(formData.password)) {
      setError("Password must be at least 8 characters and include 1 uppercase, 1 lowercase, 1 number, and 1 special character");
      return;
    }

    setIsLoading(true);
    try {
      const res = await axios.post("http://localhost:5001/api/auth/register", formData);
      if (res.data.success) {
        setTimeout(() => { navigate("/pending"); }, 1200);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] selection:bg-brand-100 selection:text-brand-900">
      <Navbar />

      <main className="flex-grow flex items-center justify-center px-4 py-1 relative overflow-hidden">
        {/* Decorative blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-[20%] -right-[10%] w-[50%] h-[50%] bg-emerald-50 rounded-full blur-[140px] opacity-40" />
          <div className="absolute top-[20%] -left-[10%] w-[40%] h-[40%] bg-brand-50 rounded-full blur-[140px] opacity-40" />
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[460px] relative z-10"
        >
          <div className="bg-white/80 backdrop-blur-2xl border border-white rounded-[2rem] p-7 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.07)]">

            {/* Header */}
            <div className="text-center mb-5">
              <h1 className="text-2xl font-display font-black text-slate-900 tracking-tight leading-tight">
                Create an Account
              </h1>
              <p className="text-slate-400 font-medium text-sm mt-1">
                Submit your credentials for verification.
              </p>
            </div>

            {/* noValidate disables all browser-native HTML5 validation so custom JS runs */}
            <form className="space-y-2" onSubmit={handleRegister} noValidate>

              {/* Error Banner */}
              <AnimatePresence mode="wait">
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-3"
                  >
                    <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Role Selector */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Select Role</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { role: "doctor", label: "Doctor", Icon: Stethoscope, color: "brand" },
                    { role: "insurance", label: "Insurance", Icon: Shield, color: "blue" },
                    { role: "admin", label: "Hospital Admin", Icon: Briefcase, color: "purple" },
                  ].map(({ role, label, Icon, color }) => {
                    const active = formData.role === role;
                    const styles = {
                      brand: active ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-100 bg-white text-slate-500",
                      blue: active ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-100 bg-white text-slate-500",
                      purple: active ? "border-purple-500 bg-purple-50 text-purple-700" : "border-slate-100 bg-white text-slate-500",
                    };
                    const iconStyles = {
                      brand: active ? "text-brand-600" : "text-slate-400",
                      blue: active ? "text-blue-600" : "text-slate-400",
                      purple: active ? "text-purple-600" : "text-slate-400",
                    };
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => setFormData({ ...formData, role })}
                        className={`flex flex-col items-center justify-center py-2.5 px-1 rounded-[0.9rem] border-2 transition-all duration-200 hover:shadow-sm ${styles[color]}`}
                      >
                        <Icon className={`w-5 h-5 mb-1 ${iconStyles[color]}`} />
                        <span className="font-bold text-[11px] tracking-tight text-center leading-tight">{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Full Name */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Full Name</label>
                <div className="group relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className="h-4 w-4 text-slate-400 group-focus-within:text-brand-600 transition-colors" />
                  </div>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="block w-full pl-11 pr-4 py-3 bg-slate-50 border-2 border-transparent rounded-[0.9rem] text-slate-900 font-semibold text-sm focus:bg-white focus:border-brand-500/20 outline-none transition-all shadow-sm"
                    placeholder="John Doe"
                  />
                </div>
              </div>

              {/* Work Email — type="text" so browser doesn't intercept before our regex */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Work Email</label>
                <div className="group relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-slate-400 group-focus-within:text-brand-600 transition-colors" />
                  </div>
                  <input
                    type="text"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="block w-full pl-11 pr-4 py-3 bg-slate-50 border-2 border-transparent rounded-[0.9rem] text-slate-900 font-semibold text-sm focus:bg-white focus:border-brand-500/20 outline-none transition-all shadow-sm"
                    placeholder="john@gmail.com"
                  />
                </div>
              </div>

              {/* Organisation Name */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">
                  {formData.role === "doctor" ? "Hospital / Clinic Name" : formData.role === "insurance" ? "Insurance Company Name" : "Hospital Name"}
                </label>
                <div className="group relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Building className="h-4 w-4 text-slate-400 group-focus-within:text-brand-600 transition-colors" />
                  </div>
                  <input
                    type="text"
                    required
                    value={formData.org_name}
                    onChange={(e) => setFormData({ ...formData, org_name: e.target.value })}
                    className="block w-full pl-11 pr-4 py-3 bg-slate-50 border-2 border-transparent rounded-[0.9rem] text-slate-900 font-semibold text-sm focus:bg-white focus:border-brand-500/20 outline-none transition-all shadow-sm"
                    placeholder={formData.role === "doctor" ? "Global Health Medical Center" : formData.role === "insurance" ? "Aetna" : "Regional Health Partners"}
                  />
                </div>
              </div>

              {/* Password — minLength removed; regex handles length check */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Password</label>
                <div className="group relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-slate-400 group-focus-within:text-brand-600 transition-colors" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="block w-full pl-11 pr-11 py-3 bg-slate-50 border-2 border-transparent rounded-[0.9rem] text-slate-900 font-semibold text-sm focus:bg-white focus:border-brand-500/20 outline-none transition-all shadow-sm"
                    placeholder="Abc@123#"
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

              {/* Confirm Password */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">
                  Confirm Password
                </label>
                <div className="group relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-slate-400 group-focus-within:text-brand-600 transition-colors" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="block w-full pl-11 pr-11 py-3 bg-slate-50 border-2 border-transparent rounded-[0.9rem] text-slate-900 font-semibold text-sm focus:bg-white focus:border-brand-500/20 outline-none transition-all shadow-sm"
                    placeholder="Re-enter password"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="group w-full relative h-[50px] flex items-center justify-center bg-brand-600 rounded-[0.9rem] shadow-lg shadow-brand-100/60 overflow-hidden transition-all duration-500 hover:bg-brand-700 disabled:opacity-70 mt-2"
              >
                {isLoading ? (
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span className="text-white font-bold text-xs uppercase tracking-widest">Processing...</span>
                  </div>
                ) : (
                  <>
                    <span className="relative z-10 text-white font-bold text-xs uppercase tracking-[0.2em] group-hover:translate-x-[-8px] transition-transform duration-500">
                      Submit Credentials
                    </span>
                    <ArrowRight className="absolute right-6 w-4 h-4 text-white opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-500" />
                  </>
                )}
              </button>
            </form>

            {/* Footer */}
            <div className="mt-1 pt-1 border-t border-slate-100 text-center text-sm">
              <span className="text-slate-400 font-semibold">Already have an account? </span>
              <Link to="/login" className="font-black text-slate-900 hover:text-brand-600 underline underline-offset-4 decoration-slate-200 transition-all">
                Sign in
              </Link>
            </div>

          </div>
        </motion.div>
      </main>
    </div>
  );
}
