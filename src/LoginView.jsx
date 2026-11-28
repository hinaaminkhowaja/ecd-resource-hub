import React, { useState } from 'react';
import { LockKeyhole, Mail } from 'lucide-react';
import './auth.css';

export default function LoginView({ onLogin }) {
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
      const result=await response.json();
      if(!response.ok) throw new Error(result.error || 'Unable to sign in.');
      onLogin(result.user);
    } catch(e) { setError(e.message || 'Unable to sign in.'); }
    finally { setBusy(false); }
  }
  return <main className="auth-page">
    <form className="auth-card" onSubmit={submit}>
      <div className="auth-mark">ECED</div>
      <p className="auth-eyebrow">RESOURCE HUB</p>
      <h1>Sign in</h1>
      <p className="auth-copy">Use the email address and password assigned by your administrator.</p>
      <label>Email address<span className="auth-input"><Mail size={17}/><input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username" required placeholder="name@example.com"/></span></label>
      <label>Password<span className="auth-input"><LockKeyhole size={17}/><input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required placeholder="Enter your password"/></span></label>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <button className="auth-submit" disabled={busy}>{busy?'Signing in…':'Sign in'}</button>
      <p className="auth-help">If you do not have an account, contact your administrator.</p>
    </form>
  </main>;
}
