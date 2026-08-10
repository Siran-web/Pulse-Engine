import React, { useState, useEffect } from 'react';
import { Trash2, ToggleLeft, ToggleRight, Menu, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, CheckCircle, XCircle, Search, Activity, Building2,
  Shield, Plus, Link as LinkIcon, ShieldAlert, User as UserIcon,
  LogOut, Edit3, Gavel, BarChart3
} from 'lucide-react';
import AddRuleModal from '../components/AddRuleModal';

const API = 'http://localhost:5001';
const USERS_PER_PAGE = 10;

// ── Pagination component ──────────────────────────────────────────────────────
const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;

  const pages = [];
  let start = Math.max(1, currentPage - 2);
  let end = Math.min(totalPages, start + 4);
  start = Math.max(1, end - 4);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
      <p className="text-xs font-bold text-slate-400">Page {currentPage} of {totalPages}</p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 disabled:opacity-30 hover:bg-slate-50"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        {start > 1 && (
          <>
            <button onClick={() => onPageChange(1)} className="w-8 h-8 text-xs font-bold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50">1</button>
            {start > 2 && <span className="text-slate-300 text-xs px-0.5">…</span>}
          </>
        )}
        {pages.map(p => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`w-8 h-8 text-xs font-black rounded-lg transition-all ${p === currentPage ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            {p}
          </button>
        ))}
        {end < totalPages && (
          <>
            {end < totalPages - 1 && <span className="text-slate-300 text-xs px-0.5">…</span>}
            <button onClick={() => onPageChange(totalPages)} className="w-8 h-8 text-xs font-bold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50">{totalPages}</button>
          </>
        )}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 disabled:opacity-30 hover:bg-slate-50"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isAddingRule, setIsAddingRule] = useState(false);

  // Users
  const [pendingUsers, setPendingUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [usersPage, setUsersPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Hospitals & insurance
  const [hospitals, setHospitals] = useState([]);
  const [insuranceOrgs, setInsuranceOrgs] = useState([]);
  const [dashboardStats, setDashboardStats] = useState({});
  const [editingHospital, setEditingHospital] = useState(null);
  const [newHospitalData, setNewHospitalData] = useState({ name: '', city: '' });
  const [newInsuranceData, setNewInsuranceData] = useState({ name: '' });
  const [linkData, setLinkData] = useState({ hospital_id: '', insurance_org_id: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Rules
  const [rules, setRules] = useState([]);

  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const token = () => localStorage.getItem('token');

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  // ── Fetchers ──────────────────────────────────────────────────────────────

  const fetchHospitals = async () => {
    try {
      const res = await axios.get(`${API}/api/hospitals`, { headers: { Authorization: `Bearer ${token()}` } });
      if (res.data.success) setHospitals(res.data.hospitals || []);
    } catch (err) { console.error(err); }
  };

  const fetchInsuranceOrgs = async () => {
    try {
      const res = await axios.get(`${API}/api/hospitals/insurance-orgs`, { headers: { Authorization: `Bearer ${token()}` } });
      if (res.data.success) setInsuranceOrgs(res.data.orgs || []);
    } catch (err) { console.error(err); }
  };

  const fetchPendingUsers = async () => {
    try {
      const res = await axios.get(`${API}/api/users/pending`, { headers: { Authorization: `Bearer ${token()}` } });
      if (res.data.success) setPendingUsers(res.data.users);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const fetchRules = async () => {
    try {
      const res = await axios.get(`${API}/api/rules`, { headers: { Authorization: `Bearer ${token()}` } });
      if (res.data.success) setRules(res.data.rules || []);
    } catch (err) { console.error(err); }
  };

  const fetchDashboardStats = async () => {
    try {
      const res = await axios.get(`${API}/api/users/dashboard/stats`, { headers: { Authorization: `Bearer ${token()}` } });
      if (res.data.success) setDashboardStats(res.data.stats);
    } catch (err) { console.error(err); }
  };

  const fetchAllUsers = async () => {
    try {
      const res = await axios.get(`${API}/api/users`, { headers: { Authorization: `Bearer ${token()}` } });
      if (res.data.success) setAllUsers(res.data.users);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    fetchPendingUsers();
    fetchHospitals();
    fetchInsuranceOrgs();
    fetchRules();
    fetchAllUsers();
    fetchDashboardStats();
  }, []);

  // ── User actions ──────────────────────────────────────────────────────────

  const handleApprove = async (id) => {
    const userToApprove = pendingUsers.find(u => u.id === id);
    if (!userToApprove?.role) { alert('No role designated.'); return; }
    try {
      const res = await axios.put(`${API}/api/users/${id}/approve`, { role: userToApprove.role }, { headers: { Authorization: `Bearer ${token()}` } });
      if (res.data.success) { setPendingUsers(prev => prev.filter(u => u.id !== id)); fetchDashboardStats(); }
    } catch (err) { alert(err.response?.data?.message || 'Failed to approve'); }
  };

  const handleReject = async (id) => {
    if (!window.confirm('Reject and delete this user?')) return;
    try {
      const res = await axios.put(`${API}/api/users/${id}/reject`, {}, { headers: { Authorization: `Bearer ${token()}` } });
      if (res.data.success) { setPendingUsers(prev => prev.filter(u => u.id !== id)); fetchDashboardStats(); }
    } catch (err) { alert(err.response?.data?.message || 'Failed to reject'); }
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm('Delete this user permanently?')) return;
    try {
      const res = await axios.delete(`${API}/api/users/${id}`, { headers: { Authorization: `Bearer ${token()}` } });
      if (res.data.success) { setAllUsers(prev => prev.filter(u => u.id !== id)); fetchDashboardStats(); }
    } catch (err) { alert('Failed to delete user'); }
  };

  // ── Hospital actions ──────────────────────────────────────────────────────

  const handleCreateHospital = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API}/api/hospitals`, newHospitalData, { headers: { Authorization: `Bearer ${token()}` } });
      if (res.data.success) { setNewHospitalData({ name: '', city: '' }); fetchHospitals(); fetchDashboardStats(); }
    } catch (err) { alert(err.response?.data?.message || 'Failed to create hospital'); }
  };

  const handleUpdateHospital = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.put(`${API}/api/hospitals/${editingHospital.id}`, editingHospital, { headers: { Authorization: `Bearer ${token()}` } });
      if (res.data.success) { setEditingHospital(null); fetchHospitals(); fetchDashboardStats(); }
    } catch (err) { alert(err.response?.data?.message || 'Failed to update'); }
  };

  const handleDeleteHospital = async (id) => {
    if (!window.confirm('Decommission this hospital? All associated records will be removed.')) return;
    try {
      const res = await axios.delete(`${API}/api/hospitals/${id}`, { headers: { Authorization: `Bearer ${token()}` } });
      if (res.data.success) { setHospitals(prev => prev.filter(h => h.id !== id)); fetchDashboardStats(); }
    } catch (err) { alert(err.response?.data?.message || 'Failed'); }
  };

  // ── Insurance actions ─────────────────────────────────────────────────────

  const handleCreateInsurance = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API}/api/hospitals/insurance-orgs`, newInsuranceData, { headers: { Authorization: `Bearer ${token()}` } });
      if (res.data.success) { setNewInsuranceData({ name: '' }); fetchInsuranceOrgs(); fetchDashboardStats(); }
    } catch (err) { alert(err.response?.data?.message || 'Failed'); }
  };

  const handleLinkInsurance = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API}/api/hospitals/insurance-link`, linkData, { headers: { Authorization: `Bearer ${token()}` } });
      if (res.data.success) { setLinkData({ hospital_id: '', insurance_org_id: '' }); fetchHospitals(); fetchInsuranceOrgs(); fetchDashboardStats(); }
    } catch (err) { alert(err.response?.data?.message || 'Failed'); }
  };

  const handleToggleLink = async (linkId) => {
    try {
      await axios.put(`${API}/api/hospitals/insurance-link/${linkId}`, {}, { headers: { Authorization: `Bearer ${token()}` } });
      fetchInsuranceOrgs();
      fetchDashboardStats();
    } catch (err) { alert('Failed to toggle link'); }
  };

  const handleDeleteInsuranceOrg = async (orgId) => {
    if (!window.confirm('Delete this insurance organization?')) return;
    try {
      await axios.delete(`${API}/api/hospitals/insurance-orgs/${orgId}`, { headers: { Authorization: `Bearer ${token()}` } });
      fetchInsuranceOrgs();
      fetchDashboardStats();
    } catch (err) { alert(err.response?.data?.message || 'Failed'); }
  };

  // ── Rule actions ──────────────────────────────────────────────────────────

  const handleToggleRule = async (ruleId) => {
    try {
      setActionLoadingId(ruleId);
      const res = await axios.patch(`${API}/api/rules/${ruleId}/toggle-status`, {}, { headers: { Authorization: `Bearer ${token()}` } });
      if (res.data.success) { setRules(prev => prev.map(r => r._id === ruleId ? res.data.rule : r)); fetchDashboardStats(); }
    } catch (err) { console.error('Failed to toggle rule', err); }
    finally { setActionLoadingId(null); }
  };

  const handleDeleteRule = async (id) => {
    if (!window.confirm('Delete this clinical rule permanently?')) return;
    try {
      const res = await axios.delete(`${API}/api/rules/${id}`, { headers: { Authorization: `Bearer ${token()}` } });
      if (res.data.success) { fetchRules(); fetchDashboardStats(); }
    } catch (err) { alert(err.response?.data?.message || 'Failed to delete rule'); }
  };

  // ── Derived / helpers ─────────────────────────────────────────────────────

  const formatConditions = (rule) => {
    if (Array.isArray(rule.conditions) && rule.conditions.length > 0)
      return rule.conditions.map(c => `${c.field} ${c.operator} ${c.value}`).join(` ${rule.logic || 'AND'} `);
    return 'No conditions defined';
  };

  const filteredInsuranceOrgs = insuranceOrgs.filter(org =>
    org.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Users pagination (client-side)
  const usersTotalPages = Math.ceil(allUsers.length / USERS_PER_PAGE);
  const paginatedUsers = allUsers.slice((usersPage - 1) * USERS_PER_PAGE, usersPage * USERS_PER_PAGE);

  const switchTab = (tab) => { setActiveTab(tab); setSidebarOpen(false); };

  const NAV = [
    { id: 'dashboard', label: 'Dashboard', Icon: BarChart3 },
    { id: 'queue', label: 'Admin Requests', Icon: Users, badge: pendingUsers.length, accent: true },
    { id: 'hospitals', label: 'Manage Hospitals', Icon: Building2 },
    { id: 'insurance', label: 'Provider Coverage', Icon: Shield },
    { id: 'rules', label: 'Rules Management', Icon: Gavel },
  ];

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
        w-64 shrink-0 flex flex-col
        glass border-r border-slate-200/50
        p-6 overflow-y-auto
        transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
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

        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 mb-3">Administration</p>

        <nav className="space-y-1 flex-grow">
          {NAV.map(({ id, label, Icon, badge, accent }) => (
            <button
              key={id}
              onClick={() => switchTab(id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm ${activeTab === id ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-white hover:text-slate-900'
                }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${activeTab === id ? 'text-brand-400' : 'text-slate-400'}`} />
              <span className="font-bold truncate">{label}</span>
              {badge > 0 && (
                <span className={`ml-auto text-[10px] font-black px-2 py-0.5 rounded-full ${accent ? 'bg-brand-600 text-white' : (activeTab === id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600')
                  }`}>{badge}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="mt-6 space-y-4">

          <div className="flex items-center gap-3 px-1">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
              <UserIcon className="text-slate-400 w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-slate-900 truncate uppercase">{user?.name || 'Super Admin'}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{user?.role}</p>
            </div>
            <button onClick={handleLogout} className="p-2 rounded-lg bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all shrink-0">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
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
        <div className="flex-1 px-4 sm:px-6 lg:px-10 py-8 max-w-7xl mx-auto w-full">
          <AnimatePresence mode="wait">

            {/* ── DASHBOARD ─────────────────────────────────────────────── */}
            {activeTab === 'dashboard' && (
              <motion.div key="dashboard" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-8">
                <div>
                  <div className="flex items-center gap-2 text-blue-600 font-black text-[10px] uppercase tracking-widest mb-1">
                    <BarChart3 className="w-3.5 h-3.5" /> System Overview
                  </div>
                  <h2 className="text-2xl font-black text-slate-900">Admin Dashboard</h2>
                  <p className="text-slate-500 text-sm mt-0.5">Comprehensive system metrics and user management.</p>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Users', value: dashboardStats.totalUsers || 0 },
                    { label: 'Total Hospitals', value: dashboardStats.totalHospitals || 0 },
                    { label: 'Insurance Companies', value: dashboardStats.totalInsurance || 0 },
                    { label: 'Total Doctors', value: dashboardStats.totalDoctors || 0 },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{label}</p>
                      <p className="text-4xl font-black text-slate-900">{value}</p>
                    </div>
                  ))}
                </div>

                {/* All users table with pagination */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100">
                    <h3 className="text-lg font-black text-slate-900">All Users</h3>
                    <p className="text-sm text-slate-400 font-medium">Manage all registered users · {allUsers.length} total</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[600px]">
                      <thead className="bg-slate-50">
                        <tr>
                          {['ID', 'Name', 'Role', 'Org Type', 'Org Name', 'Actions'].map(h => (
                            <th key={h} className="px-5 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {paginatedUsers.map(u => (
                          <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-5 py-3 text-sm font-bold text-slate-500">#{u.id}</td>
                            <td className="px-5 py-3 text-sm font-bold text-slate-900">{u.name}</td>
                            <td className="px-5 py-3">
                              <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-widest ${u.role === 'super_admin' ? 'bg-purple-50 text-purple-700' :
                                u.role === 'admin' ? 'bg-brand-50 text-brand-700' :
                                  u.role === 'doctor' ? 'bg-emerald-50 text-emerald-700' :
                                    'bg-slate-100 text-slate-600'
                                }`}>{u.role}</span>
                            </td>
                            <td className="px-5 py-3 text-sm text-slate-500">{u.hospital ? 'Hospital' : u.insuranceOrg ? 'Insurance' : '—'}</td>
                            <td className="px-5 py-3 text-sm text-slate-700 font-medium">{u.hospital?.name || u.insuranceOrg?.name || '—'}</td>
                            {
                              u.role !== 'super_admin' && <td className="px-5 py-3">
                                <button onClick={() => handleDeleteUser(u.id)} className="p-1.5 text-rose-400 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-colors">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            }

                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Pagination
                    currentPage={usersPage}
                    totalPages={usersTotalPages}
                    onPageChange={p => { setUsersPage(p); }}
                  />
                </div>
              </motion.div>
            )}

            {/* ── QUEUE ─────────────────────────────────────────────────── */}
            {activeTab === 'queue' && (
              <motion.div key="queue" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {pendingUsers.length > 0 && <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{pendingUsers.length} Pending Approval</span>
                  </div>
                  <h2 className="text-2xl font-black text-slate-900">Registration Queue</h2>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-16 bg-white rounded-2xl border border-slate-200">
                    <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : pendingUsers.length === 0 ? (
                  <div className="p-16 text-center bg-white rounded-2xl border border-slate-200">
                    <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                    <h3 className="text-xl font-black text-slate-900">All Caught Up</h3>
                    <p className="text-slate-400 mt-1">No pending authentication requests.</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {pendingUsers.map(u => (
                      <motion.div key={u.id} layout className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-brand-200 transition-all">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center font-black text-brand-400 text-lg shrink-0">
                              {u.name?.charAt(0).toUpperCase() || '?'}
                            </div>
                            <div>
                              <h4 className="font-black text-slate-900 text-base">{u.name}</h4>
                              <p className="text-sm text-slate-500">{u.email}</p>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{u.org_name}</span>
                                <span className="text-[10px] font-black bg-brand-50 text-brand-700 px-2 py-0.5 rounded-lg uppercase tracking-widest border border-brand-100">
                                  {u.role === 'admin' ? 'Hospital Admin' : u.role === 'doctor' ? 'Doctor' : u.role}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <button onClick={() => handleReject(u.id)} className="flex items-center gap-1.5 px-4 py-2 text-red-600 bg-white hover:bg-red-50 rounded-xl text-sm font-bold border border-slate-200 hover:border-red-200">
                              <XCircle className="w-4 h-4" /> Reject
                            </button>
                            <button onClick={() => handleApprove(u.id)} className="flex items-center gap-1.5 px-4 py-2 text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl text-sm font-bold shadow-sm">
                              <CheckCircle className="w-4 h-4" /> Approve
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* ── HOSPITALS ─────────────────────────────────────────────── */}
            {activeTab === 'hospitals' && (
              <motion.div key="hospitals" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-8">
                <div>
                  <div className="flex items-center gap-2 text-brand-600 font-black text-[10px] uppercase tracking-widest mb-1">
                    <Building2 className="w-3.5 h-3.5" /> Infrastructure Control
                  </div>
                  <h2 className="text-2xl font-black text-slate-900">Hospital Administration</h2>
                  <p className="text-slate-500 text-sm mt-0.5">{hospitals.length} facilities registered in the network.</p>
                </div>

                {/* Add hospital form (collapsed style) */}
                <details className="group bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <summary className="flex items-center justify-between px-6 py-4 cursor-pointer font-bold text-slate-700 text-sm list-none select-none hover:bg-slate-50">
                    <span className="flex items-center gap-2"><Plus className="w-4 h-4 text-brand-600" /> Register New Hospital</span>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-open:rotate-90 transition-transform" />
                  </summary>
                  <form onSubmit={handleCreateHospital} className="px-6 pb-5 pt-2 grid sm:grid-cols-2 gap-4 border-t border-slate-100">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">Facility Name</label>
                      <input required value={newHospitalData.name} onChange={e => setNewHospitalData({ ...newHospitalData, name: e.target.value })} placeholder="e.g. Mayo Clinic" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">City</label>
                      <input required value={newHospitalData.city} onChange={e => setNewHospitalData({ ...newHospitalData, city: e.target.value })} placeholder="e.g. Rochester, MN" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100" />
                    </div>
                    <div className="sm:col-span-2">
                      <button type="submit" className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all">Create Hospital</button>
                    </div>
                  </form>
                </details>

                {/* Edit inline panel */}
                <AnimatePresence>
                  {editingHospital && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-black text-white flex items-center gap-2"><Edit3 className="w-4 h-4 text-brand-400" /> Edit Facility #{editingHospital.id}</h3>
                        <button onClick={() => setEditingHospital(null)} className="p-1.5 bg-slate-800 text-slate-400 hover:text-white rounded-lg"><X className="w-4 h-4" /></button>
                      </div>
                      <form onSubmit={handleUpdateHospital} className="grid sm:grid-cols-2 gap-4">
                        <input required value={editingHospital.name} onChange={e => setEditingHospital({ ...editingHospital, name: e.target.value })} className="px-4 py-2.5 bg-slate-800 text-white rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-500/30" placeholder="Facility Name" />
                        <input required value={editingHospital.city} onChange={e => setEditingHospital({ ...editingHospital, city: e.target.value })} className="px-4 py-2.5 bg-slate-800 text-white rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-500/30" placeholder="City" />
                        <button type="submit" className="sm:col-span-2 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-black text-xs uppercase tracking-widest">Update</button>
                      </form>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Hospital list */}
                <div className="space-y-3">
                  {hospitals.length === 0 ? (
                    <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-300">
                      <Building2 className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                      <p className="text-slate-400 font-bold text-sm">No facilities registered</p>
                    </div>
                  ) : (
                    hospitals.map(h => {
                      const admin = h.users?.find(u => u.role === 'admin');
                      return (
                        <motion.div layout key={h.id} className="group bg-white rounded-2xl border border-slate-200 p-5 flex items-center justify-between hover:shadow-md hover:border-brand-200 transition-all">
                          <div className="flex items-center gap-4">
                            <div className="w-11 h-11 bg-slate-50 group-hover:bg-slate-900 rounded-xl flex items-center justify-center border border-slate-100 transition-colors">
                              <Building2 className="w-5 h-5 text-slate-400 group-hover:text-brand-400 transition-colors" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-black text-slate-900">{h.name}</h4>
                                <span className="px-2 py-0.5 bg-brand-50 text-brand-600 text-[9px] font-black uppercase rounded-md border border-brand-100">Live</span>
                              </div>
                              <p className="text-xs text-slate-400 mt-0.5 font-bold">{h.city || 'Global'}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => setEditingHospital({ id: h.id, name: h.name, city: h.city || '' })} className="p-2.5 bg-slate-50 text-slate-400 hover:bg-brand-50 hover:text-brand-600 rounded-xl border border-slate-100 transition-all">
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDeleteHospital(h.id)} className="p-2.5 bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 rounded-xl border border-slate-100 transition-all">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </div>
              </motion.div>
            )}

            {/* ── INSURANCE ─────────────────────────────────────────────── */}
            {activeTab === 'insurance' && (
              <motion.div key="insurance" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-8">
                <div>
                  <div className="flex items-center gap-2 text-blue-600 font-black text-[10px] uppercase tracking-widest mb-1">
                    <Shield className="w-3.5 h-3.5" /> Security & Network
                  </div>
                  <h2 className="text-2xl font-black text-slate-900">Provider Coverage</h2>
                  <p className="text-slate-500 text-sm mt-0.5">Manage insurance partnerships and facility network access.</p>
                </div>

                <div className="grid lg:grid-cols-3 gap-6">
                  {/* Management tools */}
                  <div className="space-y-4">
                    {/* Create org */}
                    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                      <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center mb-4">
                        <Plus className="w-5 h-5 text-blue-400" />
                      </div>
                      <h3 className="font-black text-slate-900 mb-1">Register Carrier</h3>
                      <p className="text-xs text-slate-500 mb-4">Add a new insurance organization to the network.</p>
                      <form onSubmit={handleCreateInsurance} className="space-y-3">
                        <input required placeholder="e.g. UnitedHealth Group" value={newInsuranceData.name} onChange={e => setNewInsuranceData({ name: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
                        <button type="submit" className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs uppercase tracking-widest">Provision Organization</button>
                      </form>
                    </div>

                    {/* Link org */}
                    <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
                      <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center mb-4">
                        <LinkIcon className="w-5 h-5 text-white" />
                      </div>
                      <h3 className="font-black text-white mb-1">Establish Coverage</h3>
                      <p className="text-xs text-slate-400 mb-4">Link a carrier to a medical facility.</p>
                      <form onSubmit={handleLinkInsurance} className="space-y-3">
                        <select required value={linkData.hospital_id} onChange={e => setLinkData({ ...linkData, hospital_id: e.target.value })} className="w-full px-4 py-2.5 bg-slate-800 text-white rounded-xl text-sm font-bold focus:outline-none">
                          <option value="" disabled>Choose Hospital…</option>
                          {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                        </select>
                        <select required value={linkData.insurance_org_id} onChange={e => setLinkData({ ...linkData, insurance_org_id: e.target.value })} className="w-full px-4 py-2.5 bg-slate-800 text-white rounded-xl text-sm font-bold focus:outline-none">
                          <option value="" disabled>Choose Org…</option>
                          {insuranceOrgs.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                        </select>
                        <button type="submit" className="w-full py-2.5 bg-white text-slate-900 hover:bg-blue-50 rounded-xl font-black text-xs uppercase tracking-widest">Link Network Coverage</button>
                      </form>
                    </div>
                  </div>

                  {/* Directory */}
                  <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-slate-100 flex items-center justify-between gap-4">
                      <div>
                        <h3 className="font-black text-slate-900">Coverage Directory</h3>
                        <p className="text-xs text-slate-400">{insuranceOrgs.length} carriers</p>
                      </div>
                      <div className="relative">
                        <Search className="w-4 h-4 text-slate-300 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input placeholder="Search…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 pr-4 py-2 bg-slate-50 rounded-xl text-sm font-bold w-40 focus:outline-none focus:ring-2 focus:ring-blue-100" />
                      </div>
                    </div>
                    <div className="p-5 grid sm:grid-cols-2 gap-4 overflow-y-auto max-h-[600px]">
                      {filteredInsuranceOrgs.map(org => {
                        const links = org.hospitals || [];
                        return (
                          <div key={org.id} className="bg-slate-50 rounded-xl border border-slate-100 p-4 hover:bg-white hover:shadow-md transition-all">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center border border-slate-100">
                                <Shield className="w-4 h-4 text-blue-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-slate-900 text-sm truncate">{org.name}</h4>
                                <p className="text-[10px] font-black text-blue-600 uppercase tracking-wide">{links.length} Facilities</p>
                              </div>
                              <button onClick={() => handleDeleteInsuranceOrg(org.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <div className="space-y-2">
                              {links.length === 0 ? (
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center py-2">No Active Links</p>
                              ) : (
                                links.map(h => {
                                  const isActive = h.HospitalInsurance?.active;
                                  const linkId = h.HospitalInsurance?.id;
                                  return (
                                    <div key={h.id} className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-slate-100">
                                      <div className="flex items-center gap-2">
                                        <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`} />
                                        <span className="text-sm font-bold text-slate-700">{h.name}</span>
                                      </div>
                                      {linkId && (
                                        <button onClick={() => handleToggleLink(linkId)} className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${isActive ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500'}`}>
                                          {isActive ? 'Live' : 'Off'}
                                        </button>
                                      )}
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── RULES ─────────────────────────────────────────────────── */}
            {activeTab === 'rules' && (
              <motion.div key="rules" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-brand-600 font-black text-[10px] uppercase tracking-widest mb-1">
                      <Gavel className="w-3.5 h-3.5" /> Clinical Rules Engine
                    </div>
                    <h2 className="text-2xl font-black text-slate-900">Global Clinical Rules</h2>
                  </div>
                  <button onClick={() => setIsAddingRule(true)} className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-brand-100">
                    <Plus className="w-4 h-4" /> New Rule
                  </button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total rule</p>
                    <p className="text-4xl font-black text-slate-900">{rules.length}</p>
                  </div>
                  <div className="bg-brand-50 p-5 rounded-2xl border border-brand-100">
                    <p className="text-[10px] font-black text-brand-600 uppercase tracking-widest mb-1">Global</p>
                    <p className="text-4xl font-black text-brand-600">{rules.filter(r => r.scope === 'global').length}</p>
                  </div>
                  <div className="bg-slate-900 p-5 rounded-2xl">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Hospital-Specific</p>
                    <p className="text-4xl font-black text-white">{rules.filter(r => r.scope !== 'global').length}</p>
                  </div>
                </div>

                {rules.length === 0 ? (
                  <div className="p-16 text-center bg-white rounded-2xl border border-dashed border-slate-300">
                    <Gavel className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="font-bold text-slate-600">No Rules Defined</p>
                    <p className="text-slate-400 text-sm mt-1">Create global rules to drive patient risk scoring.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {rules.map(rule => (
                      <motion.div
                        key={rule._id}
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        className={`p-5 rounded-2xl flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border transition-all ${rule.active ? 'bg-white border-slate-100 hover:border-brand-200 hover:shadow-md' : 'bg-slate-100 border-slate-200 opacity-70'
                          }`}
                      >
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
                              {rule.scope === 'global' && <span className="text-[9px] font-black bg-brand-600 text-white px-2 py-0.5 rounded-full uppercase tracking-widest">Global</span>}
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border uppercase tracking-widest ${rule.active ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-200 text-slate-600 border-slate-300'}`}>
                                {rule.active ? 'Enabled' : 'Disabled'}
                              </span>
                            </div>
                            <div className={`text-xs font-bold px-3 py-1.5 rounded-lg w-fit ${rule.active ? 'bg-slate-50 border border-slate-200 text-slate-600' : 'bg-slate-200 text-slate-500'}`}>
                              {formatConditions(rule)}
                            </div>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1.5">
                              Context: {Array.isArray(rule.context) ? rule.context.join(', ') : rule.context}
                            </p>
                          </div>
                        </div>

                        <p className="text-xs text-slate-400 italic max-w-xs line-clamp-2 hidden lg:block">
                          "{rule.explanation_template || 'No explanation defined.'}"
                        </p>

                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => handleToggleRule(rule._id)}
                            disabled={actionLoadingId === rule._id}
                            className={`p-2.5 rounded-xl border transition-all disabled:opacity-50 ${rule.active ? 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100' : 'bg-black text-white border-black hover:bg-slate-800'
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

          </AnimatePresence>
        </div >
      </div >

      <AnimatePresence>
        <AddRuleModal
          isOpen={isAddingRule}
          role={user.role}
          onClose={() => setIsAddingRule(false)}
          onSuccess={() => { setIsAddingRule(false); fetchRules(); }}
        />
      </AnimatePresence>
    </div >
  );
}