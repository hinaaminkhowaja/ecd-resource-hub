import React, { useEffect, useState } from 'react';
import App from './App.jsx';
import LoginView from './LoginView.jsx';

export default function AuthGate() {
  const [user,setUser]=useState(null);
  const [checking,setChecking]=useState(true);
  useEffect(()=>{
    let active=true;
    fetch('/api/auth/me').then(async response=>{
      if(!response.ok)return null;
      const data=await response.json();return data.user||null;
    }).then(value=>{if(active)setUser(value);}).catch(()=>{}).finally(()=>{if(active)setChecking(false);});
    return ()=>{active=false;};
  },[]);
  async function logout(){
    await fetch('/api/auth/logout',{method:'POST'}).catch(()=>{});
    setUser(null);
  }
  if(checking)return <main className="auth-page"><p>Loading ECED Resource Hub…</p></main>;
  if(!user)return <LoginView onLogin={setUser}/>;
  return <App user={user} onLogout={logout}/>;
}
