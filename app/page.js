'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

const sqlSetup = `create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'member' check (role in ('admin','member')),
  created_at timestamptz not null default now()
);

create table if not exists public.parts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  part_number text not null unique,
  category text default '',
  stock integer not null default 0 check (stock >= 0),
  min_stock integer not null default 0 check (min_stock >= 0),
  location text default '',
  supplier text default '',
  notes text default '',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.machines (
  id uuid primary key default gen_random_uuid(),
  machine_code text not null unique,
  name text not null,
  model text default '',
  site text default '',
  status text not null default 'Active' check (status in ('Active','Maintenance','Offline')),
  notes text default '',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.usage_logs (
  id uuid primary key default gen_random_uuid(),
  log_date date not null default current_date,
  user_id uuid references public.profiles(id),
  user_name text not null,
  machine_id uuid not null references public.machines(id) on delete restrict,
  part_id uuid not null references public.parts(id) on delete restrict,
  qty integer not null check (qty > 0),
  reference text default '',
  notes text default '',
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), 'member')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.parts enable row level security;
alter table public.machines enable row level security;
alter table public.usage_logs enable row level security;

drop policy if exists "authenticated users can read profiles" on public.profiles;
create policy "authenticated users can read profiles"
on public.profiles for select to authenticated using (true);

drop policy if exists "users can update own profile" on public.profiles;
create policy "users can update own profile"
on public.profiles for update to authenticated using (auth.uid() = id);

drop policy if exists "authenticated users can insert profiles" on public.profiles;
create policy "authenticated users can insert profiles"
on public.profiles for insert to authenticated with check (auth.uid() = id);

drop policy if exists "authenticated users can read parts" on public.parts;
create policy "authenticated users can read parts"
on public.parts for select to authenticated using (true);

drop policy if exists "authenticated users can insert parts" on public.parts;
create policy "authenticated users can insert parts"
on public.parts for insert to authenticated with check (auth.uid() = created_by);

drop policy if exists "authenticated users can update parts" on public.parts;
create policy "authenticated users can update parts"
on public.parts for update to authenticated using (true);

drop policy if exists "authenticated users can delete parts" on public.parts;
create policy "authenticated users can delete parts"
on public.parts for delete to authenticated using (true);

drop policy if exists "authenticated users can read machines" on public.machines;
create policy "authenticated users can read machines"
on public.machines for select to authenticated using (true);

drop policy if exists "authenticated users can insert machines" on public.machines;
create policy "authenticated users can insert machines"
on public.machines for insert to authenticated with check (auth.uid() = created_by);

drop policy if exists "authenticated users can update machines" on public.machines;
create policy "authenticated users can update machines"
on public.machines for update to authenticated using (true);

drop policy if exists "authenticated users can delete machines" on public.machines;
create policy "authenticated users can delete machines"
on public.machines for delete to authenticated using (true);

drop policy if exists "authenticated users can read usage logs" on public.usage_logs;
create policy "authenticated users can read usage logs"
on public.usage_logs for select to authenticated using (true);

drop policy if exists "authenticated users can insert usage logs" on public.usage_logs;
create policy "authenticated users can insert usage logs"
on public.usage_logs for insert to authenticated with check (auth.uid() = user_id);

create or replace function public.issue_part(
  p_user_id uuid,
  p_user_name text,
  p_machine_id uuid,
  p_part_id uuid,
  p_qty integer,
  p_reference text,
  p_notes text,
  p_log_date date
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare current_stock integer;
begin
  if p_qty is null or p_qty < 1 then
    raise exception 'Quantity must be at least 1';
  end if;

  select stock into current_stock from public.parts where id = p_part_id for update;
  if current_stock is null then
    raise exception 'Part not found';
  end if;
  if current_stock < p_qty then
    raise exception 'Not enough stock';
  end if;

  update public.parts set stock = stock - p_qty where id = p_part_id;

  insert into public.usage_logs (log_date, user_id, user_name, machine_id, part_id, qty, reference, notes)
  values (coalesce(p_log_date, current_date), p_user_id, p_user_name, p_machine_id, p_part_id, p_qty, coalesce(p_reference, ''), coalesce(p_notes, ''));
end;
$$;

grant execute on function public.issue_part(uuid, text, uuid, uuid, integer, text, text, date) to authenticated;`;

const initialPart = {
  name: '',
  part_number: '',
  category: '',
  stock: 0,
  min_stock: 0,
  location: '',
  supplier: '',
  notes: ''
};

const initialMachine = {
  machine_code: '',
  name: '',
  model: '',
  site: '',
  status: 'Active',
  notes: ''
};

const initialIssue = {
  user_name: '',
  machine_id: '',
  part_id: '',
  qty: 1,
  reference: '',
  notes: '',
  log_date: new Date().toISOString().slice(0, 10)
};

function Modal({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button className="btn" onClick={onClose}>Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function StatCard({ title, value, description }) {
  return (
    <div className="card">
      <div className="small-muted">{title}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{description}</div>
    </div>
  );
}

function formatError(error) {
  if (!error) return 'Something went wrong.';
  if (typeof error === 'string') return error;
  return error.message || 'Something went wrong.';
}

export default function Page() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [parts, setParts] = useState([]);
  const [machines, setMachines] = useState([]);
  const [usageLogs, setUsageLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('warning');
  const [authMode, setAuthMode] = useState('signin');
  const [tab, setTab] = useState('dashboard');
  const [search, setSearch] = useState('');
  const [showPartModal, setShowPartModal] = useState(false);
  const [showMachineModal, setShowMachineModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [authForm, setAuthForm] = useState({ email: '', password: '', fullName: '' });
  const [newPart, setNewPart] = useState(initialPart);
  const [newMachine, setNewMachine] = useState(initialMachine);
  const [issueForm, setIssueForm] = useState(initialIssue);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user?.id) {
      setProfile(null);
      setParts([]);
      setMachines([]);
      setUsageLogs([]);
      setLoading(false);
      return;
    }
    loadAll();
  }, [session?.user?.id]);

  async function loadAll() {
    if (!supabase || !session?.user?.id) return;
    setLoading(true);
    setMessage('');

    const userId = session.user.id;
    const [profileRes, partsRes, machinesRes, usageRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('parts').select('*').order('name', { ascending: true }),
      supabase.from('machines').select('*').order('name', { ascending: true }),
      supabase
        .from('usage_logs')
        .select('*, part:parts(id, name, part_number), machine:machines(id, name, machine_code)')
        .order('log_date', { ascending: false })
        .order('created_at', { ascending: false })
    ]);

    if (profileRes.error && profileRes.error.code !== 'PGRST116') {
      setMessage(formatError(profileRes.error));
      setMessageType('warning');
    }

    if (!profileRes.data) {
      const fallbackName = session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User';
      const insertRes = await supabase.from('profiles').upsert({ id: userId, full_name: fallbackName });
      if (insertRes.error) {
        setMessage(formatError(insertRes.error));
        setMessageType('warning');
      } else {
        profileRes.data = { id: userId, full_name: fallbackName, role: 'member' };
      }
    }

    if (partsRes.error) {
      setMessage(formatError(partsRes.error));
      setMessageType('warning');
    }
    if (machinesRes.error) {
      setMessage(formatError(machinesRes.error));
      setMessageType('warning');
    }
    if (usageRes.error) {
      setMessage(formatError(usageRes.error));
      setMessageType('warning');
    }

    setProfile(profileRes.data ?? null);
    setParts(partsRes.data ?? []);
    setMachines(machinesRes.data ?? []);
    setUsageLogs(usageRes.data ?? []);
    setIssueForm((prev) => ({
      ...prev,
      user_name: profileRes.data?.full_name || session.user.email || ''
    }));
    setLoading(false);
  }

  const filteredParts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return parts;
    return parts.filter((p) =>
      [p.name, p.part_number, p.category, p.location, p.supplier].some((v) =>
        String(v || '').toLowerCase().includes(q)
      )
    );
  }, [search, parts]);

  const lowStockParts = useMemo(
    () => parts.filter((p) => Number(p.stock) <= Number(p.min_stock)),
    [parts]
  );

  const machineUsageCounts = useMemo(() => {
    const counts = {};
    for (const log of usageLogs) {
      counts[log.machine_id] = (counts[log.machine_id] || 0) + Number(log.qty || 0);
    }
    return machines
      .map((machine) => ({ machine, count: counts[machine.id] || 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [usageLogs, machines]);

  async function handleAuthSubmit(e) {
    e.preventDefault();
    if (!supabase) return;
    setSaving(true);
    setMessage('');

    if (authMode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email: authForm.email,
        password: authForm.password,
        options: { data: { full_name: authForm.fullName } }
      });
      if (error) {
        setMessage(formatError(error));
        setMessageType('warning');
      } else {
        setMessage('Account created. If email confirmation is on in Supabase, check your inbox first.');
        setMessageType('success');
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: authForm.email,
        password: authForm.password
      });
      if (error) {
        setMessage(formatError(error));
        setMessageType('warning');
      }
    }

    setSaving(false);
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
  }

  async function addPart() {
    if (!supabase || !session?.user?.id) return;
    if (!newPart.name || !newPart.part_number) {
      setMessage('Part name and part number are required.');
      setMessageType('warning');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('parts').insert({
      ...newPart,
      stock: Number(newPart.stock),
      min_stock: Number(newPart.min_stock),
      created_by: session.user.id
    });
    if (error) {
      setMessage(formatError(error));
      setMessageType('warning');
    } else {
      setNewPart(initialPart);
      setShowPartModal(false);
      setMessage('Part added.');
      setMessageType('success');
      await loadAll();
    }
    setSaving(false);
  }

  async function addMachine() {
    if (!supabase || !session?.user?.id) return;
    if (!newMachine.name || !newMachine.machine_code) {
      setMessage('Machine name and machine code are required.');
      setMessageType('warning');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('machines').insert({
      ...newMachine,
      created_by: session.user.id
    });
    if (error) {
      setMessage(formatError(error));
      setMessageType('warning');
    } else {
      setNewMachine(initialMachine);
      setShowMachineModal(false);
      setMessage('Machine added.');
      setMessageType('success');
      await loadAll();
    }
    setSaving(false);
  }

  async function adjustStock(partId, amount) {
    if (!supabase) return;
    const part = parts.find((x) => x.id === partId);
    if (!part) return;
    const nextStock = Math.max(0, Number(part.stock) + amount);
    setSaving(true);
    const { error } = await supabase.from('parts').update({ stock: nextStock }).eq('id', partId);
    if (error) {
      setMessage(formatError(error));
      setMessageType('warning');
    } else {
      await loadAll();
    }
    setSaving(false);
  }

  async function issuePart() {
    if (!supabase || !session?.user?.id) return;
    if (!issueForm.machine_id || !issueForm.part_id || !issueForm.user_name || Number(issueForm.qty) < 1) {
      setMessage('Please complete the usage form.');
      setMessageType('warning');
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc('issue_part', {
      p_user_id: session.user.id,
      p_user_name: issueForm.user_name,
      p_machine_id: issueForm.machine_id,
      p_part_id: issueForm.part_id,
      p_qty: Number(issueForm.qty),
      p_reference: issueForm.reference,
      p_notes: issueForm.notes,
      p_log_date: issueForm.log_date
    });
    if (error) {
      setMessage(formatError(error));
      setMessageType('warning');
    } else {
      setIssueForm({
        ...initialIssue,
        user_name: profile?.full_name || session.user.email || ''
      });
      setShowIssueModal(false);
      setMessage('Usage log saved and stock updated.');
      setMessageType('success');
      await loadAll();
    }
    setSaving(false);
  }

  function exportUsageCsv() {
    const rows = [
      ['Date', 'User', 'Part', 'Part Number', 'Machine', 'Machine Code', 'Qty', 'Reference', 'Notes'],
      ...usageLogs.map((log) => [
        log.log_date,
        log.user_name,
        log.part?.name || '',
        log.part?.part_number || '',
        log.machine?.name || '',
        log.machine?.machine_code || '',
        log.qty,
        log.reference,
        log.notes
      ])
    ];
    const csv = rows
      .map((r) => r.map((v) => `"${String(v ?? '').replaceAll('"', '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'usage-log.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function copySql() {
    navigator.clipboard.writeText(sqlSetup);
    setMessage('SQL copied to clipboard.');
    setMessageType('success');
  }

  if (!supabase) {
    return (
      <main className="page">
        <div className="container">
          <div className="card">
            <h1 className="title">Supabase setup needed</h1>
            <p className="subtitle">
              Add <strong>NEXT_PUBLIC_SUPABASE_URL</strong> and <strong>NEXT_PUBLIC_SUPABASE_ANON_KEY</strong> in Vercel or in a local <strong>.env.local</strong> file.
            </p>
            <div className="alert warning">
              This project already includes a <strong>.env.example</strong> file and a <strong>README.md</strong> with the steps.
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="auth-shell">
        <div className="auth-grid">
          <div className="card">
            <h1 className="title">Machinery Parts Inventory</h1>
            <p className="subtitle">A shared stock tracker for your team with parts, machines, and usage history.</p>
            <div className="item-list" style={{ marginTop: 16 }}>
              <div className="item"><div><strong>Shared stock</strong><div className="small-muted">Everyone sees the same live inventory</div></div></div>
              <div className="item"><div><strong>Machine tracking</strong><div className="small-muted">Log what part was used on which machine</div></div></div>
              <div className="item"><div><strong>Automatic deductions</strong><div className="small-muted">Issuing a part reduces stock immediately</div></div></div>
            </div>
          </div>
          <div className="card">
            <h2 style={{ marginTop: 0 }}>{authMode === 'signin' ? 'Sign in' : 'Create account'}</h2>
            <p className="small-muted">Use the same site for all 5 people on your team.</p>
            {message ? <div className={`alert ${messageType}`}>{message}</div> : null}
            <form onSubmit={handleAuthSubmit} className="item-list">
              {authMode === 'signup' ? (
                <div>
                  <label className="label">Full name</label>
                  <input className="input" value={authForm.fullName} onChange={(e) => setAuthForm({ ...authForm, fullName: e.target.value })} />
                </div>
              ) : null}
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} />
              </div>
              <div>
                <label className="label">Password</label>
                <input className="input" type="password" value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} />
              </div>
              <button className="btn primary" disabled={saving} type="submit">{saving ? 'Working...' : authMode === 'signin' ? 'Sign in' : 'Create account'}</button>
              <button className="linklike" type="button" onClick={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}>
                {authMode === 'signin' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
              </button>
            </form>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="container">
        <div className="header">
          <div>
            <h1 className="title">Machinery Parts Inventory</h1>
            <div className="subtitle">Track stock, machines, and every part used by your team.</div>
            <div className="small-muted">Signed in as {profile?.full_name || session.user.email}{profile?.role ? ` • ${profile.role}` : ''}</div>
          </div>
          <div className="button-row">
            <button className="btn" onClick={loadAll} disabled={loading || saving}>Refresh</button>
            <button className="btn primary" onClick={() => setShowPartModal(true)}>Add Part</button>
            <button className="btn" onClick={() => setShowMachineModal(true)}>Add Machine</button>
            <button className="btn secondary" onClick={() => setShowIssueModal(true)}>Issue Part</button>
            <button className="btn" onClick={signOut}>Sign out</button>
          </div>
        </div>

        {message ? <div className={`alert ${messageType}`}>{message}</div> : null}

        <div className="grid-4">
          <StatCard title="Total Parts" value={parts.length} description="Unique stock items" />
          <StatCard title="Machines" value={machines.length} description="Tracked equipment" />
          <StatCard title="Low Stock" value={lowStockParts.length} description="Needs reorder attention" />
          <StatCard title="Usage Logs" value={usageLogs.length} description="Part-to-machine history" />
        </div>

        <div className="tabs">
          {['dashboard', 'parts', 'machines', 'usage'].map((name) => (
            <button key={name} className={`tab ${tab === name ? 'active' : ''}`} onClick={() => setTab(name)}>
              {name === 'usage' ? 'Usage Log' : name[0].toUpperCase() + name.slice(1)}
            </button>
          ))}
        </div>

        {tab === 'dashboard' ? (
          <div className="grid-3">
            <div className="card">
              <h2 style={{ marginTop: 0 }}>Low Stock Parts</h2>
              <p className="small-muted">Reorder these items soon.</p>
              {loading ? <div className="empty">Loading data…</div> : lowStockParts.length === 0 ? <div className="empty">Everything is above minimum stock.</div> : (
                <div className="item-list">
                  {lowStockParts.map((part) => (
                    <div className="item" key={part.id}>
                      <div>
                        <strong>{part.name}</strong>
                        <div className="small-muted">{part.part_number} • {part.location || 'No location'}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span className="badge red">Stock {part.stock}</span>
                        <div className="small-muted" style={{ marginTop: 6 }}>Min {part.min_stock}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="card">
              <h2 style={{ marginTop: 0 }}>Most Used Machines</h2>
              <p className="small-muted">By total parts issued.</p>
              {machineUsageCounts.length === 0 ? <div className="empty">No usage logged yet.</div> : (
                <div className="item-list">
                  {machineUsageCounts.map((row) => (
                    <div className="item" key={row.machine.id}>
                      <div>
                        <strong>{row.machine.name}</strong>
                        <div className="small-muted">{row.machine.machine_code}</div>
                      </div>
                      <div>
                        <div className="stat-value" style={{ fontSize: 26, margin: 0 }}>{row.count}</div>
                        <div className="small-muted">parts issued</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {tab === 'parts' ? (
          <div className="card">
            <div className="search-row">
              <div>
                <h2 style={{ margin: 0 }}>Parts Inventory</h2>
                <p className="small-muted">Search, adjust, and monitor current stock.</p>
              </div>
              <input className="input search-input" placeholder="Search parts, category, location..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            {filteredParts.length === 0 ? <div className="empty">No parts yet.</div> : (
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
                        <td><strong>{part.name}</strong><div className="small-muted">{part.part_number}</div></td>
                        <td>{part.category}</td>
                        <td style={{ color: Number(part.stock) <= Number(part.min_stock) ? 'var(--danger)' : 'inherit', fontWeight: Number(part.stock) <= Number(part.min_stock) ? 700 : 400 }}>{part.stock}</td>
                        <td>{part.min_stock}</td>
                        <td>{part.location}</td>
                        <td>{part.supplier}</td>
                        <td>
                          <div className="actions-inline">
                            <button className="btn" onClick={() => adjustStock(part.id, 1)} disabled={saving}>+1</button>
                            <button className="btn" onClick={() => adjustStock(part.id, -1)} disabled={saving}>-1</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}

        {tab === 'machines' ? (
          machines.length === 0 ? <div className="empty">No machines yet.</div> : (
            <div className="grid-cards">
              {machines.map((machine) => {
                const logs = usageLogs.filter((log) => log.machine_id === machine.id);
                return (
                  <div className="card" key={machine.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                      <div>
                        <h3 style={{ margin: 0 }}>{machine.name}</h3>
                        <div className="small-muted">{machine.machine_code} • {machine.model}</div>
                      </div>
                      <span className={`badge ${machine.status === 'Active' ? 'green' : ''}`}>{machine.status}</span>
                    </div>
                    <p className="kv"><strong>Site:</strong> {machine.site || '—'}</p>
                    <p className="kv"><strong>Notes:</strong> {machine.notes || '—'}</p>
                    <p className="kv"><strong>Parts logged:</strong> {logs.reduce((sum, l) => sum + Number(l.qty || 0), 0)}</p>
                    <div style={{ marginTop: 16 }}>
                      <strong>Recent part usage</strong>
                      <div className="item-list" style={{ marginTop: 10 }}>
                        {logs.slice(0, 3).length === 0 ? <div className="small-muted">No parts logged yet.</div> : logs.slice(0, 3).map((log) => (
                          <div className="item" key={log.id}>
                            <div>
                              <strong>{log.part?.name || 'Unknown part'}</strong>
                              <div className="small-muted">Qty {log.qty} • {log.log_date} • {log.user_name}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : null}

        {tab === 'usage' ? (
          <div className="card">
            <div className="search-row">
              <div>
                <h2 style={{ margin: 0 }}>Usage Log</h2>
                <p className="small-muted">Every part issued to a machine is recorded here.</p>
              </div>
              <button className="btn" onClick={exportUsageCsv}>Export CSV</button>
            </div>
            {usageLogs.length === 0 ? <div className="empty">No usage logs yet.</div> : (
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
                    </tr>
                  </thead>
                  <tbody>
                    {usageLogs.map((log) => (
                      <tr key={log.id}>
                        <td>{log.log_date}</td>
                        <td>{log.user_name}</td>
                        <td><strong>{log.part?.name || 'Unknown Part'}</strong><div className="small-muted">{log.part?.part_number || ''}</div></td>
                        <td>{log.machine?.name || 'Unknown Machine'}</td>
                        <td>{log.qty}</td>
                        <td>{log.reference || '—'}</td>
                        <td>{log.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}
      </div>

      <Modal open={showPartModal} title="Add New Part" onClose={() => setShowPartModal(false)}>
        <div className="form-grid">
          <div><label className="label">Part name</label><input className="input" value={newPart.name} onChange={(e) => setNewPart({ ...newPart, name: e.target.value })} /></div>
          <div><label className="label">Part number</label><input className="input" value={newPart.part_number} onChange={(e) => setNewPart({ ...newPart, part_number: e.target.value })} /></div>
          <div><label className="label">Category</label><input className="input" value={newPart.category} onChange={(e) => setNewPart({ ...newPart, category: e.target.value })} /></div>
          <div><label className="label">Location</label><input className="input" value={newPart.location} onChange={(e) => setNewPart({ ...newPart, location: e.target.value })} /></div>
          <div><label className="label">Current stock</label><input className="input" type="number" value={newPart.stock} onChange={(e) => setNewPart({ ...newPart, stock: e.target.value })} /></div>
          <div><label className="label">Minimum stock</label><input className="input" type="number" value={newPart.min_stock} onChange={(e) => setNewPart({ ...newPart, min_stock: e.target.value })} /></div>
          <div className="full"><label className="label">Supplier</label><input className="input" value={newPart.supplier} onChange={(e) => setNewPart({ ...newPart, supplier: e.target.value })} /></div>
          <div className="full"><label className="label">Notes</label><textarea className="textarea" value={newPart.notes} onChange={(e) => setNewPart({ ...newPart, notes: e.target.value })} /></div>
        </div>
        <div className="button-row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
          <button className="btn primary" onClick={addPart} disabled={saving}>Save Part</button>
        </div>
      </Modal>

      <Modal open={showMachineModal} title="Add Machine" onClose={() => setShowMachineModal(false)}>
        <div className="form-grid">
          <div><label className="label">Machine code</label><input className="input" value={newMachine.machine_code} onChange={(e) => setNewMachine({ ...newMachine, machine_code: e.target.value })} /></div>
          <div><label className="label">Machine name</label><input className="input" value={newMachine.name} onChange={(e) => setNewMachine({ ...newMachine, name: e.target.value })} /></div>
          <div><label className="label">Model</label><input className="input" value={newMachine.model} onChange={(e) => setNewMachine({ ...newMachine, model: e.target.value })} /></div>
          <div><label className="label">Site</label><input className="input" value={newMachine.site} onChange={(e) => setNewMachine({ ...newMachine, site: e.target.value })} /></div>
          <div>
            <label className="label">Status</label>
            <select className="select" value={newMachine.status} onChange={(e) => setNewMachine({ ...newMachine, status: e.target.value })}>
              <option value="Active">Active</option>
              <option value="Maintenance">Maintenance</option>
              <option value="Offline">Offline</option>
            </select>
          </div>
          <div className="full"><label className="label">Notes</label><textarea className="textarea" value={newMachine.notes} onChange={(e) => setNewMachine({ ...newMachine, notes: e.target.value })} /></div>
        </div>
        <div className="button-row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
          <button className="btn primary" onClick={addMachine} disabled={saving}>Save Machine</button>
        </div>
      </Modal>

      <Modal open={showIssueModal} title="Log Part Used on Machine" onClose={() => setShowIssueModal(false)}>
        <div className="form-grid">
          <div><label className="label">Date</label><input className="input" type="date" value={issueForm.log_date} onChange={(e) => setIssueForm({ ...issueForm, log_date: e.target.value })} /></div>
          <div><label className="label">User</label><input className="input" value={issueForm.user_name} onChange={(e) => setIssueForm({ ...issueForm, user_name: e.target.value })} /></div>
          <div>
            <label className="label">Machine</label>
            <select className="select" value={issueForm.machine_id} onChange={(e) => setIssueForm({ ...issueForm, machine_id: e.target.value })}>
              <option value="">Select machine</option>
              {machines.map((machine) => <option key={machine.id} value={machine.id}>{machine.name} • {machine.machine_code}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Part</label>
            <select className="select" value={issueForm.part_id} onChange={(e) => setIssueForm({ ...issueForm, part_id: e.target.value })}>
              <option value="">Select part</option>
              {parts.map((part) => <option key={part.id} value={part.id}>{part.name} • {part.part_number} • Stock {part.stock}</option>)}
            </select>
          </div>
          <div><label className="label">Quantity</label><input className="input" type="number" min="1" value={issueForm.qty} onChange={(e) => setIssueForm({ ...issueForm, qty: e.target.value })} /></div>
          <div><label className="label">Work order / ref</label><input className="input" value={issueForm.reference} onChange={(e) => setIssueForm({ ...issueForm, reference: e.target.value })} /></div>
          <div className="full"><label className="label">Notes</label><textarea className="textarea" value={issueForm.notes} onChange={(e) => setIssueForm({ ...issueForm, notes: e.target.value })} /></div>
        </div>
        <div className="button-row" style={{ marginTop: 16, justifyContent: 'space-between' }}>
          <button className="btn" onClick={copySql}>Copy SQL again</button>
          <button className="btn primary" onClick={issuePart} disabled={saving}>Save Usage Log</button>
        </div>
      </Modal>
    </main>
  );
}
