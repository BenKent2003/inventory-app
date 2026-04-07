'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Search,
  Package,
  Wrench,
  AlertTriangle,
  ClipboardList,
  Plus,
  Download,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Boxes,
  Activity,
  TrendingUp,
  Bell,
  BarChart3,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const BRAND = {
  green: '#28d17c',
  greenSoft: '#dff8eb',
  greenDeep: '#15985a',
  charcoal: '#161217',
  charcoalSoft: '#231d24',
  ink: '#0d0b0f',
  gray: '#8b8790',
  border: '#312936',
};

function formatError(error) {
  if (!error) return 'Something went wrong.';
  if (typeof error === 'string') return error;
  return error.message || 'Something went wrong.';
}

function Button({ children, variant = 'primary', className = '', ...props }) {
  return (
    <button
      className={`btn btn-${variant} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}

function Card({ children, className = '', style }) {
  return (
    <div className={`card ${className}`.trim()} style={style}>
      {children}
    </div>
  );
}

function CardHeader({ children, className = '' }) {
  return <div className={`card-header ${className}`.trim()}>{children}</div>;
}

function CardContent({ children, className = '' }) {
  return <div className={`card-content ${className}`.trim()}>{children}</div>;
}

function CardTitle({ children, className = '' }) {
  return <h3 className={`card-title ${className}`.trim()}>{children}</h3>;
}

function CardDescription({ children }) {
  return <p className="card-description">{children}</p>;
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

function StatCard({ title, value, description, icon: Icon, accent = false }) {
  return (
    <Card
      style={{
        borderColor: BRAND.border,
        background: accent
          ? `linear-gradient(135deg, ${BRAND.ink} 0%, ${BRAND.charcoal} 100%)`
          : 'white',
      }}
    >
      <CardContent className="stat-card-content">
        <div>
          <p className={accent ? 'text-soft-on-dark' : 'text-soft'}>{title}</p>
          <div className={accent ? 'stat-value-on-dark' : 'stat-value'}>{value}</div>
          <p className={accent ? 'text-soft-on-dark' : 'text-soft'}>{description}</p>
        </div>
        <div
          className="icon-chip"
          style={{ background: accent ? 'rgba(40,209,124,0.18)' : BRAND.greenSoft }}
        >
          <Icon size={18} color={accent ? BRAND.green : BRAND.greenDeep} />
        </div>
      </CardContent>
    </Card>
  );
}

function InsightPill({ icon: Icon, title, value }) {
  return (
    <div className="insight-pill">
      <div className="insight-icon">
        <Icon size={16} color={BRAND.greenDeep} />
      </div>
      <div>
        <p className="insight-title">{title}</p>
        <p className="insight-value">{value}</p>
      </div>
    </div>
  );
}

function EmptyState({ title, description }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

function SectionCard({ title, description, right, children }) {
  return (
    <Card>
      <CardHeader className="section-header">
        <div>
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        {right}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default function Page() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [parts, setParts] = useState([]);
  const [machines, setMachines] = useState([]);
  const [usageLogs, setUsageLogs] = useState([]);
  const [search, setSearch] = useState('');
  const [machineFilter, setMachineFilter] = useState('all');
  const [tab, setTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [authMode, setAuthMode] = useState('signin');
  const [partDialogOpen, setPartDialogOpen] = useState(false);
  const [machineDialogOpen, setMachineDialogOpen] = useState(false);
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);

  const [authForm, setAuthForm] = useState({ email: '', password: '', fullName: '' });
  const [newPart, setNewPart] = useState({
    name: '',
    part_number: '',
    category: '',
    stock: 0,
    min_stock: 0,
    location: '',
    supplier: '',
    notes: '',
  });
  const [newMachine, setNewMachine] = useState({
    machine_code: '',
    name: '',
    model: '',
    site: '',
    status: 'Active',
    notes: '',
  });
  const [issueForm, setIssueForm] = useState({
    user_name: '',
    machine_id: '',
    part_id: '',
    qty: 1,
    reference: '',
    notes: '',
    log_date: new Date().toISOString().slice(0, 10),
  });

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data.session ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) setSession(nextSession ?? null);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user || !supabase) {
      setProfile(null);
      setParts([]);
      setMachines([]);
      setUsageLogs([]);
      setLoading(false);
      return;
    }
    loadAllData();
  }, [session?.user?.id]);

  async function loadAllData() {
    if (!supabase || !session?.user) return;
    setLoading(true);
    setErrorMessage('');

    const userId = session.user.id;
    const [profileRes, partsRes, machinesRes, usageRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('parts').select('*').order('name', { ascending: true }),
      supabase.from('machines').select('*').order('name', { ascending: true }),
      supabase
        .from('usage_logs')
        .select('*, part:parts(id,name,part_number,category), machine:machines(id,name,machine_code)')
        .order('log_date', { ascending: false })
        .order('created_at', { ascending: false }),
    ]);

    if (profileRes.error) setErrorMessage(formatError(profileRes.error));
    if (partsRes.error) setErrorMessage(formatError(partsRes.error));
    if (machinesRes.error) setErrorMessage(formatError(machinesRes.error));
    if (usageRes.error) setErrorMessage(formatError(usageRes.error));

    setProfile(profileRes.data ?? null);
    setParts(partsRes.data ?? []);
    setMachines(machinesRes.data ?? []);
    setUsageLogs(usageRes.data ?? []);
    setIssueForm((prev) => ({
      ...prev,
      user_name: profileRes.data?.full_name || session.user.email || '',
    }));
    setLoading(false);
  }

  const filteredParts = useMemo(() => {
    const q = search.toLowerCase().trim();
    return parts.filter(
      (p) =>
        !q ||
        p.name?.toLowerCase().includes(q) ||
        p.part_number?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q) ||
        p.location?.toLowerCase().includes(q)
    );
  }, [parts, search]);

  const filteredUsage = useMemo(() => {
    return usageLogs.filter((log) => machineFilter === 'all' || log.machine_id === machineFilter);
  }, [usageLogs, machineFilter]);

  const lowStockParts = useMemo(
    () => parts.filter((p) => Number(p.stock) <= Number(p.min_stock)),
    [parts]
  );
  const totalUnitsInStock = useMemo(
    () => parts.reduce((sum, p) => sum + Number(p.stock || 0), 0),
    [parts]
  );
  const totalIssued = useMemo(
    () => usageLogs.reduce((sum, log) => sum + Number(log.qty || 0), 0),
    [usageLogs]
  );

  const machineUsageCounts = useMemo(() => {
    const counts = {};
    usageLogs.forEach((log) => {
      counts[log.machine_id] = (counts[log.machine_id] || 0) + Number(log.qty || 0);
    });
    return machines
      .map((machine) => ({
        name: machine.name,
        count: counts[machine.id] || 0,
        id: machine.id,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [usageLogs, machines]);

  const categoryStockData = useMemo(() => {
    const map = {};
    parts.forEach((p) => {
      const key = p.category || 'Uncategorized';
      map[key] = (map[key] || 0) + Number(p.stock || 0);
    });
    return Object.entries(map)
      .map(([name, stock]) => ({ name, stock }))
      .sort((a, b) => b.stock - a.stock)
      .slice(0, 8);
  }, [parts]);

  const monthlyUsageData = useMemo(() => {
    const map = {};
    usageLogs.forEach((log) => {
      const d = new Date(log.log_date || log.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map[key] = (map[key] || 0) + Number(log.qty || 0);
    });
    return Object.entries(map)
      .map(([month, qty]) => ({ month, qty }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6);
  }, [usageLogs]);

  const stockHealthData = useMemo(() => {
    const healthy = parts.filter((p) => Number(p.stock) > Number(p.min_stock)).length;
    const low = parts.length - healthy;
    return [
      { name: 'Healthy', value: healthy, color: BRAND.green },
      { name: 'Low', value: low, color: BRAND.charcoalSoft },
    ];
  }, [parts]);

  const recentActivity = useMemo(() => filteredUsage.slice(0, 6), [filteredUsage]);

  const insights = useMemo(() => {
    const topMachine = machineUsageCounts[0];
    const partCounts = {};
    usageLogs.forEach((log) => {
      const key = log.part?.name || 'Unknown part';
      partCounts[key] = (partCounts[key] || 0) + Number(log.qty || 0);
    });
    const busiestPart = Object.entries(partCounts).sort((a, b) => b[1] - a[1])[0];
    return {
      topMachine: topMachine ? `${topMachine.name} (${topMachine.count} issued)` : 'No usage yet',
      busiestPart: busiestPart ? `${busiestPart[0]} (${busiestPart[1]} used)` : 'No usage yet',
      lowStockMessage: lowStockParts.length
        ? `${lowStockParts.length} item${lowStockParts.length === 1 ? '' : 's'} need reorder`
        : 'No low stock warnings',
    };
  }, [machineUsageCounts, usageLogs, lowStockParts]);

  async function handleAuthSubmit(e) {
    e.preventDefault();
    if (!supabase) return;
    setAuthLoading(true);
    setErrorMessage('');

    if (authMode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email: authForm.email,
        password: authForm.password,
        options: { data: { full_name: authForm.fullName } },
      });
      if (error) setErrorMessage(formatError(error));
      else setErrorMessage('Account created. Check your email if confirmation is enabled.');
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: authForm.email,
        password: authForm.password,
      });
      if (error) setErrorMessage(formatError(error));
    }

    setAuthLoading(false);
  }

  async function handleLogout() {
    if (!supabase) return;
    await supabase.auth.signOut();
  }

  async function addPart() {
    if (!supabase || !session?.user?.id || !isAdmin || !newPart.name || !newPart.part_number) return;
    setSaving(true);
    setErrorMessage('');
    const { error } = await supabase.from('parts').insert({
      ...newPart,
      stock: Number(newPart.stock),
      min_stock: Number(newPart.min_stock),
      created_by: session.user.id,
    });
    if (error) setErrorMessage(formatError(error));
    else {
      setNewPart({
        name: '',
        part_number: '',
        category: '',
        stock: 0,
        min_stock: 0,
        location: '',
        supplier: '',
        notes: '',
      });
      setPartDialogOpen(false);
      await loadAllData();
    }
    setSaving(false);
  }

  async function addMachine() {
    if (!supabase || !session?.user?.id || !isAdmin || !newMachine.name || !newMachine.machine_code) return;
    setSaving(true);
    setErrorMessage('');
    const { error } = await supabase.from('machines').insert({
      ...newMachine,
      created_by: session.user.id,
    });
    if (error) setErrorMessage(formatError(error));
    else {
      setNewMachine({
        machine_code: '',
        name: '',
        model: '',
        site: '',
        status: 'Active',
        notes: '',
      });
      setMachineDialogOpen(false);
      await loadAllData();
    }
    setSaving(false);
  }

  async function adjustStock(partId, amount) {
    if (!supabase || !isAdmin) return;
    const current = parts.find((p) => p.id === partId);
    if (!current) return;
    const nextStock = Math.max(0, Number(current.stock) + amount);
    setSaving(true);
    setErrorMessage('');
    const { error } = await supabase.from('parts').update({ stock: nextStock }).eq('id', partId);
    if (error) setErrorMessage(formatError(error));
    await loadAllData();
    setSaving(false);
  }

  async function deleteUsageLog(logId) {
    if (!supabase || !isAdmin) return;
    if (!window.confirm('Delete this usage log? This cannot be undone.')) return;
    setSaving(true);
    setErrorMessage('');
    const { error } = await supabase.from('usage_logs').delete().eq('id', logId);
    if (error) setErrorMessage(formatError(error));
    await loadAllData();
    setSaving(false);
  }

  async function deletePart(partId) {
    if (!supabase || !isAdmin) return;
    if (!window.confirm('Delete this part? This may fail if it is referenced in usage logs.')) return;
    setSaving(true);
    setErrorMessage('');
    const { error } = await supabase.from('parts').delete().eq('id', partId);
    if (error) setErrorMessage(formatError(error));
    await loadAllData();
    setSaving(false);
  }

  async function deleteMachine(machineId) {
    if (!supabase || !isAdmin) return;
    if (!window.confirm('Delete this machine? This may fail if usage logs still reference it.')) return;
    setSaving(true);
    setErrorMessage('');
    const { error } = await supabase.from('machines').delete().eq('id', machineId);
    if (error) setErrorMessage(formatError(error));
    await loadAllData();
    setSaving(false);
  }

  async function issuePart() {
    if (!supabase || !session?.user?.id) return;
    if (!issueForm.machine_id || !issueForm.part_id || !issueForm.user_name || Number(issueForm.qty) < 1) return;
    setSaving(true);
    setErrorMessage('');
    const { error } = await supabase.rpc('issue_part', {
      p_user_id: session.user.id,
      p_user_name: issueForm.user_name,
      p_machine_id: issueForm.machine_id,
      p_part_id: issueForm.part_id,
      p_qty: Number(issueForm.qty),
      p_reference: issueForm.reference,
      p_notes: issueForm.notes,
      p_log_date: issueForm.log_date,
    });
    if (error) setErrorMessage(formatError(error));
    else {
      setIssueForm({
        user_name: profile?.full_name || session.user.email || '',
        machine_id: '',
        part_id: '',
        qty: 1,
        reference: '',
        notes: '',
        log_date: new Date().toISOString().slice(0, 10),
      });
      setIssueDialogOpen(false);
      await loadAllData();
    }
    setSaving(false);
  }

  function exportUsageCSV() {
    const rows = [
      ['Date', 'User', 'Part', 'Part Number', 'Machine', 'Machine Code', 'Qty', 'Reference', 'Notes'],
      ...filteredUsage.map((log) => [
        log.log_date,
        log.user_name,
        log.part?.name || '',
        log.part?.part_number || '',
        log.machine?.name || '',
        log.machine?.machine_code || '',
        log.qty,
        log.reference,
        log.notes,
      ]),
    ];
    const csv = rows
      .map((r) => r.map((v) => `"${String(v ?? '').replaceAll('"', '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'usage-log.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const renderAuth = () => (
    <div className="auth-shell">
      <div className="auth-grid">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="hero-card" style={{ background: `linear-gradient(135deg, ${BRAND.ink} 0%, ${BRAND.charcoal} 100%)` }}>
            <CardHeader>
              <div className="hero-topline">
                <ShieldCheck size={16} color={BRAND.green} /> Albion Fine Foods inventory system
              </div>
              <div className="hero-brand">
                <div className="logo-wrap">
                  <img src="/albion-logo.png" alt="Albion logo" className="logo" />
                </div>
                <div>
                  <h1 className="hero-title">Machinery Parts Control</h1>
                  <p className="hero-description">Live stock, machine logs, smart dashboard, and team access.</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="hero-insights">
              <InsightPill icon={Package} title="Track parts" value="Live shared stock" />
              <InsightPill icon={Wrench} title="Track machines" value="Full equipment list" />
              <InsightPill icon={BarChart3} title="View trends" value="Usage charts" />
              <InsightPill icon={Bell} title="Spot issues" value="Low stock warnings" />
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card>
            <CardHeader>
              <CardTitle>{authMode === 'signin' ? 'Sign in' : 'Create account'}</CardTitle>
              <CardDescription>Use your work email and password.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAuthSubmit} className="form-stack">
                {authMode === 'signup' && (
                  <Field label="Full name">
                    <input
                      className="input"
                      value={authForm.fullName}
                      onChange={(e) => setAuthForm({ ...authForm, fullName: e.target.value })}
                      placeholder="Alex Smith"
                    />
                  </Field>
                )}
                <Field label="Email">
                  <input
                    type="email"
                    className="input"
                    value={authForm.email}
                    onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                    placeholder="name@company.com"
                  />
                </Field>
                <Field label="Password">
                  <input
                    type="password"
                    className="input"
                    value={authForm.password}
                    onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                    placeholder="••••••••"
                  />
                </Field>
                {errorMessage && <div className="alert">{errorMessage}</div>}
                <Button type="submit" disabled={authLoading}>
                  {authLoading ? 'Please wait...' : authMode === 'signin' ? 'Sign in' : 'Create account'}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}>
                  {authMode === 'signin' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );

  if (!supabase) {
    return (
      <div className="setup-shell">
        <Card>
          <CardHeader>
            <CardTitle>Supabase setup needed</CardTitle>
            <CardDescription>Add the environment variables and redeploy.</CardDescription>
          </CardHeader>
          <CardContent>
            <p>This build is ready for shared live data, charts, alerts, admin controls, and Albion branding.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!session) return renderAuth();

  return (
    <div className="app-shell">
      <div className="container">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="top-banner">
          <div className="banner-main">
            <div className="brand-row">
              <div className="logo-wrap">
                <img src="/albion-logo.png" alt="Albion logo" className="logo large" />
              </div>
              <div>
                <h1 className="banner-title">Albion Engineering Inventory</h1>
                <p className="hero-description">Track stock, machine usage, trends, and alerts in one dashboard.</p>
                <p className="signed-in">
                  Signed in as <strong>{profile?.full_name || session.user.email}</strong>
                  {profile?.role ? ` • ${profile.role}` : ''}
                </p>
                {isAdmin && <p className="admin-note">Admin controls are enabled.</p>}
              </div>
            </div>
            <div className="actions-row">
              <Button variant="outline" onClick={loadAllData} disabled={loading || saving}>
                <RefreshCw size={16} /> Refresh
              </Button>
              <Button onClick={() => setPartDialogOpen(true)} disabled={!isAdmin}>
                <Plus size={16} /> Add Part
              </Button>
              <Button variant="ghost-light" onClick={() => setMachineDialogOpen(true)} disabled={!isAdmin}>
                <Plus size={16} /> Add Machine
              </Button>
              <Button variant="light" onClick={() => setIssueDialogOpen(true)}>
                <ClipboardList size={16} /> Issue Part
              </Button>
              <Button variant="ghost-light" onClick={handleLogout}>
                <LogOut size={16} /> Sign out
              </Button>
            </div>
          </div>
        </motion.div>

        {errorMessage && <div className="alert banner-alert">{errorMessage}</div>}

        <div className="stats-grid">
          <StatCard title="Total Parts" value={parts.length} description="Unique part records" icon={Package} />
          <StatCard title="Stock Units" value={totalUnitsInStock} description="Combined units on hand" icon={Boxes} />
          <StatCard title="Machines" value={machines.length} description="Tracked equipment" icon={Wrench} />
          <StatCard title="Low Stock" value={lowStockParts.length} description="Needs reorder attention" icon={AlertTriangle} />
          <StatCard title="Issued" value={totalIssued} description="Total units used" icon={Activity} accent />
        </div>

        <div className="tabs">
          {['dashboard', 'parts', 'machines', 'usage'].map((key) => (
            <button
              key={key}
              className={`tab ${tab === key ? 'tab-active' : ''}`}
              onClick={() => setTab(key)}
            >
              {key === 'usage' ? 'Usage Log' : key.charAt(0).toUpperCase() + key.slice(1)}
            </button>
          ))}
        </div>

        {tab === 'dashboard' && (
          <div className="page-grid">
            <div className="grid-3">
              <SectionCard title="Smart insights" description="Quick operational signals from your current data.">
                <div className="insight-grid">
                  <InsightPill icon={TrendingUp} title="Top machine" value={insights.topMachine} />
                  <InsightPill icon={Package} title="Most used part" value={insights.busiestPart} />
                  <InsightPill icon={Bell} title="Reorder" value={insights.lowStockMessage} />
                </div>
              </SectionCard>
              <SectionCard title="Stock health" description="How many parts are healthy vs low.">
                <div className="chart-box">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={stockHealthData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3}>
                        {stockHealthData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>
              <SectionCard title="Low stock list" description="Parts currently at or below minimum.">
                <div className="list-stack">
                  {lowStockParts.length === 0 ? (
                    <p className="muted">Everything is above minimum stock.</p>
                  ) : (
                    lowStockParts.slice(0, 6).map((part) => (
                      <div key={part.id} className="list-item">
                        <div>
                          <p className="item-title">{part.name}</p>
                          <p className="muted">{part.part_number} • {part.location}</p>
                        </div>
                        <div className="right-text">
                          <span className="badge badge-danger">Stock {part.stock}</span>
                          <p className="tiny muted">Min {part.min_stock}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </SectionCard>
            </div>

            <div className="grid-2">
              <SectionCard title="Stock by category" description="See which categories hold the most inventory.">
                <div className="chart-box large">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryStockData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="stock" fill={BRAND.greenDeep} radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>
              <SectionCard title="Monthly usage trend" description="Usage volume over recent months.">
                <div className="chart-box large">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyUsageData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="qty" stroke={BRAND.greenDeep} strokeWidth={3} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>
            </div>

            <div className="grid-2">
              <SectionCard title="Most used machines" description="Top machines by total parts issued.">
                <div className="chart-box large">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={machineUsageCounts} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={120} />
                      <Tooltip />
                      <Bar dataKey="count" fill={BRAND.charcoalSoft} radius={[0, 8, 8, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>
              <SectionCard title="Recent activity" description="Latest usage logged by your team.">
                <div className="list-stack">
                  {recentActivity.length === 0 ? (
                    <p className="muted">No activity yet.</p>
                  ) : (
                    recentActivity.map((log) => (
                      <div key={log.id} className="list-item vertical-gap">
                        <div>
                          <p className="item-title">
                            {log.part?.name || 'Unknown part'} → {log.machine?.name || 'Unknown machine'}
                          </p>
                          <p className="muted">
                            {log.user_name} • {log.log_date} • Ref {log.reference || '—'}
                          </p>
                        </div>
                        <span className="badge badge-dark">Qty {log.qty}</span>
                      </div>
                    ))
                  )}
                </div>
              </SectionCard>
            </div>
          </div>
        )}

        {tab === 'parts' && (
          <SectionCard
            title="Parts Inventory"
            description="Search, adjust, and monitor current stock."
            right={
              <div className="search-wrap">
                <Search size={16} className="search-icon" />
                <input
                  className="input search-input"
                  placeholder="Search parts, category, location..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            }
          >
            {filteredParts.length === 0 ? (
              <EmptyState title="No parts yet" description="Add your first spare part to start tracking stock." />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Part</th>
                      <th>Category</th>
                      <th>Stock</th>
                      <th>Min</th>
                      <th>Location</th>
                      <th>Supplier</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredParts.map((part) => (
                      <tr key={part.id}>
                        <td>
                          <div>
                            <p className="item-title">{part.name}</p>
                            <p className="tiny muted">{part.part_number}</p>
                          </div>
                        </td>
                        <td>{part.category}</td>
                        <td className={Number(part.stock) <= Number(part.min_stock) ? 'danger-text' : ''}>{part.stock}</td>
                        <td>{part.min_stock}</td>
                        <td>{part.location}</td>
                        <td>{part.supplier}</td>
                        <td>
                          <div className="row-actions">
                            <Button variant="ghost" className="small-btn" onClick={() => adjustStock(part.id, 1)} disabled={saving || !isAdmin}>+1</Button>
                            <Button variant="ghost" className="small-btn" onClick={() => adjustStock(part.id, -1)} disabled={saving || !isAdmin}>-1</Button>
                            {isAdmin && (
                              <Button variant="ghost" className="small-btn" onClick={() => deletePart(part.id)} disabled={saving}>
                                <Trash2 size={14} /> Delete
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        )}

        {tab === 'machines' && (
          machines.length === 0 ? (
            <EmptyState title="No machines yet" description="Add your machinery so the team can log which parts were used on which machine." />
          ) : (
            <div className="machine-grid">
              {machines.map((machine) => {
                const logs = usageLogs.filter((log) => log.machine_id === machine.id);
                return (
                  <Card key={machine.id}>
                    <CardHeader>
                      <div className="machine-header">
                        <div>
                          <CardTitle>{machine.name}</CardTitle>
                          <CardDescription>{machine.machine_code} • {machine.model}</CardDescription>
                        </div>
                        <span className="badge">{machine.status}</span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="machine-details">
                        <p><strong>Site:</strong> {machine.site}</p>
                        <p><strong>Notes:</strong> {machine.notes || '—'}</p>
                        <p><strong>Parts logged:</strong> {logs.reduce((sum, l) => sum + Number(l.qty || 0), 0)}</p>
                      </div>
                      <div className="list-stack top-gap">
                        <p className="item-title">Recent part usage</p>
                        {logs.slice(0, 3).length === 0 ? (
                          <p className="muted">No parts logged yet.</p>
                        ) : (
                          logs.slice(0, 3).map((log) => (
                            <div key={log.id} className="list-item compact">
                              <div>
                                <p className="item-title">{log.part?.name || 'Unknown part'}</p>
                                <p className="muted">Qty {log.qty} • {log.log_date} • {log.user_name}</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                      {isAdmin && (
                        <div className="top-gap">
                          <Button variant="ghost" onClick={() => deleteMachine(machine.id)} disabled={saving}>
                            <Trash2 size={14} /> Delete machine
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )
        )}

        {tab === 'usage' && (
          <SectionCard
            title="Usage Log"
            description="Every part issued to a machine is recorded here."
            right={
              <div className="usage-controls">
                <select className="input select" value={machineFilter} onChange={(e) => setMachineFilter(e.target.value)}>
                  <option value="all">All machines</option>
                  {machines.map((machine) => (
                    <option key={machine.id} value={machine.id}>{machine.name}</option>
                  ))}
                </select>
                <Button variant="ghost" onClick={exportUsageCSV}>
                  <Download size={16} /> Export CSV
                </Button>
              </div>
            }
          >
            {filteredUsage.length === 0 ? (
              <EmptyState title="No usage logs yet" description="Use the Issue Part button to record stock going onto a machine." />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>User</th>
                      <th>Part</th>
                      <th>Machine</th>
                      <th>Qty</th>
                      <th>Reference</th>
                      <th>Notes</th>
                      {isAdmin && <th>Admin</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsage.map((log) => (
                      <tr key={log.id}>
                        <td>{log.log_date}</td>
                        <td>{log.user_name}</td>
                        <td>
                          <div>
                            <p className="item-title">{log.part?.name || 'Unknown Part'}</p>
                            <p className="tiny muted">{log.part?.part_number || ''}</p>
                          </div>
                        </td>
                        <td>{log.machine?.name || 'Unknown Machine'}</td>
                        <td>{log.qty}</td>
                        <td>{log.reference || '—'}</td>
                        <td>{log.notes || '—'}</td>
                        {isAdmin && (
                          <td>
                            <Button variant="ghost" className="small-btn" onClick={() => deleteUsageLog(log.id)} disabled={saving}>
                              <Trash2 size={14} /> Delete
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        )}
      </div>

      <Modal open={partDialogOpen} onClose={() => setPartDialogOpen(false)} title="Add New Part">
        <div className="form-grid">
          <Field label="Part Name"><input className="input" value={newPart.name} onChange={(e) => setNewPart({ ...newPart, name: e.target.value })} /></Field>
          <Field label="Part Number"><input className="input" value={newPart.part_number} onChange={(e) => setNewPart({ ...newPart, part_number: e.target.value })} /></Field>
          <Field label="Category"><input className="input" value={newPart.category} onChange={(e) => setNewPart({ ...newPart, category: e.target.value })} /></Field>
          <Field label="Location"><input className="input" value={newPart.location} onChange={(e) => setNewPart({ ...newPart, location: e.target.value })} /></Field>
          <Field label="Current Stock"><input type="number" className="input" value={newPart.stock} onChange={(e) => setNewPart({ ...newPart, stock: e.target.value })} /></Field>
          <Field label="Minimum Stock"><input type="number" className="input" value={newPart.min_stock} onChange={(e) => setNewPart({ ...newPart, min_stock: e.target.value })} /></Field>
          <div className="span-2"><Field label="Supplier"><input className="input" value={newPart.supplier} onChange={(e) => setNewPart({ ...newPart, supplier: e.target.value })} /></Field></div>
          <div className="span-2"><Field label="Notes"><textarea className="textarea" value={newPart.notes} onChange={(e) => setNewPart({ ...newPart, notes: e.target.value })} /></Field></div>
        </div>
        <div className="modal-actions"><Button onClick={addPart} disabled={saving}>Save Part</Button></div>
      </Modal>

      <Modal open={machineDialogOpen} onClose={() => setMachineDialogOpen(false)} title="Add Machine">
        <div className="form-grid">
          <Field label="Machine Code"><input className="input" value={newMachine.machine_code} onChange={(e) => setNewMachine({ ...newMachine, machine_code: e.target.value })} /></Field>
          <Field label="Machine Name"><input className="input" value={newMachine.name} onChange={(e) => setNewMachine({ ...newMachine, name: e.target.value })} /></Field>
          <Field label="Model"><input className="input" value={newMachine.model} onChange={(e) => setNewMachine({ ...newMachine, model: e.target.value })} /></Field>
          <Field label="Site"><input className="input" value={newMachine.site} onChange={(e) => setNewMachine({ ...newMachine, site: e.target.value })} /></Field>
          <Field label="Status">
            <select className="input select" value={newMachine.status} onChange={(e) => setNewMachine({ ...newMachine, status: e.target.value })}>
              <option value="Active">Active</option>
              <option value="Maintenance">Maintenance</option>
              <option value="Offline">Offline</option>
            </select>
          </Field>
          <div className="span-2"><Field label="Notes"><textarea className="textarea" value={newMachine.notes} onChange={(e) => setNewMachine({ ...newMachine, notes: e.target.value })} /></Field></div>
        </div>
        <div className="modal-actions"><Button onClick={addMachine} disabled={saving}>Save Machine</Button></div>
      </Modal>

      <Modal open={issueDialogOpen} onClose={() => setIssueDialogOpen(false)} title="Log Part Used on Machine">
        <div className="form-grid">
          <Field label="Date"><input type="date" className="input" value={issueForm.log_date} onChange={(e) => setIssueForm({ ...issueForm, log_date: e.target.value })} /></Field>
          <Field label="User"><input className="input" value={issueForm.user_name} onChange={(e) => setIssueForm({ ...issueForm, user_name: e.target.value })} /></Field>
          <Field label="Machine">
            <select className="input select" value={issueForm.machine_id} onChange={(e) => setIssueForm({ ...issueForm, machine_id: e.target.value })}>
              <option value="">Select machine</option>
              {machines.map((machine) => <option key={machine.id} value={machine.id}>{machine.name} • {machine.machine_code}</option>)}
            </select>
          </Field>
          <Field label="Part">
            <select className="input select" value={issueForm.part_id} onChange={(e) => setIssueForm({ ...issueForm, part_id: e.target.value })}>
              <option value="">Select part</option>
              {parts.map((part) => <option key={part.id} value={part.id}>{part.name} • {part.part_number} • Stock {part.stock}</option>)}
            </select>
          </Field>
          <Field label="Quantity"><input type="number" min="1" className="input" value={issueForm.qty} onChange={(e) => setIssueForm({ ...issueForm, qty: e.target.value })} /></Field>
          <Field label="Work Order / Ref"><input className="input" value={issueForm.reference} onChange={(e) => setIssueForm({ ...issueForm, reference: e.target.value })} /></Field>
          <div className="span-2"><Field label="Notes"><textarea className="textarea" value={issueForm.notes} onChange={(e) => setIssueForm({ ...issueForm, notes: e.target.value })} /></Field></div>
        </div>
        <div className="modal-actions"><Button onClick={issuePart} disabled={saving}>Save Usage Log</Button></div>
      </Modal>
    </div>
  );
}
