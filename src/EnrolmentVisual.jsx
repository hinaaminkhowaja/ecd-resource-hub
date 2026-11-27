import React, { useState } from 'react';
import './enrolment-visual.css';

const SHORT = { Southern_01:'1|SO', Central_02:'2|CE', 'Upper Chitral_03':'3|UC', 'Lower Chitral_04':'4|LC', 'Gupis-Yasin_05':'5|GY', 'Ishkoman-Puniyal_06':'6|IP', Hunza_07:'7|HZ', Gilgit_08:'8|GL' };
const QS = ['q1', 'q2', 'q3', 'q4'];
const QL = ['Q1', 'Q2', 'Q3', 'Q4'];
const fmt = (n) => (n === null || n === undefined ? '—' : Math.round(n).toLocaleString());
const signed = (n) => (n === null || n === undefined ? '—' : (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(Math.round(n)).toLocaleString());
const pct = (n) => (n === null || n === undefined ? '—' : n.toFixed(1) + '%');
const heat = (v) => (v === null ? 'transparent' : `rgba(36,110,72,${(0.08 + Math.min(1, Math.max(0, (v - 70) / 30)) * 0.55).toFixed(2)})`);
const gapShade = (g, max) => (g === null || g >= 0 ? 'transparent' : `rgba(190,50,45,${(0.07 + Math.min(1, Math.abs(g) / (max || 1)) * 0.33).toFixed(2)})`);

function Spark({ values, bad }) {
  const pts = values.map((v, i) => (v === null ? null : [4 + i * 26, 26 - (Math.min(Math.max(v, 60), 105) - 60) * 0.5])).filter(Boolean);
  if (pts.length < 2) return <span>—</span>;
  const color = bad ? '#be322d' : '#246e48';
  const last = pts[pts.length - 1];
  return <svg viewBox="0 0 86 30" width="86" height="30" role="img" aria-label="Achievement trend Q1 to Q4"><polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><circle cx={last[0]} cy={last[1]} r="3" fill={color} /></svg>;
}

export default function EnrolmentVisual({ regionNames, getValue, getTarget, className }) {
  const [compare, setCompare] = useState(0);
  const rows = regionNames.filter((n) => n !== 'All Regions').map((name) => {
    const target = getTarget(name);
    const q = QS.map((f) => getValue(name, f));
    const ach = q.map((v) => (v !== null && target > 0 ? (v / target) * 100 : null));
    return { name, label: SHORT[name] || name, target, q, ach, gap: q[3] !== null && target !== null ? q[3] - target : null };
  });
  const total = (() => {
    const target = getTarget('All Regions');
    const q = QS.map((f) => getValue('All Regions', f));
    return { target, q, ach: q.map((v) => (v !== null && target > 0 ? (v / target) * 100 : null)), gap: q[3] !== null && target !== null ? q[3] - target : null };
  })();
  if (!rows.length || total.q[3] === null) return null;
  const below90 = rows.filter((r) => r.ach[3] !== null && r.ach[3] < 90).length;
  const maxGap = Math.max(...rows.map((r) => Math.abs(r.gap || 0)));
  const ranked = [...rows].filter((r) => r.ach[3] !== null).sort((a, b) => b.ach[3] - a.ach[3]);
  const changeOf = (r) => (r.q[3] !== null && r.q[compare] !== null ? r.q[3] - r.q[compare] : null);
  const changePct = (r) => (changeOf(r) !== null && r.q[compare] > 0 ? (changeOf(r) / r.q[compare]) * 100 : null);

  const insights = [];
  rows.filter((r) => r.q[3] !== null && r.q[0] !== null && r.q[3] < r.q[0]).forEach((r) => insights.push({ bad: true, text: `${r.label} fell from ${r.q[0].toLocaleString()} in Q1 to ${r.q[3].toLocaleString()} in Q4 (${signed(r.q[3] - r.q[0])}).` }));
  const gains = rows.filter((r) => r.ach[0] !== null && r.ach[3] !== null).sort((a, b) => (b.ach[3] - b.ach[0]) - (a.ach[3] - a.ach[0]));
  if (gains.length) insights.push({ bad: false, text: `${gains[0].label} gained the most achievement: ${pct(gains[0].ach[0])} to ${pct(gains[0].ach[3])} (+${(gains[0].ach[3] - gains[0].ach[0]).toFixed(1)} pts).` });
  const lowest = ranked[ranked.length - 1];
  if (lowest && rows.length > 1) insights.push({ bad: lowest.ach[3] < 90, text: `${lowest.label} has the lowest Q4 achievement at ${pct(lowest.ach[3])}, ${fmt(Math.abs(lowest.gap))} below target.` });

  return <div className="ev">
    <div className="ev-kpis">
      <div><small>Q4 enrolment</small><b>{fmt(total.q[3])}</b><span>target {fmt(total.target)}</span></div>
      <div><small>Q4 achievement</small><b>{pct(total.ach[3])}</b><span>Q1 was {pct(total.ach[0])}</span></div>
      <div><small>Growth since Q1</small><b>{signed(total.q[0] !== null ? total.q[3] - total.q[0] : null)}</b><span>Q4 vs Q1</span></div>
      <div><small>Gap to target</small><b className={total.gap < 0 ? 'ev-neg' : ''}>{signed(total.gap)}</b><span>{below90} of {rows.length} regions below 90%</span></div>
    </div>

    <div className="ev-head"><h4>Achievement by region and quarter</h4>
      <label>Compare Q4 with <select value={compare} onChange={(e) => setCompare(Number(e.target.value))}>{[0, 1, 2].map((i) => <option key={i} value={i}>{QL[i]}</option>)}</select></label></div>
    <div className="ev-wrap"><table className="ev-table">
      <thead><tr><th>Region</th>{QL.map((l) => <th key={l}>{l}</th>)}<th>Q4 gap</th><th>Q4 vs {QL[compare]}</th><th>Trend</th></tr></thead>
      <tbody>{rows.map((r) => <tr key={r.name}>
        <th scope="row">{r.label}</th>
        {r.ach.map((v, i) => <td key={i} style={{ background: heat(v) }}>{pct(v)}</td>)}
        <td style={{ background: gapShade(r.gap, maxGap) }}>{signed(r.gap)}</td>
        <td className={changeOf(r) < 0 ? 'ev-neg-cell' : ''}>{signed(changeOf(r))}{changePct(r) !== null ? ` (${changePct(r).toFixed(1)}%)` : ''}</td>
        <td><Spark values={r.ach} bad={r.ach[3] !== null && r.ach[0] !== null && r.ach[3] < r.ach[0]} /></td>
      </tr>)}</tbody>
    </table></div>
    <p className="ev-note">Darker green means higher achievement. Red gap shading scales with the size of the shortfall.</p>

    {ranked.length > 1 && <><h4>Q4 achievement, ranked</h4>
      <div className="ev-bars">{ranked.map((r) => <div key={r.name} className="ev-bar">
        <span className="ev-bar-name">{r.label}</span>
        <span className="ev-bar-track"><span className={'ev-bar-fill' + (r.ach[3] < r.ach[0] ? ' is-down' : '')} style={{ width: Math.min(100, r.ach[3]) + '%' }} /><span className="ev-bar-line" /></span>
        <span className="ev-bar-val">{pct(r.ach[3])}</span>
      </div>)}</div>
      <p className="ev-note">Dashed line marks 100% of target. Red bars are regions where Q4 achievement is below Q1.</p></>}

    {insights.length > 0 && <><h4>What stands out</h4>
      <ul className="ev-insights">{insights.map((s, i) => <li key={i} className={s.bad ? 'is-bad' : ''}>{s.text}</li>)}</ul></>}
  </div>;
}
