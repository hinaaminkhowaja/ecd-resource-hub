import React, { useEffect, useMemo, useState } from 'react';
import { Activity, RefreshCw, Users, LogIn, Clock3 } from 'lucide-react';
import './login-activity.css';

function dateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}
function browserLabel(value) {
  const ua = String(value || '');
  if (!ua) return 'Unknown device';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const device = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'Device';
  return device + ' · ' + browser;
}
export default function LoginActivityView() {
  const [data, setData] = useState({ events: [], users: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [range, setRange] = useState('all');

  async function load() {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/admin/login-activity', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not load login activity.');
      setData({ events: result.events || [], users: result.users || [] });
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const cutoff = range === 'all' ? 0 : Date.now() - Number(range) * 86400000;
    const q = query.trim().toLowerCase();
    return data.events.filter(event => {
      const matchDate = new Date(event.loginAt).getTime() >= cutoff;
      const matchText = !q || [event.email, event.region, event.role, event.ipAddress, browserLabel(event.userAgent)].join(' ').toLowerCase().includes(q);
      return matchDate && matchText;
    });
  }, [data.events, query, range]);
  const totalLogins = data.users.reduce((sum, user) => sum + Number(user.totalLogins || 0), 0);
  const activeSessions = data.users.reduce((sum, user) => sum + Number(user.activeSessions || 0), 0);

  return <section className="login-activity">
    <div className="login-activity-heading">
      <div><span className="login-activity-icon"><Activity size={20}/></span><div><h2>Login activity</h2><p>Monitor successful sign-ins, session times and recent access.</p></div></div>
      <button type="button" className="login-refresh" onClick={load} disabled={loading}><RefreshCw size={15}/>{loading ? 'Refreshing…' : 'Refresh'}</button>
    </div>
    <div className="login-metrics">
      <article><Users size={18}/><strong>{data.users.length}</strong><span>Accounts</span></article>
      <article><LogIn size={18}/><strong>{totalLogins.toLocaleString()}</strong><span>Recorded logins</span></article>
      <article><Activity size={18}/><strong>{activeSessions.toLocaleString()}</strong><span>Active sessions</span></article>
    </div>
    {error && <p className="login-error" role="alert">{error}</p>}
    <div className="login-users-table">
      <h3>User login summary</h3>
      <div className="login-table-wrap"><table><thead><tr><th>User</th><th>Role / Region</th><th>Total logins</th><th>Last login</th><th>Active sessions</th></tr></thead>
        <tbody>{data.users.map(user => <tr key={user.id}><td>{user.email}{!user.active && <small className="login-inactive"> · Inactive</small>}</td><td>{user.role === 'ADMIN' ? 'Admin' : (user.region || '—')}</td><td>{Number(user.totalLogins || 0).toLocaleString()}</td><td>{dateTime(user.lastLogin)}</td><td>{Number(user.activeSessions || 0)}</td></tr>)}
          {!loading && data.users.length === 0 && <tr><td colSpan="5" className="login-empty">No user accounts found.</td></tr>}</tbody></table></div>
    </div>
    <div className="login-events">
      <div className="login-events-heading"><h3>Detailed login history</h3><span>{filtered.length} records shown · latest 500 stored events</span></div>
      <div className="login-filters"><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search email, region, IP or device…"/><select value={range} onChange={e => setRange(e.target.value)} aria-label="Filter by date"><option value="all">All dates</option><option value="1">Last 24 hours</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select></div>
      <div className="login-table-wrap"><table><thead><tr><th>User</th><th>Login time</th><th>Logout time</th><th>Device / browser</th><th>IP address</th></tr></thead>
        <tbody>{filtered.map(event => <tr key={event.id}><td>{event.email}<small>{event.role === 'ADMIN' ? 'Admin' : event.region}</small></td><td><Clock3 size={13}/> {dateTime(event.loginAt)}</td><td>{dateTime(event.logoutAt)}</td><td>{browserLabel(event.userAgent)}</td><td>{event.ipAddress || 'Not provided'}</td></tr>)}
          {!loading && filtered.length === 0 && <tr><td colSpan="5" className="login-empty">No login records match these filters. New logins will appear here.</td></tr>}</tbody></table></div>
      <p className="login-footnote">Only successful logins are recorded. Login history starts when this feature is deployed; earlier logins cannot be reconstructed. IP address and browser details are recorded for access auditing. Active sessions may expire automatically after seven days even if the user does not sign out.</p>
    </div>
  </section>;
}
