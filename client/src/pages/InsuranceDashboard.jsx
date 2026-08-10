
import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
/* eslint-disable no-unused-vars */
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Search, AlertCircle, CheckCircle2,
  Users, DollarSign, Activity, Filter,
  ShieldCheck, FileText, ChevronRight, LayoutDashboard,
  LogOut, User as UserIcon, Download, X, BarChart3, TrendingUp, TrendingDown,
  BrainCircuit, ArrowUpDown, ChevronUp, ChevronDown, ChevronLeft, Stethoscope,
  BookOpen, Hospital, Users2, ChevronsLeft, ChevronsRight, Menu
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export default function InsuranceDashboard() {
  const [patients, setPatients] = useState([]);
  const [stats, setStats] = useState({ Low: 0, Medium: 0, High: 0, Critical: 0, Total: 0 });
  const [totalRecords, setTotalRecords] = useState(0);

  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('patients');
  const [filterType, setFilterType] = useState('All');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setIsSidebarOpen(false);
  };

  const [selectedPatient, setSelectedPatient] = useState(null);
  const [networkHospitals, setNetworkHospitals] = useState([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState('All');
  const [rules, setRules] = useState([]);
  const [rulesLoading, setRulesLoading] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const navigate = useNavigate();

  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const fetchPatients = async (hospId = 'All') => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      const params = new URLSearchParams();

      // Ensure we explicitly pass the insurance identifier to the backend
      const insuranceId = user?.insurance_org_id || user?.org_id || user?.id || user?._id;
      if (insuranceId) {
        params.append('insurance_id', insuranceId);
      }

      if (hospId !== 'All') {
        params.append('hospital_id', hospId);
      } else if (networkHospitals.length > 0) {
        // If 'All', specifically request only from affiliated network hospitals
        const hospitalIds = networkHospitals.map(h => h.id).join(',');
        params.append('hospital_ids', hospitalIds);
      }

      params.append('page', currentPage);
      params.append('limit', pageSize);
      if (searchTerm.trim()) params.append('search', searchTerm.trim());
      if (filterType !== 'All') params.append('risk_level', filterType);

      const queryStr = params.toString();

      const [patientsRes, statsRes] = await Promise.all([
        axios.get(`http://localhost:5001/api/patients/insurance?${queryStr}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`http://localhost:5001/api/patients/stats?context=insurance${hospId !== 'All' ? `&hospital_id=${hospId}` : ''}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (patientsRes.data.success) {
        // Frontend Filter Check: Ensure patient has a valid hospital link AND insurance id
        const validPatients = patientsRes.data.patients.filter(p =>
          (p.hospital_id || (p.hospital && p.hospital.name)) &&
          (p.insurance_id || (p.insurance && p.insurance.id) || p.insurance)
        );

        setPatients(validPatients);
        // Correct total records based on frontend validation if discrepancies exist
        setTotalRecords(validPatients.length !== patientsRes.data.patients.length ? validPatients.length : patientsRes.data.total);
      }
      if (statsRes.data.success) setStats(statsRes.data.stats);
    } catch (err) {
      console.error('Failed to fetch insurance patient data', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRules = async () => {
    try {
      setRulesLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.get(`http://localhost:5001/api/rules`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.success) {
        const insuranceRules = res.data.rules.filter(r =>
          r.scope === 'global' && r.context?.includes('insurance')
        );
        setRules(insuranceRules);
      }
    } catch (err) {
      console.error('Failed to fetch rules', err);
    } finally {
      setRulesLoading(false);
    }
  };

  const fetchNetworkHospitals = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:5001/api/patients/network-hospitals', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setNetworkHospitals(res.data.hospitals);
      }
    } catch (err) {
      console.error('Failed to fetch network hospitals', err);
    }
  };

  useEffect(() => {
    fetchNetworkHospitals();
  }, []);

  // Debounce the fetch
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchPatients(selectedHospitalId);
    }, 1000);
    return () => clearTimeout(delayDebounceFn);
  }, [selectedHospitalId, currentPage, pageSize, searchTerm, filterType, networkHospitals.length]); // Added networkHospitals dependency

  useEffect(() => {
    if (activeTab === 'rules') fetchRules();
  }, [activeTab]);

  // Reset to page 1 whenever filters/search/sort change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType, selectedHospitalId, pageSize]);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const handleExportCSV = () => {
    const data = patients;
    const headers = ['Patient ID', 'Hospital', 'City', 'Age', 'Gender', 'Risk Level', 'Score', 'Admissions', 'Price'];
    const rows = data.map(p => [
      p.patient_id,
      p.hospital?.name || 'Unknown',
      p.hospital?.city || 'N/A',
      p.age,
      p.gender,
      p.evaluation?.risk_level || 'Pending',
      p.evaluation?.risk_score || 'N/A',
      p.admission_count || 0,
      p.price || 0
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Insurance_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Derived pagination values
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  // Actually on 'patients' we can do client-side sort if it's strictly on current page,
  // but to keep it simple we apply it over `patients`
  const currentPageData = [...patients];
  if (sortConfig.key) {
    currentPageData.sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];

      if (sortConfig.key === 'risk_level') {
        const riskWeight = { Critical: 4, High: 3, Medium: 2, Low: 1 };
        aVal = riskWeight[a.evaluation?.risk_level] || 0;
        bVal = riskWeight[b.evaluation?.risk_level] || 0;
      } else if (sortConfig.key === 'risk_score') {
        aVal = a.evaluation?.risk_score || 0;
        bVal = b.evaluation?.risk_score || 0;
      } else if (sortConfig.key === 'hospital') {
        aVal = a.hospital?.name || '';
        bVal = b.hospital?.name || '';
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }

  const flaggedCount = (stats.Critical || 0) + (stats.High || 0);

  const totalCostEst = useMemo(() => {
    let cost = ((stats.Critical || 0) * 25000) + ((stats.High || 0) * 10000) + ((stats.Medium || 0) * 3000) + ((stats.Low || 0) * 500);
    return (cost / 10000).toFixed(2);
  }, [stats]);

  // Smart page number array: always show first, last, current ±1, with ellipsis gaps
  const getPageNumbers = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages = new Set([1, totalPages, safePage, safePage - 1, safePage + 1]);
    return [...pages]
      .filter(p => p >= 1 && p <= totalPages)
      .sort((a, b) => a - b)
      .reduce((acc, page, idx, arr) => {
        if (idx > 0 && page - arr[idx - 1] > 1) acc.push('...');
        acc.push(page);
        return acc;
      }, []);
  };

  const SortIcon = ({ column }) => {
    if (sortConfig.key !== column) return <ArrowUpDown className="w-3 h-3 ml-1 inline text-slate-300" />;
    return sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 ml-1 inline text-emerald-500" /> : <ChevronDown className="w-3 h-3 ml-1 inline text-emerald-500" />;
  };

  if (loading && !patients.length) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const SidebarContent = () => (
    <>
      <div className="flex items-center gap-4 mb-12 group cursor-pointer relative">

        {/* Background hover layer (move FIRST + push behind) */}
        <motion.div
          className="absolute -inset-2 bg-emerald-50 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity -z-10 pointer-events-none"
        />

        {/* Logo */}
        <div className="relative z-10 bg-brand-600 p-3 rounded-2xl shadow-2xl shadow-brand-200 group-hover:scale-110 transition-transform duration-500">
          <Activity className="w-7 h-7 text-white" />
        </div>

        {/* Text */}
        <div className="relative z-10">
          <h2 className="font-display font-black text-slate-900 text-xl tracking-tight leading-none">
            Pulse<span className="text-brand-600">Engine</span>
          </h2>
        </div>

      </div>

      <nav className="space-y-3 flex-grow">
        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 mb-4">Insurance Administration</div>

        {[
          /* { id: 'overview', label: 'Overview', Icon: LayoutDashboard, badge: null }, */
          { id: 'rules', label: 'Global Rules', Icon: BookOpen, badge: null },
          { id: 'hospitals', label: 'Hospitals', Icon: Hospital, badge: networkHospitals.length, badgeColor: 'bg-emerald-500' },
          { id: 'patients', label: 'Patients', Icon: Users2 },
        ].map(({ id, label, Icon, badge, badgeColor }) => (
          <button
            key={id}
            onClick={() => handleTabChange(id)}
            className={`w-full flex items-center gap-4 px-5 py-3 rounded-2xl transition-all duration-300 group relative overflow-hidden ${activeTab === id ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-500 hover:bg-emerald-50/50 hover:text-slate-900'}`}
          >
            <Icon className={`w-5 h-5 ${activeTab === id ? 'text-emerald-400' : 'text-slate-400 group-hover:text-emerald-600'}`} />
            <span className="font-bold text-sm tracking-tight">{label}</span>
            {badge !== null && (
              <span className={`ml-auto ${badgeColor} text-white text-[10px] font-black px-2 py-1 rounded-full`}>{badge}</span>
            )}
          </button>
        ))}
      </nav>

      <div className="mt-auto space-y-6">


        <div className="flex items-center gap-3 px-2 cursor-pointer group">
          <div className="w-10 h-10 rounded-full bg-slate-200 border-2 border-white shadow-sm flex items-center justify-center overflow-hidden">
            <UserIcon className="text-slate-400 w-5 h-5 group-hover:text-emerald-600 transition-colors" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-slate-900 truncate uppercase tracking-tight">{user?.name || 'User'}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{user?.org_name || 'Insurance'}</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all shadow-sm"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex-grow flex flex-col lg:flex-row bg-[#f8fafc] relative font-sans min-h-[calc(100vh-4rem)] lg:min-h-screen">

      {/* Mobile top bar */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-white/80 backdrop-blur-lg border-b border-slate-200/50 sticky top-0 z-50">
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
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed top-0 left-0 h-full w-72 bg-white/95 backdrop-blur-2xl border-r border-slate-200/50 z-50 p-6 flex flex-col shadow-2xl lg:hidden"
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
      <aside className="w-64 lg:w-72 border-r border-slate-200/50 hidden lg:flex flex-col z-40 sticky top-0 h-screen p-6 bg-white/50 backdrop-blur-xl">
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <main className="flex-1 px-6 py-8 w-full max-w-7xl mx-auto overflow-y-auto z-10">
        {/* Header */}
        <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-white/60 p-6 rounded-2xl border border-slate-200/50 backdrop-blur-xl shadow-sm">
          <div>
            <h1 className="font-display text-3xl font-black text-slate-900 tracking-tight">
              {/* {activeTab === 'overview' && 'Risk Portfolio'} */}
              {activeTab === 'rules' && 'Global Rules Engine'}
              {activeTab === 'hospitals' && 'Network Hospitals'}
              {activeTab === 'patients' && 'Member Directory'}
            </h1>
            <p className="text-slate-500 font-medium mt-1 text-sm">
              {/* {activeTab === 'overview' && 'Real-time risk assessment and financial exposure'} */}
              {activeTab === 'rules' && 'Centralized rules set by super admin for insurance context'}
              {activeTab === 'hospitals' && 'View all affiliated hospital providers in your network'}
              {activeTab === 'patients' && 'Comprehensive member data across all affiliated hospitals'}
            </p>
          </div>

          {activeTab === 'patients' && (
            <div className="flex flex-wrap md:flex-nowrap gap-3 w-full md:w-auto">
              <div className="relative">
                <Building2 className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <select
                  value={selectedHospitalId}
                  onChange={(e) => setSelectedHospitalId(e.target.value)}
                  className="h-11 pl-10 pr-4 bg-white border border-slate-200 rounded-lg shadow-sm text-slate-900 text-sm font-bold focus:outline-none focus:border-emerald-500 appearance-none cursor-pointer"
                >
                  <option value="All">All Hospitals</option>
                  {networkHospitals.map(h => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>

              <div className="relative flex-1 md:w-56">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  type="text"
                  placeholder="Search patient ID..."
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 font-bold text-sm text-slate-900 shadow-sm placeholder-slate-400"
                />
              </div>

              <div className="relative">
                <Filter className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="h-11 pl-10 pr-4 bg-white border border-slate-200 rounded-lg shadow-sm text-slate-900 text-sm font-bold focus:outline-none focus:border-emerald-500 appearance-none cursor-pointer"
                >
                  <option value="All">All Risk Levels</option>
                  <option value="Critical">Critical</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
                <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>

              <button
                onClick={handleExportCSV}
                className="h-11 px-5 bg-slate-900 text-white rounded-lg shadow-lg hover:bg-slate-800 transition-all flex items-center gap-2 font-bold text-sm"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                Export
              </button>
            </div>
          )}
        </header>

        <AnimatePresence mode="wait">
          {/* Rules Tab */}
          {activeTab === 'rules' && (
            <motion.div
              key="rules"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              {rulesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : rules.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                  <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500 font-bold">No global rules available for insurance context.</p>
                </div>
              ) : (
                rules.map((rule, idx) => (
                  <motion.div
                    key={rule._id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 hover:shadow-md hover:border-emerald-200 transition-all"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h4 className="text-lg font-black text-slate-900">{rule.name}</h4>
                        <p className="text-sm text-slate-500 mt-1">{rule.explanation_template || 'No explanation provided'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-lg font-bold text-xs ${rule.active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                          {rule.active ? 'Active' : 'Inactive'}
                        </span>
                        <span className="px-3 py-1 rounded-lg font-bold text-xs bg-blue-50 text-blue-700 border border-blue-200">
                          Score: {rule.score}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="text-xs font-bold text-slate-500 uppercase">Conditions ({rule.logic || 'AND'}):</div>
                      <div className="space-y-2">
                        {rule.conditions?.map((cond, cidx) => (
                          <div key={cidx} className="bg-slate-50 p-3 rounded-lg border border-slate-100 font-mono text-xs text-slate-700 flex items-center gap-2">
                            <span className="font-black">{cond.field}</span>
                            <span className="text-slate-400">{cond.operator}</span>
                            <span className="font-black text-blue-600">{cond.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </motion.div>
          )}

          {/* Hospitals Tab */}
          {activeTab === 'hospitals' && (
            <motion.div
              key="hospitals"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {networkHospitals.length === 0 ? (
                <div className="md:col-span-2 lg:col-span-3 bg-white rounded-xl border border-slate-200 p-12 text-center">
                  <Hospital className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500 font-bold">No hospitals in your network yet.</p>
                </div>
              ) : (
                networkHospitals.map((hosp, idx) => {
                  return (
                    <motion.div
                      key={hosp.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 hover:shadow-md hover:border-emerald-200 transition-all cursor-pointer group"
                      onClick={() => { setSelectedHospitalId(hosp.id); setActiveTab('patients'); }}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h4 className="text-lg font-black text-slate-900">{hosp.name}</h4>
                          {/* <p className="text-sm text-slate-500 mt-1">{hosp.city || 'Location'}</p> */}
                        </div>
                        <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center border border-emerald-100 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                          <Hospital className="w-5 h-5" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Total Patients</p>
                          <p className="text-2xl font-black text-slate-900">{hosp.total_patients || 0}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Critical Cases</p>
                          <p className={`text-2xl font-black ${(hosp.critical_cases || 0) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{hosp.critical_cases || 0}</p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </motion.div>
          )}

          {/* Patients Tab */}
          {activeTab === 'patients' && (
            <motion.div
              key="patients"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
            >
              {/* Table toolbar */}
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between gap-4 flex-wrap">
                <p className="text-sm font-bold text-slate-600">
                  {totalRecords === 0
                    ? 'No records'
                    : `Showing ${((safePage - 1) * pageSize) + 1}–${Math.min(safePage * pageSize, totalRecords)} of ${totalRecords} records`}
                </p>

                {/* Page size selector */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Rows</span>
                  <div className="flex rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                    {PAGE_SIZE_OPTIONS.map(size => (
                      <button
                        key={size}
                        onClick={() => setPageSize(size)}
                        className={`px-3 py-1.5 text-xs font-black transition-all ${pageSize === size
                          ? 'bg-slate-900 text-white'
                          : 'bg-white text-slate-500 hover:bg-emerald-50 hover:text-emerald-700'
                          }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {[
                        { label: 'Patient ID', key: 'patient_id' },
                        { label: 'Hospital', key: 'hospital' },
                        { label: 'Age', key: 'age' },
                        { label: 'Gender', key: null },
                        { label: 'Risk', key: 'risk_level' },
                        { label: 'Score', key: 'risk_score' },
                        { label: 'Admissions', key: null, center: true },
                        { label: 'Price', key: null, right: true },
                      ].map(({ label, key, center, right }) => (
                        <th
                          key={label}
                          className={`p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest ${key ? 'cursor-pointer hover:text-emerald-600' : ''} ${center ? 'text-center' : ''} ${right ? 'text-right' : ''}`}
                          onClick={() => key && handleSort(key)}
                        >
                          {label} {key && <SortIcon column={key} />}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentPageData.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="p-8 text-center">
                          <Search className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                          <p className="text-slate-500 font-bold">No patients found.</p>
                        </td>
                      </tr>
                    ) : currentPageData.map((p, i) => {
                      const risk = p.evaluation?.risk_level || 'Low';
                      const score = p.evaluation?.risk_score || 0;
                      const riskColor = {
                        Critical: "text-red-700 bg-red-50",
                        High: "text-amber-700 bg-amber-50",
                        Medium: "text-blue-700 bg-blue-50",
                        Low: "text-emerald-700 bg-emerald-50"
                      }[risk];
                      const barColor = {
                        Critical: "bg-red-500",
                        High: "bg-amber-500",
                        Medium: "bg-blue-500",
                        Low: "bg-emerald-500"
                      }[risk];

                      return (
                        <motion.tr
                          key={`${p.patient_id}_${p.hospital_id || i}`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: Math.min(i * 0.02, 0.3) }}
                          className="group hover:bg-emerald-50/30 transition-colors"
                        /* onClick={() => setSelectedPatient(p)} */
                        >
                          <td className="p-4 font-bold text-slate-800">
                            <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded font-mono text-xs">{p.patient_id}</span>
                          </td>
                          <td className="p-4 text-slate-900 font-bold text-sm">{p.hospital?.name || 'N/A'}</td>
                          <td className="p-4 text-slate-700 font-bold text-sm">{p.age}</td>
                          <td className="p-4 text-slate-700 font-bold text-sm">{p.gender}</td>
                          <td className="p-4">
                            <span className={`inline-block px-2.5 py-1 rounded-lg font-bold text-xs ${riskColor}`}>{risk}</span>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-slate-800">{score.toFixed(1)}</span>
                              <div className="h-2 w-12 bg-slate-100 rounded overflow-hidden">
                                <div className={`h-full ${barColor}`} style={{ width: `${Math.min(100, score)}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-center">
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-black text-xs">
                              {p.admission_count || 0}
                            </span>
                          </td>
                          <td className="p-4 text-right font-bold text-slate-900">${p.price || 0}</td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Footer */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-4 flex-wrap">
                  {/* Left: record range */}
                  <p className="text-xs font-bold text-slate-400">
                    Page <span className="text-slate-700">{safePage}</span> of <span className="text-slate-700">{totalPages}</span>
                  </p>

                  {/* Center: page buttons */}
                  <div className="flex items-center gap-1">
                    {/* First page */}
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={safePage === 1}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      title="First page"
                    >
                      <ChevronsLeft className="w-4 h-4" />
                    </button>

                    {/* Prev page */}
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={safePage === 1}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      title="Previous page"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    {/* Numbered buttons */}
                    {getPageNumbers().map((page, idx) =>
                      page === '...' ? (
                        <span key={`ellipsis-${idx}`} className="w-8 h-8 flex items-center justify-center text-xs font-bold text-slate-300">
                          ···
                        </span>
                      ) : (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-black transition-all ${safePage === page
                            ? 'bg-slate-900 text-white shadow-md'
                            : 'text-slate-500 hover:bg-emerald-50 hover:text-emerald-700'
                            }`}
                        >
                          {page}
                        </button>
                      )
                    )}

                    {/* Next page */}
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={safePage === totalPages}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      title="Next page"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>

                    {/* Last page */}
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={safePage === totalPages}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      title="Last page"
                    >
                      <ChevronsRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Right: jump to page */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400">Go to</span>
                    <input
                      type="number"
                      min={1}
                      max={totalPages}
                      defaultValue={safePage}
                      key={safePage} // reset input when page changes externally
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val)) setCurrentPage(Math.min(totalPages, Math.max(1, val)));
                        }
                      }}
                      onBlur={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val)) setCurrentPage(Math.min(totalPages, Math.max(1, val)));
                      }}
                      className="w-14 h-8 text-center text-xs font-black border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-emerald-500 shadow-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}