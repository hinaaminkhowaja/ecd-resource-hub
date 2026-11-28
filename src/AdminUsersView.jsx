import React, { useEffect, useMemo, useState } from 'react';
import { Plus, UserRound, UserX } from 'lucide-react';
import recDirectory from './data/recs.json';
import './auth.css';

const regions=[...new Set(recDirectory.map(row=>row.region))].sort();
export default function AdminUsersView() {
  const [users,setUsers]=useState([]);
  const [email,setEmail]=useState('');
  const [region,setRegion]=useState('All');
  const [password,setPassword]=useState('');
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  async function load() {
    const response=await fetch('/api/admin/users');
    const data=await response.json();
    if(!response.ok) throw new Error(data.error||'Could not load users.');
    setUsers(data.users||[]);
  }
  useEffect(()=>{load().catch(e=>setMessage(e.message));},[]);
  async function create(event) {
    event.preventDefault();setBusy(true);setMessage('');
    try {
      const response=await fetch('/api/admin/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,region,password})});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||'Could not create account.');
      setEmail('');setPassword('');setMessage('Regional account created. Share the initial password securely with the user.');
      await load();
    } catch(e){setMessage(e.message);}
    finally{setBusy(false);}
  }
  async function toggle(user) {
    setMessage('');
    try {
      const response=await fetch('/api/admin/users',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:user.id,active:!user.active})});
      const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not update account.');
      await load();setMessage(user.active?'Account deactivated.':'Account reactivated.');
    } catch(e){setMessage(e.message);}
  }
  const counts=useMemo(()=>users.filter(u=>u.active).length,[users]);
  return <section className="admin-users">
    <div className="admin-users-intro"><div><span className="admin-users-icon"><UserRound size={20}/></span><div><h2>Regional user accounts</h2><p>Create login accounts and assign each email address to one region.</p></div></div><strong>{counts} active</strong></div>
    <form className="admin-user-form" onSubmit={create}>
      <label>User email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="regional.user@example.com"/></label>
      <label>Assigned region<select value={region} onChange={e=>setRegion(e.target.value)}><option value="All">All regions</option>{regions.map(r=><option key={r} value={r}>{r.replace(/_\d+$/,'')}</option>)}</select></label>
      <label>Initial password<input type="password" minLength={12} value={password} onChange={e=>setPassword(e.target.value)} required placeholder="At least 12 characters"/></label>
      <button disabled={busy}><Plus size={16}/>{busy?'Creating…':'Create account'}</button>
    </form>
    {message&&<p className="admin-message" role="status">{message}</p>}
    <div className="admin-user-list"><h3>Assigned accounts</h3>
      {users.length===0?<p className="admin-empty">No regional accounts have been created yet.</p>:users.map(user=><article key={user.id} className={!user.active?'inactive':''}><span className="admin-user-avatar"><UserRound size={17}/></span><div><b>{user.email}</b><small>{user.region === 'All' ? 'All regions' : user.region?.replace(/_\d+$/,'')||'No region assigned'}</small></div><select aria-label={'Assigned region for '+user.email} value={user.region||''} onChange={async e=>{const response=await fetch('/api/admin/users',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:user.id,region:e.target.value})});const data=await response.json();if(!response.ok){setMessage(data.error||'Could not change region.');return;}await load();setMessage('Region assignment updated.');}}><option value="All">All regions</option>{regions.map(r=><option key={r} value={r}>{r.replace(/_\d+$/,'')}</option>)}</select><span className={'admin-user-status '+(user.active?'active':'')}>{user.active?'Active':'Inactive'}</span><button type="button" onClick={()=>toggle(user)} title={user.active?'Deactivate account':'Reactivate account'}><UserX size={16}/>{user.active?'Deactivate':'Reactivate'}</button></article>)}
    </div>
  </section>;
}
