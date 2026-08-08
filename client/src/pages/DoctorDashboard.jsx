import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Filter, TrendingUp, AlertTriangle, Activity, Thermometer, User, X,
  MessageSquare, Bot, ArrowRight, Zap, Heart, Database, Clock, Users,
  ShieldAlert, Award, ClipboardCheck, LogOut, CheckCircle2, ChevronRight,
  Layers, Menu, ChevronLeft, ChevronRight as ChevronRightIcon
} from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const PATIENTS_PER_PAGE = 10;

const BadgeColors = {
  Critical: 'bg-red-500/10 text-red-600 border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]',
  High: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  Medium: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  Low: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
};

export default function DoctorDashboard() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [totalPatients, setTotalPatients] = useState(0);
  const [stats, setStats] = useState({ Low: 0, Medium: 0, High: 0, Critical: 0, Total: 0 });
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('clinical');
  const [rules, setRules] = useState([]);
  const [loadingRules, setLoadingRules] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRisk, setFilterRisk] = useState('All');
  const [filterGender, setFilterGender] = useState('All');
  const [filterAgeRange, setFilterAgeRange] = useState('All');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activePatientId, setActivePatientId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Mobile sidebar state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Staging area for "Apply" logic
  const [tempFilterRisk, setTempFilterRisk] = useState('All');
  const [tempFilterGender, setTempFilterGender] = useState('All');
  const [tempFilterAgeRange, setTempFilterAgeRange] = useState('All');

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    navigate('/login');
  };

  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const doctorName = user?.name ? user.name : 'Doctor';

  const [chatMessages, setChatMessages] = useState([
    { role: 'ai', content: `Good evening, ${doctorName}. I've finished re-evaluating the ward data. Patient hypertension levels have trended upward in the last hour. Shall we review their protocol?` }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Close sidebar when tab changes on mobile
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setIsSidebarOpen(false);
  };

  useEffect(() => {
    const fetchRules = async () => {
      setLoadingRules(true);
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get('http://localhost:5001/api/rules', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.data.success) setRules(res.data.rules);
      } catch (err) {
        console.error("Error fetching rules:", err);
      } finally {
        setLoadingRules(false);
      }
    };
    if (activeTab === 'analytics') fetchRules();
  }, [activeTab]);

  const handleSendMessage = async (overrideMessage = null) => {
    const isOverride = typeof overrideMessage === 'string';
    const textToSend = isOverride ? overrideMessage : chatInput;
    if (!textToSend || !textToSend.trim()) return;

    const userMessage = { role: 'user', content: textToSend };
    const updatedHistory = [...chatMessages, userMessage];
    setChatMessages(updatedHistory);
    if (!isOverride) setChatInput('');
    setIsTyping(true);

    try {
      const token = localStorage.getItem('token');
      const historyToSend = updatedHistory.map(m => ({ role: m.role, content: m.content }));
      const res = await axios.post('http://localhost:5001/api/chat',
        { query: textToSend, history: historyToSend },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        setChatMessages(prev => [...prev, { role: 'ai', content: res.data.response }]);
      } else {
        setChatMessages(prev => [...prev, { role: 'ai', content: "Sorry, I couldn't process that request." }]);
      }
    } catch (err) {
      console.error("Chat error:", err);
      setChatMessages(prev => [...prev, { role: 'ai', content: "Error connecting to AI service." }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleInitiateCopilot = (patientId) => {
    setTimeout(() => {
      setIsChatOpen(true);
      setSelectedPatient(null);
      setActivePatientId(patientId);
      handleSendMessage(`Explain the clinical case and diagnosis for patient ${patientId}.`);
    }, 50);
  };

  // Build query parameters for server-side filtering
  const buildQueryParams = () => {
    const params = new URLSearchParams();
    params.append('context', 'doctor');
    params.append('page', currentPage);
    params.append('limit', PATIENTS_PER_PAGE);

    if (filterRisk !== 'All') {
      const riskLevel = filterRisk === 'Moderate' ? 'Medium' : filterRisk;
      params.append('risk_level', riskLevel);
    }
    if (filterGender !== 'All') params.append('gender', filterGender);
    if (filterAgeRange !== 'All') {
      if (filterAgeRange === '0-18') { params.append('min_age', 0); params.append('max_age', 18); }
      else if (filterAgeRange === '19-45') { params.append('min_age', 19); params.append('max_age', 45); }
      else if (filterAgeRange === '46-65') { params.append('min_age', 46); params.append('max_age', 65); }
      else if (filterAgeRange === '65+') params.append('min_age', 65);
    }
    if (searchQuery.trim()) {
      params.append('search', searchQuery.trim());
    }
    return params.toString();
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) { setLoading(false); return; }

        const queryParams = buildQueryParams();
        const [statsRes, patientsRes] = await Promise.all([
          axios.get('http://localhost:5001/api/patients/stats?context=doctor', { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`http://localhost:5001/api/patients?${queryParams}`, { headers: { Authorization: `Bearer ${token}` } })
        ]);

        if (statsRes.data.success) setStats(statsRes.data.stats);
        if (patientsRes.data.success) {
          setTotalPatients(patientsRes.data.total || 0);
          setPatients(patientsRes.data.patients.map(p => ({
            id: p.patient_id,
            dbId: p.id,
            name: p.name,
            age: p.age,
            gender: p.gender,
            hr: p.heart_rate,
            bp: `${p.blood_pressure_sys}/${p.blood_pressure_dia}`,
            bpSys: p.blood_pressure_sys,
            bpDia: p.blood_pressure_dia,
            riskLevel: p.latestEvaluation?.risk_level || 'Low',
            score: p.latestEvaluation?.risk_score || 0,
            explanation: p.latestEvaluation?.explanation || 'No evaluation data available.',
            matchedRules: p.latestEvaluation?.matchedRules || [],
            time: new Date(p.uploaded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          })));
        }
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    const delayDebounceFn = setTimeout(() => {
      fetchDashboardData();
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [currentPage, filterRisk, filterGender, filterAgeRange, searchQuery]);

  // Reset page when filters change (filter changes trigger the fetch useEffect)
  useEffect(() => { setCurrentPage(1); }, [filterRisk, filterGender, filterAgeRange, searchQuery]);

  // Calculate total pages from server response
  const totalPages = Math.ceil(totalPatients / PATIENTS_PER_PAGE);

  // Current page data (already fetched from server with filters/pagination applied)
  const paginatedPatients = patients;
  console.log(paginatedPatients)

  const avgHR = useMemo(() => paginatedPatients.length ? Math.round(paginatedPatients.reduce((acc, p) => acc + (p.hr || 0), 0) / paginatedPatients.length) : 0, [paginatedPatients]);
  const avgBP = useMemo(() => paginatedPatients.length ? Math.round(paginatedPatients.reduce((acc, p) => acc + (p.bpSys || 0), 0) / paginatedPatients.length) : 0, [paginatedPatients]);
  const urgentPatients = useMemo(() => paginatedPatients.filter(p => p.riskLevel === 'Critical' || p.riskLevel === 'High').slice(0, 3), [paginatedPatients]);

  // Sidebar content (shared between desktop and mobile drawer)
  const SidebarContent = () => (
    <>
      <div className="flex items-center gap-3 mb-10 group cursor-pointer">
        <div className="bg-brand-600 p-2.5 rounded-2xl shadow-2xl shadow-brand-200 group-hover:scale-110 transition-transform duration-500">
          <Activity className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="font-display font-black text-slate-900 text-lg tracking-tight leading-none">
            Pulse<span className="text-brand-600">Engine</span>
          </h2>
        </div>
      </div>

      <nav className="space-y-2 flex-grow">
        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 mb-4">Clinical Navigation</div>
        <button
          onClick={() => handleTabChange('clinical')}
          className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300 group relative overflow-hidden ${activeTab === 'clinical' ? 'bg-slate-900 text-white shadow-xl shadow-slate-200' : 'text-slate-500 hover:bg-white hover:text-slate-900'}`}
        >
          <Database className={`w-4 h-4 shrink-0 ${activeTab === 'clinical' ? 'text-brand-400' : 'text-slate-400 group-hover:text-brand-600'} transition-colors`} />
          <span className="font-bold text-sm tracking-tight">Clinical Dashboard</span>
          <div className={`ml-auto w-1.5 h-1.5 rounded-full ${activeTab === 'clinical' ? 'bg-brand-400' : 'bg-transparent'}`} />
        </button>

        <button
          onClick={() => handleTabChange('analytics')}
          className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300 group relative overflow-hidden ${activeTab === 'analytics' ? 'bg-slate-900 text-white shadow-xl shadow-slate-200' : 'text-slate-500 hover:bg-white hover:text-slate-900'}`}
        >
          <Layers className={`w-4 h-4 shrink-0 ${activeTab === 'analytics' ? 'text-brand-400' : 'text-slate-400 group-hover:text-brand-600'} transition-colors`} />
          <span className="font-bold text-sm tracking-tight">Active Rules</span>
          <div className={`ml-auto w-1.5 h-1.5 rounded-full ${activeTab === 'analytics' ? 'bg-brand-400' : 'bg-transparent'}`} />
        </button>
      </nav>

      <div className="mt-auto space-y-4 pt-4">


        <div className="flex items-center gap-3 px-1">
          <div className="w-9 h-9 rounded-full bg-slate-200 border-2 border-white shadow-sm flex items-center justify-center overflow-hidden shrink-0">
            <User className="text-slate-400 w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-slate-900 truncate uppercase tracking-tight">{user?.name || 'Doctor Admin'}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{user?.role || 'Doctor'}</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 rounded-xl bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all shrink-0"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col md:flex-row font-sans selection:bg-brand-100 selection:text-brand-900">

      {/* Mobile top bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white/80 backdrop-blur-lg border-b border-slate-200/50 sticky top-0 z-50">
        <div className="flex items-center gap-2.5">
          <div className="bg-brand-600 p-2 rounded-xl">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <span className="font-display font-black text-slate-900 text-base tracking-tight">
            Pulse<span className="text-brand-600">Engine</span>
          </span>
        </div>
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="p-2.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="sidebar-overlay"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed top-0 left-0 h-full w-72 bg-white/95 backdrop-blur-2xl border-r border-slate-200/50 z-50 p-6 flex flex-col shadow-2xl md:hidden"
            >
              <div className="flex items-center justify-between mb-6">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Navigation</span>
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-2 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 lg:w-72 glass border-r border-slate-200/50 sticky top-0 h-screen z-40 p-6 flex-col backdrop-blur-2xl">
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-6 lg:p-10 max-w-7xl mx-auto w-full min-w-0">
        <AnimatePresence mode="wait">

          {/* ── CLINICAL TAB ── */}
          {activeTab === 'clinical' ? (
            <motion.div
              key="clinical-view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-8"
            >
              {/* Header */}
              <header className="flex flex-col gap-4">
                <div>
                  <div className="flex items-center gap-2 text-brand-600 font-black text-[10px] uppercase tracking-widest mb-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-600 animate-pulse" /> Live Clinical Registry
                  </div>
                  <h1 className="text-3xl md:text-4xl lg:text-5xl font-display font-black text-slate-900 tracking-tighter">
                    Patient <span className="text-brand-600 underline decoration-brand-100 decoration-4 underline-offset-4">Roster</span>
                  </h1>
                  <p className="text-slate-400 font-semibold text-sm mt-2">
                    Monitoring {stats.Total} patients in your hospital.
                  </p>
                </div>

                {/* Search + Filter row */}
                <div className="flex items-center gap-3 bg-white/60 p-2 rounded-2xl border border-white/60 backdrop-blur-sm relative z-40 w-full">
                  <div className="relative flex-1 min-w-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search by name or ID..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full bg-transparent pl-10 pr-3 py-3 text-sm font-bold text-slate-900 focus:outline-none placeholder:text-slate-300"
                    />
                  </div>
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        if (!isFilterOpen) {
                          setTempFilterRisk(filterRisk);
                          setTempFilterGender(filterGender);
                          setTempFilterAgeRange(filterAgeRange);
                        }
                        setIsFilterOpen(!isFilterOpen);
                      }}
                      className={`p-3 rounded-xl flex items-center justify-center transition-all shadow-lg relative cursor-pointer ${isFilterOpen || filterRisk !== 'All' || filterGender !== 'All' || filterAgeRange !== 'All' ? 'bg-brand-600 text-white' : 'bg-slate-900 text-white hover:bg-brand-600'}`}
                    >
                      <Filter className="w-4 h-4 pointer-events-none" />
                      {(filterRisk !== 'All' || filterGender !== 'All' || filterAgeRange !== 'All') && (
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white pointer-events-none" />
                      )}
                    </button>

                    <AnimatePresence>
                      {isFilterOpen && (
                        <div className="absolute right-0 top-full mt-3 z-[100]">
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsFilterOpen(false)}
                            className="fixed inset-0 -z-10"
                          />
                          <motion.div
                            initial={{ opacity: 0, scale: 0.92, y: 8 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.92, y: 8 }}
                            transition={{ type: "spring", damping: 28, stiffness: 320 }}
                            className="w-[320px] sm:w-[400px] bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 overflow-hidden"
                            onClick={e => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-between mb-5">
                              <div>
                                <h4 className="text-slate-900 font-black text-base tracking-tight">Filters</h4>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Refine Clinical View</p>
                              </div>
                              {(tempFilterRisk !== 'All' || tempFilterGender !== 'All' || tempFilterAgeRange !== 'All') && (
                                <button
                                  onClick={() => { setTempFilterRisk('All'); setTempFilterGender('All'); setTempFilterAgeRange('All'); }}
                                  className="text-[10px] font-black text-brand-600 hover:text-brand-700 uppercase tracking-widest flex items-center gap-1"
                                >
                                  <X className="w-3 h-3" /> Reset
                                </button>
                              )}
                            </div>

                            <div className="space-y-5">
                              <div className="space-y-2">
                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Risk Priority</div>
                                <div className="flex flex-wrap gap-2">
                                  {['All', 'Critical', 'Moderate', 'Low'].map(level => (
                                    <button
                                      key={level}
                                      onClick={() => setTempFilterRisk(level)}
                                      className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${tempFilterRisk === level ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-100 text-slate-500 hover:border-brand-200 hover:text-brand-600'}`}
                                    >
                                      {level === 'All' ? 'All Risks' : level}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                {/* <div className="space-y-2">
                                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Gender</div>
                                  <div className="space-y-1">
                                    {['All', 'Male', 'Female'].map(g => (
                                      <button
                                        key={g}
                                        onClick={() => setTempFilterGender(g)}
                                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all border ${tempFilterGender === g ? 'bg-brand-50 text-brand-700 border-brand-200' : 'bg-white border-transparent text-slate-500 hover:bg-slate-50'}`}
                                      >
                                        {g === 'All' ? 'All' : g}
                                        {tempFilterGender === g && <div className="w-1.5 h-1.5 rounded-full bg-brand-500" />}
                                      </button>
                                    ))}
                                  </div>
                                </div> */}
                                <div className="space-y-2">
                                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Age</div>
                                  <div className="space-y-1">
                                    {['All', '0-18', '19-45', '46-65', '65+'].map(range => (
                                      <button
                                        key={range}
                                        onClick={() => setTempFilterAgeRange(range)}
                                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all border ${tempFilterAgeRange === range ? 'bg-brand-50 text-brand-700 border-brand-200' : 'bg-white border-transparent text-slate-500 hover:bg-slate-50'}`}
                                      >
                                        {range === 'All' ? 'All Ages' : range}
                                        {tempFilterAgeRange === range && <div className="w-1.5 h-1.5 rounded-full bg-brand-500" />}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="mt-5 pt-4 border-t border-slate-100 flex justify-end">
                              <button
                                onClick={() => {
                                  setFilterRisk(tempFilterRisk);
                                  setFilterGender(tempFilterGender);
                                  setFilterAgeRange(tempFilterAgeRange);
                                  setIsFilterOpen(false);
                                }}
                                className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-xs font-black tracking-widest uppercase hover:bg-brand-600 transition-all"
                              >
                                Apply
                              </button>
                            </div>
                          </motion.div>
                        </div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </header>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
                {[
                  { label: 'Total Patients', value: stats.Total || 0, color: 'text-brand-600', icon: Database, trend: 'System Wide', percentage: '100%' },
                  { label: 'Critical Risk', value: stats.Critical || 0, color: 'text-red-600', icon: ShieldAlert, trend: 'Immediate Action', percentage: stats.Total ? `${Math.round((stats.Critical / stats.Total) * 100)}%` : '0%' },
                  { label: 'High Risk', value: stats.High || 0, color: 'text-orange-600', icon: TrendingUp, trend: 'Urgent Care', percentage: stats.Total ? `${Math.round((stats.High / stats.Total) * 100)}%` : '0%' },
                  { label: 'Moderate Risk', value: stats.Medium || 0, color: 'text-amber-600', icon: Activity, trend: 'Monitoring', percentage: stats.Total ? `${Math.round((stats.Medium / stats.Total) * 100)}%` : '0%' },
                  { label: 'Low Risk', value: stats.Low || 0, color: 'text-emerald-600', icon: Clock, trend: 'Routine Care', percentage: stats.Total ? `${Math.round((stats.Low / stats.Total) * 100)}%` : '0%' },
                ].map((stat, i) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.07 }}
                    className="glass-card rounded-2xl p-4 md:p-5 border border-white bg-white/70 hover:-translate-y-1 transition-all duration-300 overflow-hidden relative"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none">{stat.label}</p>
                        <p className="text-[8px] font-bold text-slate-300 uppercase tracking-tighter mt-0.5">{stat.trend}</p>
                      </div>
                      <div className={`p-2 rounded-xl ${stat.color.replace('text', 'bg')}/10 ${stat.color} border border-white/50`}>
                        <stat.icon className="w-3.5 h-3.5 stroke-[2.5]" />
                      </div>
                    </div>
                    <div className="flex items-end justify-between">
                      <div className="text-3xl md:text-4xl font-display font-black text-slate-900 tracking-tighter leading-none">
                        {stat.value}
                      </div>
                      <div className={`text-[10px] font-black px-2 py-1 rounded-lg border ${stat.color.replace('text', 'border')}/30 bg-white shadow-sm ${stat.color}`}>
                        {stat.percentage}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Patient List */}
              <div className="space-y-3">
                {loading ? (
                  <div className="py-24 flex flex-col items-center justify-center text-slate-300">
                    <Activity className="w-12 h-12 animate-pulse mb-4 opacity-20" />
                    <p className="font-bold uppercase tracking-widest text-xs">Syncing Medical Node...</p>
                  </div>
                ) : totalPatients === 0 ? (
                  <div className="text-center py-24 glass-card rounded-3xl border-dashed border-2">
                    <Database className="w-12 h-12 mx-auto mb-4 text-slate-200" />
                    <h3 className="text-xl font-display font-black text-slate-900">Patient Not Found</h3>
                    <p className="text-slate-400 max-w-xs mx-auto text-sm mt-2 font-semibold">Verify the Patient ID or adjust filters.</p>
                  </div>
                ) : (
                  <>
                    {paginatedPatients.map((p, idx) => (


                      <motion.div
                        key={p.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.04 }}
                        onClick={() => setSelectedPatient(p)}
                        className="group relative cursor-pointer"
                      >
                        <div className="relative glass-card bg-white/80 rounded-2xl p-4 md:p-6 border border-white/60 hover:border-brand-200 hover:shadow-lg transition-all duration-300">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-4">

                            {/* Avatar + Info */}
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                              <div className="w-12 h-12 shrink-0 rounded-2xl bg-white shadow-lg flex items-center justify-center font-display font-black text-slate-400 text-xl relative">
                                {p.name.charAt(0)}
                                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-brand-600 border-2 border-white rounded-full" />
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-display font-black text-slate-900 text-lg group-hover:text-brand-600 transition-colors tracking-tight truncate">{p.name}</h4>
                                <div className="flex flex-wrap items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-wide mt-1">
                                  <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600 tracking-normal">{p.id}</span>
                                  <span className="hidden sm:inline">·</span>
                                  <span className="hidden sm:inline">{p.age}y</span>
                                  <span className="hidden sm:inline">·</span>
                                  <span className="hidden sm:inline font-black">{p.gender}</span>

                                </div>
                              </div>
                            </div>

                            {/* Vitals */}
                            <div className="hidden md:flex gap-8 items-center shrink-0">
                              <div className="text-center">
                                <div className="text-[9px] uppercase font-black text-slate-400 tracking-widest mb-1 flex items-center gap-1">
                                  <Heart className="w-3 h-3 text-red-500" /> HR
                                </div>
                                <div className="font-display font-black text-slate-900 text-xl tracking-tighter">{p.hr} <span className="text-[10px] text-slate-300 font-bold">BPM</span></div>
                              </div>
                              <div className="text-center">
                                <div className="text-[9px] uppercase font-black text-slate-400 tracking-widest mb-1 flex items-center gap-1">
                                  <Thermometer className="w-3 h-3 text-brand-600" /> BP
                                </div>
                                <div className="font-display font-black text-slate-900 text-xl tracking-tighter">{p.bp} <span className="text-[9px] text-slate-300 font-bold">mmHg</span></div>
                              </div>
                            </div>

                            {/* Risk badge + arrow */}
                            <div className="flex items-center gap-3 shrink-0 self-start sm:self-center">
                              <div className={`px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-[0.12em] ${BadgeColors[p.riskLevel]}`}>
                                {p.riskLevel}
                              </div>
                              <div className="bg-slate-900 p-2.5 rounded-xl shadow-lg group-hover:bg-brand-600 transition-all text-white">
                                <ArrowRight className="w-4 h-4" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between pt-4 pb-2">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                          {((currentPage - 1) * PATIENTS_PER_PAGE) + 1}–{Math.min(currentPage * PATIENTS_PER_PAGE, totalPatients)} of {totalPatients}
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:bg-slate-900 hover:text-white hover:border-slate-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>

                          <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                              let page;
                              if (totalPages <= 7) {
                                page = i + 1;
                              } else if (currentPage <= 4) {
                                page = i < 5 ? i + 1 : i === 5 ? '...' : totalPages;
                              } else if (currentPage >= totalPages - 3) {
                                page = i === 0 ? 1 : i === 1 ? '...' : totalPages - (6 - i);
                              } else {
                                page = i === 0 ? 1 : i === 1 ? '...' : i === 5 ? '...' : i === 6 ? totalPages : currentPage + (i - 3);
                              }
                              return (
                                <button
                                  key={i}
                                  onClick={() => typeof page === 'number' && setCurrentPage(page)}
                                  disabled={page === '...'}
                                  className={`w-8 h-8 rounded-lg text-xs font-black transition-all ${page === currentPage ? 'bg-slate-900 text-white shadow-lg' : page === '...' ? 'text-slate-300 cursor-default' : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-900 hover:text-slate-900'}`}
                                >
                                  {page}
                                </button>
                              );
                            })}
                          </div>

                          <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:bg-slate-900 hover:text-white hover:border-slate-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                          >
                            <ChevronRightIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>

          ) : (
            /* ── ANALYTICS / RULES TAB ── */
            <motion.div
              key="rules-view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-8 pb-24"
            >
              <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="max-w-xl">
                  <div className="flex items-center gap-2 text-brand-600 font-black text-[10px] uppercase tracking-[0.3em] mb-3">
                    <ShieldAlert className="w-3.5 h-3.5" /> Clinical Intelligence Governance
                  </div>
                  <h1 className="text-3xl md:text-4xl font-display font-black text-slate-900 tracking-tighter">
                    Active Clinical <span className="text-brand-600 font-medium italic">Rules</span>
                  </h1>
                  <p className="text-slate-400 font-bold text-sm mt-3 leading-relaxed">
                    The logic layer of PulseEngine — calibrating risk scores across all monitored patients.
                  </p>
                </div>
                <div className="flex items-center gap-3 bg-white/60 p-3 rounded-2xl border border-white/60">
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Rules</p>
                    <p className="text-2xl font-display font-black text-slate-900">{rules.length}</p>
                  </div>
                  <div className="w-11 h-11 rounded-2xl bg-brand-600 flex items-center justify-center text-white shadow-xl shadow-brand-100">
                    <Zap className="w-5 h-5" />
                  </div>
                </div>
              </header>

              <div className="grid grid-cols-1 gap-4">
                {loadingRules ? (
                  <div className="py-24 flex flex-col items-center justify-center text-slate-300">
                    <Activity className="w-12 h-12 animate-pulse mb-4 opacity-20" />
                    <p className="font-bold uppercase tracking-widest text-xs">Syncing Rule Set...</p>
                  </div>
                ) : rules.length === 0 ? (
                  <div className="text-center py-24 glass-card rounded-3xl border-dashed border-2">
                    <Layers className="w-12 h-12 mx-auto mb-4 text-slate-200" />
                    <h3 className="text-xl font-display font-black text-slate-900">No Rules Found</h3>
                    <p className="text-slate-400 max-w-xs mx-auto text-sm mt-2 font-semibold">Contact administrator to initialize the clinical logic engine.</p>
                  </div>
                ) : (
                  rules
                    .filter(r => r && typeof r.name === 'string' && !r.name.match(/ - Part \d+$/))
                    .map((rule, idx) => (
                      <motion.div
                        key={rule._id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.04 }}
                        className="group relative"
                      >
                        <div className="glass-card bg-white/90 rounded-2xl p-5 md:p-6 border border-white/80 hover:border-brand-100 hover:shadow-lg transition-all duration-300">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-brand-400 shadow-lg group-hover:bg-brand-600 group-hover:text-white transition-all shrink-0 mt-0.5">
                                <CheckCircle2 className="w-5 h-5" />
                              </div>
                              <div className="min-w-0">
                                <h3 className="font-display font-black text-lg md:text-xl text-slate-900 tracking-tight uppercase group-hover:text-brand-600 transition-colors">
                                  {rule.name}
                                </h3>
                                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                  <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${rule.scope === 'global' ? 'bg-brand-50 text-brand-600 border border-brand-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
                                    {rule.scope} scope
                                  </span>
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    Logic: {rule.logic}
                                  </span>
                                </div>
                                {rule.explanation_template && (
                                  <p className="mt-2 text-sm text-slate-500 leading-relaxed">{rule.explanation_template}</p>
                                )}
                              </div>
                            </div>

                            <div className="flex sm:flex-col items-center sm:items-end gap-3 sm:gap-2 shrink-0">
                              <div className="text-center sm:text-right">
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Impact</div>
                                <div className="text-2xl font-display font-black text-slate-900 tracking-tighter">
                                  +{rule.score}<span className="text-xs text-slate-300 ml-1">pts</span>
                                </div>
                              </div>
                              <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${rule.active ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                                {rule.active ? 'enabled' : 'disabled'}
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            {(rule.context || []).map((ctx, i) => (
                              <span key={i} className="bg-slate-50 px-2.5 py-1 rounded-lg text-[10px] font-black text-slate-500 uppercase tracking-widest border border-slate-100">
                                #{ctx}
                              </span>
                            ))}
                          </div>

                          <div className="mt-4 bg-slate-50/70 rounded-2xl p-4 border border-slate-100">
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-brand-500" /> Conditions
                            </div>
                            <div className="flex flex-col gap-2.5">
                              {(rule.conditions || []).map((cond, i) => (
                                <div key={i} className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                                  {i > 0 && (
                                    <span className="text-[10px] font-black text-brand-600 bg-brand-50 px-2 py-0.5 rounded border border-brand-100 self-start sm:self-center">
                                      {rule.logic}
                                    </span>
                                  )}
                                  <div className="flex items-center gap-2 bg-white rounded-xl px-4 py-2.5 shadow-sm border border-slate-100 flex-wrap">
                                    <span className="font-black text-slate-800 text-sm">{cond.field.replace(/_/g, ' ')}</span>
                                    <span className="font-display font-black text-brand-600 text-base">{cond.operator}</span>
                                    <span className="font-black text-slate-800 text-sm">{cond.value}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Patient Detail Modal */}
      {/* Patient Detail Modal */}
      <AnimatePresence>
        {selectedPatient && (
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-3 sm:p-6">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/70 backdrop-blur-md"
              onClick={() => setSelectedPatient(null)}
            />

            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white/20"
            >
              {/* Close Button */}
              <button
                onClick={() => setSelectedPatient(null)}
                className="absolute top-4 right-4 sm:top-6 sm:right-6 bg-slate-100 hover:bg-red-50 hover:text-red-600 p-2 sm:p-3 rounded-2xl text-slate-500 transition-all z-20"
              >
                <X className="w-5 h-5" />
              </button>

              {/* --- CONTENT AREA (SCROLLABLE) --- */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-5 sm:p-8 md:p-10">

                {/* Header Section */}
                <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8 border-b pb-8 border-slate-100">
                  <div className="flex items-center gap-5">
                    <div className={`w-16 h-16 sm:w-24 sm:h-24 rounded-3xl flex items-center justify-center font-display font-black text-3xl sm:text-5xl shadow-2xl shrink-0 ${BadgeColors[selectedPatient?.riskLevel] || ''}`}>
                      {selectedPatient?.name?.charAt(0)}
                    </div>
                    <div>
                      <h2 className="text-2xl sm:text-4xl font-display font-black text-slate-900 tracking-tighter leading-tight">
                        {selectedPatient?.name}
                      </h2>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-slate-400 font-bold uppercase tracking-[0.15em] text-[10px] mt-2">
                        <span className="text-brand-600">{selectedPatient?.id}</span>
                        <span>·</span><span>{selectedPatient?.age} Yrs</span>
                        <span>·</span><span>{selectedPatient?.gender}</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-3xl px-8 py-4 text-center shrink-0">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Risk Score</div>
                    <div className="text-4xl sm:text-5xl font-display font-black text-brand-600 tracking-tighter">{selectedPatient?.score}</div>
                  </div>
                </header>

                {/* Vitals Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                  <div className="bg-red-50/50 border border-red-100 rounded-3xl p-5 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-red-600 mb-2">
                        <Heart className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Heart Rate</span>
                      </div>
                      <div className="font-display font-black text-slate-900 text-3xl sm:text-4xl tracking-tighter">
                        {selectedPatient?.hr || '--'} <span className="text-xs text-slate-400 font-bold ml-1">bpm</span>
                      </div>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-sm">
                      <Heart className="w-6 h-6 text-red-500" />
                    </div>
                  </div>

                  <div className="bg-brand-50/50 border border-brand-100 rounded-3xl p-5 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-brand-600 mb-2">
                        <Thermometer className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Blood Pressure</span>
                      </div>
                      <div className="font-display font-black text-slate-900 text-3xl sm:text-4xl tracking-tighter">
                        {selectedPatient?.bp || '--'} <span className="text-xs text-slate-400 font-bold ml-1">mmHg</span>
                      </div>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-white items-center justify-center shadow-sm">
                      <Activity className="w-6 h-6 text-brand-600" />
                    </div>
                  </div>
                </div>

                {/* Analysis Grid */}
                <div className="grid lg:grid-cols-2 gap-8 items-start">
                  {/* Rules Column */}
                  <div className="space-y-5">
                    <h3 className="font-display font-black text-slate-900 text-lg flex items-center gap-2">
                      <ShieldAlert className="w-5 h-5 text-brand-600" /> Rule Matches
                    </h3>
                    <div className="space-y-3">
                      {selectedPatient?.matchedRules?.length > 0 ? (
                        selectedPatient.matchedRules.map((rule, idx) => (
                          <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            key={idx}
                            className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center justify-between shadow-sm"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-2.5 h-2.5 rounded-full bg-brand-500 shadow-[0_0_8px_rgba(var(--brand-500),0.4)]" />
                              <span className="font-bold text-sm text-slate-700">{rule.rule_name}</span>
                            </div>
                            <span className="px-3 py-1 bg-brand-50 rounded-xl text-brand-700 font-black text-[10px]">
                              +{rule.score_added} PTS
                            </span>
                          </motion.div>
                        ))
                      ) : (
                        <div className="py-8 text-center border-2 border-dashed border-slate-100 rounded-3xl">
                          <p className="text-slate-400 text-sm italic font-medium">No critical rule triggers detected.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* AI Reasoning Column */}
                  <div className="bg-slate-900 rounded-[2rem] p-6 sm:p-8 text-white shadow-2xl relative flex flex-col min-h-[300px]">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="font-display font-black text-white text-lg flex items-center gap-2">
                        <Bot className="w-5 h-5 text-brand-400" /> AI Diagnostic Reasoner
                      </h3>
                      <div className="px-3 py-1 bg-white/10 rounded-full text-[9px] font-black tracking-widest text-brand-400 uppercase">
                        v2.4 Active
                      </div>
                    </div>

                    <div className="text-slate-300/90 leading-relaxed text-sm mb-8 font-medium">
                      {selectedPatient?.explanation || "Analyzing patient data for clinical insights..."}
                    </div>

                    <button
                      onClick={() => handleInitiateCopilot(selectedPatient?.id)}
                      className="mt-auto w-full bg-brand-600 hover:bg-brand-500 py-4 rounded-2xl font-display font-black text-xs tracking-[0.2em] transition-all flex items-center justify-center gap-3 group shadow-lg shadow-brand-600/20"
                    >
                      INITIATE AI CO-PILOT
                      <MessageSquare className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Chat toggle button */}
      <button
        onClick={() => setIsChatOpen(!isChatOpen)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-slate-900 rounded-2xl shadow-xl flex items-center justify-center text-white hover:bg-brand-600 hover:scale-110 transition-all z-50 border-2 border-white"
      >
        {isChatOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
      </button>

      {/* Chatbot panel — fixed size, right-anchored */}
      <AnimatePresence>
        {isChatOpen && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.95 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed bottom-24 right-4 sm:right-6 w-[calc(100vw-2rem)] sm:w-[360px] md:w-[380px] h-[520px] sm:h-[560px] bg-white rounded-3xl shadow-2xl z-50 border border-slate-200 flex flex-col overflow-hidden"
          >
            {/* Chat Header */}
            <div className="bg-slate-900 px-5 py-4 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center shadow-lg">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="text-white font-black text-sm leading-none">Clinical Copilot</h4>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <p className="text-brand-400 text-[10px] font-black uppercase tracking-[0.2em]">Neural Engine Active</p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsChatOpen(false)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 px-4 py-4 overflow-y-auto space-y-4 bg-slate-50/50 custom-scrollbar">
              {chatMessages.map((msg, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`flex ${msg.role === 'ai' ? 'justify-start' : 'justify-end'}`}
                >
                  <div className={`max-w-[85%] px-4 py-3 text-sm leading-relaxed font-medium ${msg.role === 'ai'
                    ? 'bg-white border border-slate-100 text-slate-700 rounded-2xl rounded-tl-sm shadow-sm'
                    : 'bg-slate-900 text-white rounded-2xl rounded-tr-sm shadow-lg'
                    }`}>
                    {msg.role === 'ai' ? (
                      <div className="prose prose-sm max-w-none text-slate-700 prose-p:leading-relaxed prose-p:my-1 prose-a:text-brand-600">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      </div>
                    ) : msg.content}
                  </div>
                </motion.div>
              ))}
              {isTyping && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
                  <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-600 animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-600 animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-600 animate-bounce" />
                  </div>
                </motion.div>
              )}
            </div>

            {/* Chat Input */}
            <div className="px-4 py-3 bg-white border-t border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Ask about patient trends..."
                  className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all placeholder:text-slate-300"
                />
                <button
                  onClick={() => handleSendMessage()}
                  disabled={isTyping || !chatInput.trim()}
                  className="w-11 h-11 shrink-0 bg-slate-900 rounded-2xl flex items-center justify-center text-white hover:bg-brand-600 active:scale-95 transition-all disabled:opacity-40"
                >
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
              {activePatientId && (
                <div className="mt-2.5 flex items-center gap-4">
                  {[
                    { label: `${activePatientId} Vitals`, query: `Analyze vitals for patient ${activePatientId}.` },
                    { label: 'Risk Analysis', query: `Risk breakdown for ${activePatientId}.` }
                  ].map(chip => (
                    <button
                      key={chip.label}
                      onClick={() => handleSendMessage(chip.query)}
                      className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-brand-600 transition-colors"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}