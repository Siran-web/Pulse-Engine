import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Upload, CheckCircle, XCircle, Search, FileUp, Activity, Building2,
  UserMinus, LogOut, User as UserIcon, ShieldAlert, Plus, Trash2, Sliders,
  ToggleRight, ToggleLeft, Menu, X, ChevronLeft, ChevronRight
} from 'lucide-react';
import AddRuleModal from '../components/AddRuleModal';
import ConfirmModal from '../components/ConfirmModal';

const API = 'http://localhost:5001';
const PATIENTS_PER_PAGE = 12;

// ── Reusable Pagination ───────────────────────────────────────────────────────
const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;

  const pages = [];
  let start = Math.max(1, currentPage - 2);
  let end = Math.min(totalPages, start + 4);
  start = Math.max(1, end - 4);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="flex items-center justify-center gap-1.5 mt-8">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 disabled:opacity-30 hover:bg-slate-50 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      {start > 1 && (
        <>
          <button onClick={() => onPageChange(1)} className="w-9 h-9 text-sm font-bold rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors">1</button>
          {start > 2 && <span className="text-slate-300 text-sm px-1">…</span>}
        </>
      )}
      {pages.map(p => (
        <button
          key={p}
          onClick={() => onPageChange(p)}
          className={`w-9 h-9 text-sm font-black rounded-xl transition-all ${p === currentPage ? 'bg-slate-900 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
        >
          {p}
        </button>
      ))}
      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className="text-slate-300 text-sm px-1">…</span>}
          <button onClick={() => onPageChange(totalPages)} className="w-9 h-9 text-sm font-bold rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors">{totalPages}</button>
        </>
      )}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 disabled:opacity-30 hover:bg-slate-50 transition-colors"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
};

export default function HospitalAdminDashboard() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('rules');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Patients
  const [patients, setPatients] = useState([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [patientRiskFilter, setPatientRiskFilter] = useState('All');
  const [patientPage, setPatientPage] = useState(1);
  const [patientTotalPages, setPatientTotalPages] = useState(1);
  const [patientTotal, setPatientTotal] = useState(0);

  // Doctors & queue
  const [doctors, setDoctors] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Rules
  const [filteredRules, setFilteredRules] = useState([]);
  const [isAddingRule, setIsAddingRule] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Upload
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  // Confirm / Alert Modal
  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'confirm',
    onConfirm: null,
    confirmText: 'Confirm'
  });

  const showConfirm = (title, message, onConfirm, confirmText = 'Confirm') => {
    setModalConfig({ isOpen: true, title, message, type: 'confirm', onConfirm, confirmText });
  };

  const showAlert = (title, message, type = 'error') => {
    setModalConfig({ isOpen: true, title, message, type, onConfirm: null, confirmText: 'OK' });
  };

  const closeConfirmModal = () => setModalConfig(prev => ({ ...prev, isOpen: false }));

  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;

  const token = () => localStorage.getItem('token');

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  // ── Data fetchers ─────────────────────────────────────────────────────────

  const fetchPatients = async (page = 1) => {
    try {
      const params = new URLSearchParams({ context: 'admin', page, limit: PATIENTS_PER_PAGE });
      if (patientRiskFilter !== 'All') params.append('risk_level', patientRiskFilter);
      if (patientSearch.trim()) params.append('search', patientSearch.trim());
      const res = await axios.get(`${API}/api/patients?${params}`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      if (res.data.success) {
        setPatients(res.data.patients || []);
        setPatientTotalPages(res.data.pages || 1);
        setPatientTotal(res.data.total || 0);
        setPatientPage(page);
      }
    } catch (err) {
      console.error('Failed to fetch patients', err);
    }
  };

  const fetchRules = async () => {
    try {
      const res = await axios.get(`${API}/api/rules`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      if (res.data.success) {
        setFilteredRules(Array.isArray(res.data.rules) ? res.data.rules : []);
      }
    } catch (err) {
      console.error('Failed to fetch rules', err);
    }
  };

  const fetchDoctors = async () => {
    try {
      const res = await axios.get(`${API}/api/users/hospital/doctors`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      if (res.data.success) setDoctors(res.data.doctors || []);
    } catch (err) { console.error('Failed to fetch doctors', err); }
  };

  const fetchPendingUsers = async () => {
    try {
      const res = await axios.get(`${API}/api/users/pending`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      if (res.data.success) setPendingUsers(res.data.users);
    } catch (err) { console.error('Failed to fetch pending', err); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchDoctors();
    fetchPendingUsers();
    fetchRules();
    fetchPatients(1);
  }, []);

  // Re-fetch patients when filter or search changes (with debounce for search)
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchPatients(1);
    }, 400);
    return () => clearTimeout(delayDebounceFn);
  }, [patientRiskFilter, patientSearch]);

  // ── Patient actions ───────────────────────────────────────────────────────

  const handleDeletePatient = (id) => {
    showConfirm('Delete Patient', 'Are you sure you want to delete this patient record? This action cannot be undone.', async () => {
      try {
        const res = await axios.delete(`${API}/api/patients/${id}`, {
          headers: { Authorization: `Bearer ${token()}` }
        });
        if (res.data.success) fetchPatients(patientPage);
      } catch (err) {
        showAlert('Error', err.response?.data?.message || 'Failed to delete patient');
      }
    }, 'Delete');
  };

  const handleDeleteAllPatients = () => {
    showConfirm('Delete All Patients', 'Are you sure you want to delete ALL patients for this hospital? This cannot be undone.', async () => {
      try {
        const hospitalId = user?.hospital_id;
        if (!hospitalId) { showAlert('Error', 'Hospital ID not found.'); return; }
        const res = await axios.delete(`${API}/api/patients/hospital/${hospitalId}`, {
          headers: { Authorization: `Bearer ${token()}` }
        });
        if (res.data.success) { setPatients([]); setPatientTotalPages(1); setPatientTotal(0); }
      } catch (err) {
        showAlert('Error', err.response?.data?.message || 'Failed to delete patients');
      }
    }, 'Delete All');
  };

  // ── Rule actions ──────────────────────────────────────────────────────────

  const handleToggleRule = async (ruleId) => {
    try {
      setActionLoadingId(ruleId);
      const res = await axios.patch(`${API}/api/rules/${ruleId}/toggle-status`, {}, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      if (res.data.success) {
        setFilteredRules(prev => prev.map(r => r._id === ruleId ? res.data.rule : r));
      }
    } catch (err) {
      showAlert('Error', err.response?.data?.message || 'Failed to toggle rule');
    } finally { setActionLoadingId(null); }
  };

  const handleDeleteRule = (id) => {
    showConfirm('Delete Rule', 'Are you sure you want to deactivate and remove this rule?', async () => {
      try {
        const res = await axios.delete(`${API}/api/rules/${id}`, {
          headers: { Authorization: `Bearer ${token()}` }
        });
        if (res.data.success) fetchRules();
      } catch (err) {
        // Admin fallback — deactivate instead
        try {
          await axios.put(`${API}/api/rules/${id}`, { active: false }, {
            headers: { Authorization: `Bearer ${token()}` }
          });
          fetchRules();
        } catch {
          showAlert('Error', 'Failed to remove rule');
        }
      }
    }, 'Delete');
  };

  // ── Doctor / queue actions ────────────────────────────────────────────────

  const handleApprove = async (id) => {
    try {
      const res = await axios.put(`${API}/api/users/${id}/approve`, { role: 'doctor' }, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      if (res.data.success) { setPendingUsers(prev => prev.filter(u => u.id !== id)); fetchDoctors(); }
    } catch (err) { showAlert('Error', err.response?.data?.message || 'Failed to approve'); }
  };

  const handleReject = (id) => {
    showConfirm('Reject Request', 'Are you sure you want to reject this doctor request?', async () => {
      try {
        const res = await axios.put(`${API}/api/users/${id}/reject`, {}, {
          headers: { Authorization: `Bearer ${token()}` }
        });
        if (res.data.success) setPendingUsers(prev => prev.filter(u => u.id !== id));
      } catch (err) { showAlert('Error', err.response?.data?.message || 'Failed to reject'); }
    }, 'Reject');
  };

  const handleRemoveDoctor = (id) => {
    showConfirm('Remove Doctor', 'Are you sure you want to remove this doctor from the hospital?', async () => {
      try {
        const res = await axios.delete(`${API}/api/users/hospital/doctors/${id}`, {
          headers: { Authorization: `Bearer ${token()}` }
        });
        if (res.data.success) setDoctors(prev => prev.filter(u => u.id !== id));
      } catch (err) { showAlert('Error', err.response?.data?.message || 'Failed to remove doctor'); }
    }, 'Remove');
  };

  // ── Upload ────────────────────────────────────────────────────────────────

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setUploadResult(null);
    const formData = new FormData();
    formData.append('file', file);
    if (user?.hospital_id) formData.append('hospital_id', user.hospital_id);
    try {
      const res = await axios.post(`${API}/api/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${token()}` }
      });
      setUploadResult({ success: true, message: 'Upload and evaluation complete!', stats: res.data.stats });
      // Fetch the updated patients list in the background
      fetchPatients(1);
    } catch (err) {
      setUploadResult({ success: false, message: err.response?.data?.message || 'Upload failed.' });
    } finally { setUploading(false); setFile(null); }
  };

  // ── Nav helper ────────────────────────────────────────────────────────────

  const switchTab = (tab) => { setActiveTab(tab); setSidebarOpen(false); };

  const NAV = [
    { id: 'patients', label: 'Patients Database', Icon: UserIcon, badge: patientTotal > 0 ? patientTotal : null },
    { id: 'doctors', label: 'Manage Doctors', Icon: Users, badge: doctors.length > 0 ? doctors.length : null },
    { id: 'rules', label: 'Clinical Rules', Icon: Sliders, badge: null },
    { id: 'queue', label: 'Pending Requests', Icon: CheckCircle, badge: pendingUsers.length > 0 ? pendingUsers.length : null, accent: true },
    { id: 'upload', label: 'Data Ingestion', Icon: Upload, badge: null },
  ];

  const riskColor = (level) => ({
    Critical: 'bg-red-50 text-red-700 border-red-200',
    High: 'bg-amber-50 text-amber-700 border-amber-200',
    Medium: 'bg-blue-50 text-blue-700 border-blue-200',
    Low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  }[level] || 'bg-emerald-50 text-emerald-700 border-emerald-200');

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen bg-slate-50">

      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`
        fixed lg:sticky top-0 left-0 h-screen z-50
        w-64 shrink-0
        flex flex-col
        glass border-r border-slate-200/50
        p-6 overflow-y-auto
        transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3">
            <div className="bg-brand-600 p-2.5 rounded-xl shadow-lg shadow-brand-200">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <h2 className="font-display font-black text-slate-900 text-lg leading-none">
              Pulse<span className="text-brand-600">Engine</span>
            </h2>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 mb-3">Hospital Nav</p>

        <nav className="space-y-1 flex-grow">
          {NAV.map(({ id, label, Icon, badge, accent }) => (
            <button
              key={id}
              onClick={() => switchTab(id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm ${activeTab === id
                ? 'bg-slate-900 text-white shadow-lg'
                : 'text-slate-500 hover:bg-white hover:text-slate-900'
                }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${activeTab === id ? 'text-brand-400' : 'text-slate-400'}`} />
              <span className="font-bold truncate">{label}</span>
              {badge !== null && (
                <span className={`ml-auto text-[10px] font-black px-2 py-0.5 rounded-full ${accent ? 'bg-brand-600 text-white' : (activeTab === id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600')
                  }`}>{badge}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="mt-6 space-y-4">
          <div className="bg-brand-50 rounded-2xl p-4 border border-brand-100">
            <ShieldAlert className="w-4 h-4 text-brand-600 mb-2" />
            <p className="font-black text-slate-900 text-xs mb-1">Administrative Node</p>
            <p className="text-slate-500 text-[10px] leading-relaxed font-medium">Hospital management session active.</p>
          </div>
          <div className="flex items-center gap-3 px-1">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
              <UserIcon className="text-slate-400 w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-slate-900 truncate uppercase">{user?.name || 'Hospital Admin'}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{user?.role}</p>
            </div>
            <button onClick={handleLogout} className="p-2 rounded-lg bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all shrink-0">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col">

        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200 sticky top-0 z-30">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="bg-brand-600 p-1.5 rounded-lg">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <span className="font-black text-slate-900">Pulse<span className="text-brand-600">Engine</span></span>
          </div>
          <span className="ml-auto text-xs font-bold text-slate-400 uppercase tracking-wider">
            {NAV.find(n => n.id === activeTab)?.label}
          </span>
        </div>

        {/* Page content */}
        <div className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-6xl mx-auto w-full">

          {/* Page header */}
          <div className="flex justify-between items-center mb-6">
            <h1 className="font-display text-2xl font-bold text-slate-900">
              {{ patients: 'Patients Database', doctors: 'Manage Doctors', rules: 'Clinical Rules', queue: 'Pending Queue', upload: 'Data Ingestion' }[activeTab]}
            </h1>
            <div className="flex gap-2">
              {activeTab === 'patients' && patientTotal > 0 && (
                <button onClick={handleDeleteAllPatients} className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-bold text-sm border border-red-100">
                  <Trash2 className="w-4 h-4" /> Delete All
                </button>
              )}
              {activeTab === 'rules' && (
                <button onClick={() => setIsAddingRule(true)} className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-brand-100">
                  <Plus className="w-4 h-4" /> New Rule
                </button>
              )}
            </div>
          </div>

          <AnimatePresence mode="wait">

            {/* ── PATIENTS ──────────────────────────────────────────────── */}
            {activeTab === 'patients' && (
              <motion.div key="patients" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3 bg-white p-3 rounded-2xl border border-slate-200 mb-5 shadow-sm">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search name or ID…"
                      value={patientSearch}
                      onChange={e => setPatientSearch(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-sm font-bold text-slate-800 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                    />
                  </div>
                  <select
                    value={patientRiskFilter}
                    onChange={e => setPatientRiskFilter(e.target.value)}
                    className="sm:w-40 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 focus:outline-none focus:border-brand-400"
                  >
                    <option value="All">All Risk Levels</option>
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Moderate</option>
                    <option value="Low">Low</option>
                  </select>
                </div>

                {patients.length === 0 ? (
                  <div className="p-12 text-center rounded-2xl border border-dashed border-slate-300 bg-white">
                    <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="font-bold text-slate-600">No patients found</p>
                    <p className="text-slate-400 text-sm mt-1">Upload datasets in Data Ingestion.</p>
                  </div>
                ) : (
                  <>
                    {/* Result count */}
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
                      {patientTotal} patients · page {patientPage} of {patientTotalPages}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                      {patients
                        .map(patient => {
                          const evalData = patient.latestEvaluation;
                          const lvl = evalData?.risk_level || 'Low';
                          return (
                            <div key={patient.patient_id} className="relative group bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg hover:shadow-brand-100/20 transition-all p-5">
                              <button
                                onClick={() => handleDeletePatient(patient.patient_id)}
                                className="absolute top-3 right-3 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                              <div className="flex items-center gap-3 mb-3 pr-8">
                                <div className="w-11 h-11 bg-brand-50 rounded-xl flex items-center justify-center font-black text-brand-600 text-lg border border-brand-100 shrink-0">
                                  {patient.name?.charAt(0).toUpperCase() || '?'}
                                </div>
                                <div className="min-w-0">
                                  <h4 className="font-bold text-slate-900 truncate">{patient.name || 'Unnamed'}</h4>
                                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{patient.patient_id}</p>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-1.5 text-xs font-bold text-slate-500 mb-4">
                                <span className="bg-slate-100 px-2 py-0.5 rounded-md">{patient.age} yrs</span>
                                <span className="bg-slate-100 px-2 py-0.5 rounded-md">{patient.gender}</span>
                                <span className="bg-slate-100 px-2 py-0.5 rounded-md">Visits: {patient.visit_count || 0}</span>
                                <span className="bg-slate-100 px-2 py-0.5 rounded-md">Admissions: {patient.admission_count}</span>
                              </div>
                              <div className="border-t border-slate-100 pt-3 flex justify-between items-center">
                                <div>
                                  <p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Score</p>
                                  <p className="font-black text-xl text-slate-900 leading-none">{evalData?.risk_score || 0}</p>
                                </div>
                                <span className={`px-3 py-1.5 rounded-xl border text-xs font-black uppercase tracking-widest ${riskColor(evalData?.risk_level)}`}>
                                  {lvl === 'Medium' ? 'Moderate' : lvl}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                    </div>

                    <Pagination
                      currentPage={patientPage}
                      totalPages={patientTotalPages}
                      onPageChange={page => fetchPatients(page)}
                    />
                  </>
                )}
              </motion.div>
            )}

            {/* ── RULES ─────────────────────────────────────────────────── */}
            {activeTab === 'rules' && (
              <motion.div key="rules" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-5">

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Rules</p>
                    <p className="text-3xl font-black text-slate-900">{filteredRules.length}</p>
                  </div>
                  <div className="bg-brand-50 p-5 rounded-2xl border border-brand-100 shadow-sm">
                    <p className="text-[10px] font-black text-brand-600 uppercase tracking-widest mb-1">Global</p>
                    <p className="text-3xl font-black text-brand-600">{filteredRules.filter(r => r.scope === 'global').length}</p>
                  </div>
                  <div className="bg-slate-900 p-5 rounded-2xl shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Local</p>
                    <p className="text-3xl font-black text-white">{filteredRules.filter(r => r.scope !== 'global').length}</p>
                  </div>
                </div>

                {filteredRules.length === 0 ? (
                  <div className="p-16 text-center rounded-2xl border border-dashed border-slate-300 bg-white">
                    <Sliders className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="font-bold text-slate-600">No Rules Defined</p>
                    <p className="text-slate-400 text-sm mt-1">Create hospital-specific rules to refine patient scoring.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredRules.map(rule => (
                      <motion.div
                        key={rule._id}
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        className={`p-4 sm:p-5 rounded-2xl flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border transition-all ${rule.active
                          ? 'bg-white border-slate-100 hover:border-brand-200 hover:shadow-md'
                          : 'bg-slate-100 border-slate-200 opacity-70'
                          }`}
                      >
                        {/* Score circle */}
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-base shrink-0 ${rule.active
                            ? rule.scope === 'global' ? 'bg-brand-50 text-brand-600' : 'bg-slate-900 text-white'
                            : 'bg-slate-300 text-slate-600'
                            }`}>
                            {rule.score > 0 ? `+${rule.score}` : rule.score}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                              <h4 className="font-bold text-slate-800">{rule.name}</h4>
                              {rule.scope === 'global' && (
                                <span className="text-[9px] font-black bg-brand-600 text-white px-2 py-0.5 rounded-full uppercase tracking-widest">Global</span>
                              )}
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest border ${rule.active ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-200 text-slate-600 border-slate-300'
                                }`}>
                                {rule.active ? 'Enabled' : 'Disabled'}
                              </span>
                            </div>
                            <div className={`text-xs font-bold px-3 py-2 rounded-lg w-fit ${rule.active ? 'bg-slate-50 border border-slate-200 text-slate-600' : 'bg-slate-200 text-slate-500'
                              }`}>
                              {Array.isArray(rule.conditions) && rule.conditions.length > 0
                                ? rule.conditions.map(c => `${c.field} ${c.operator} ${c.value}`).join(` ${rule.logic || 'AND'} `)
                                : 'No conditions'}
                            </div>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1.5">
                              Context: {Array.isArray(rule.context) ? rule.context.join(', ') : rule.context}
                            </p>
                          </div>
                        </div>

                        {/* Explanation */}
                        <p className="text-xs text-slate-400 italic max-w-xs line-clamp-2 lg:text-right hidden lg:block">
                          "{rule.explanation_template || 'No explanation defined.'}"
                        </p>

                        {/* Actions */}
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => handleToggleRule(rule._id)}
                            disabled={actionLoadingId === rule._id}
                            className={`p-2.5 rounded-xl border transition-all disabled:opacity-50 ${rule.active
                              ? 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100'
                              : 'bg-black text-white border-black hover:bg-slate-800'
                              }`}
                          >
                            {rule.active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => handleDeleteRule(rule._id)}
                            className="p-2.5 rounded-xl bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 border border-slate-100 hover:border-red-100 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* ── DOCTORS ───────────────────────────────────────────────── */}
            {activeTab === 'doctors' && (
              <motion.div key="doctors" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                {doctors.length === 0 ? (
                  <div className="p-12 text-center rounded-2xl border border-dashed border-slate-300 bg-white">
                    <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="font-bold text-slate-600">No Active Doctors</p>
                    <p className="text-slate-400 text-sm mt-1">Approve pending registrations to add doctors.</p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {doctors.map(doctor => (
                      <div key={doctor.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-brand-50 rounded-full flex items-center justify-center font-black text-brand-600 border border-brand-100">
                            {doctor.name?.charAt(0).toUpperCase() || '?'}
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900">{doctor.name}</h4>
                            <p className="text-xs text-slate-500">{doctor.email}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveDoctor(doctor.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl text-sm font-bold border border-red-100"
                        >
                          <UserMinus className="w-4 h-4" /> Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* ── QUEUE ─────────────────────────────────────────────────── */}
            {activeTab === 'queue' && (
              <motion.div key="queue" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-3">
                {loading ? (
                  <div className="text-center p-12 text-slate-400 font-bold">Loading…</div>
                ) : pendingUsers.length === 0 ? (
                  <div className="p-12 text-center rounded-2xl border border-dashed border-slate-300 bg-white">
                    <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                    <p className="font-bold text-slate-600">All caught up!</p>
                    <p className="text-slate-400 text-sm mt-1">No pending doctor registrations.</p>
                  </div>
                ) : (
                  pendingUsers.map(u => (
                    <div key={u.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-black text-slate-600 border border-slate-200">
                          {u.name?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900">{u.name}</h4>
                          <p className="text-xs text-slate-500">{u.email}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleReject(u.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-red-600 bg-white hover:bg-red-50 rounded-xl text-sm font-bold border border-slate-200 hover:border-red-200">
                          <XCircle className="w-4 h-4" /> Reject
                        </button>
                        <button onClick={() => handleApprove(u.id)} className="flex items-center gap-1.5 px-4 py-1.5 text-white bg-brand-600 hover:bg-brand-500 rounded-xl text-sm font-bold shadow-sm">
                          <CheckCircle className="w-4 h-4" /> Approve
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </motion.div>
            )}

            {/* ── UPLOAD ────────────────────────────────────────────────── */}
            {activeTab === 'upload' && (
              <motion.div key="upload" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center text-center max-w-lg mx-auto">
                  <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center mb-5 border border-brand-100">
                    <FileUp className="w-8 h-8 text-brand-600" />
                  </div>
                  <h3 className="font-black text-xl text-slate-800 mb-1">Upload Patient Dataset</h3>
                  <p className="text-slate-500 text-sm mb-6">Upload an Excel (.xlsx) file to run the evaluation engine.</p>

                  <form onSubmit={handleFileUpload} className="w-full">
                    <label className={`block w-full border-2 border-dashed rounded-xl p-6 mb-4 cursor-pointer transition-all ${file ? 'border-brand-400 bg-brand-50/50' : 'border-slate-200 hover:border-brand-300 bg-slate-50 hover:bg-white'}`}>
                      <input type="file" className="hidden" accept=".xlsx,.xls" onChange={e => setFile(e.target.files[0])} />
                      <Upload className={`w-7 h-7 mb-2 mx-auto ${file ? 'text-brand-600' : 'text-slate-400'}`} />
                      <p className="font-semibold text-slate-700 text-sm">{file ? file.name : 'Select or drop an Excel file'}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'XLSX, max 50MB'}</p>
                    </label>
                    <button type="submit" disabled={!file || uploading} className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                      {uploading ? <><Activity className="w-4 h-4 animate-spin" /> Processing…</> : <><Activity className="w-4 h-4" /> Start Evaluation Run</>}
                    </button>
                  </form>

                  {uploadResult && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`mt-5 p-4 w-full rounded-xl text-left border ${uploadResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                      <h4 className={`font-bold flex items-center gap-2 text-sm ${uploadResult.success ? 'text-green-800' : 'text-red-800'}`}>
                        {uploadResult.success ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                        {uploadResult.success ? 'Success' : 'Failed'}
                      </h4>
                      <p className={`text-sm mt-1 ${uploadResult.success ? 'text-green-700' : 'text-red-700'}`}>{uploadResult.message}</p>
                      {uploadResult.stats && (
                        <div className="mt-3 space-y-1 bg-white/60 p-3 rounded-lg">
                          <div className="flex justify-between text-sm"><span className="text-slate-600">Records Processed</span><span className="font-bold">{uploadResult.stats.total_rows || 0}</span></div>
                          <div className="flex justify-between text-sm"><span className="text-slate-600">Errors</span><span className="font-bold text-red-600">{uploadResult.stats.errors || 0}</span></div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>

      {/* Add Rule Modal */}
      <AnimatePresence>
        <AddRuleModal
          isOpen={isAddingRule}
          onClose={() => setIsAddingRule(false)}
          role={user?.role}
          onSuccess={() => { setIsAddingRule(false); fetchRules(); }}
        />
      </AnimatePresence>

      <AnimatePresence>
        <ConfirmModal
          isOpen={modalConfig.isOpen}
          title={modalConfig.title}
          message={modalConfig.message}
          type={modalConfig.type}
          onConfirm={modalConfig.onConfirm}
          onClose={closeConfirmModal}
          confirmText={modalConfig.confirmText}
        />
      </AnimatePresence>
    </div>
  );
}