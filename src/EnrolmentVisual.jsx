import React, { useState } from 'react';
import './enrolment-visual.css';

const SHORT = { Southern_01:'1|SO', Central_02:'2|CE', 'Upper Chitral_03':'3|UC', 'Lower Chitral_04':'4|LC', 'Gupis-Yasin_05':'5|GY', 'Ishkoman-Puniyal_06':'6|IP', Hunza_07:'7|HZ', Gilgit_08:'8|GL' };
const QS = ['q1', 'q2', 'q3', 'q4'];
const QL = ['Q1', 'Q2', 'Q3', 'Q4'];
const fmt = (n) => (n === null || n === undefined ? '—' : Math.round(n).toLocaleString());
const signed = (n) => (n === null || n === undefined ? '—' : (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(Math.round(n)).toLocaleString());
const pct = (n) => (n === null || n === undefined ? '—' : n.toFixed(1) + '%');
const spct = (n) => (n === null || n === undefined ? '—' : (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n).toFixed(1) + '%');
const heat = (v) => (v === null ? 'transparent' : `rgba(36,110,72,${(0.08 + Math.min(1, Math.max(0, (v - 70) / 30)) * 0.55).toFixed(2)})`);

function Spark({ values, bad }) {
  const pts = values.map((v, i) => (v === null ? null : [4 + i * 26, 26 - (Math.min(Math.max(v, 60), 105) - 60) * 0.5])).filter(Boolean);
  if (pts.length < 2) return <span>—</span>;
  const color = bad ? '#be322d' : '#246e48';
  const last = pts[pts.length - 1];
  return <svg viewBox="0 0 86 30" width="86" height="30" role="img" aria-label="Achievement trend Q1 to Q4"><polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><circle cx={last[0]} cy={last[1]} r="3" fill={color} /></svg>;
}

export default function EnrolmentVisual({ regionNames, getValue, getTarget, className, previousClass }) {
  const [compare, setCompare] = useState(0);
  const rows = regionNames.filter((n) => n !== 'All Regions').map((name) => {
    const target = getTarget(name);
    const q = QS.map((f) => getValue(name, f));
    const ach = q.map((v) => (v !== null && target > 0 ? (v / target) * 100 : null));
    const base = previousClass ? getValue(name, 'enrollment2025') : null;
    const pGap = q[3] !== null && base !== null && base !== undefined ? q[3] - base : null;
    return { name, label: SHORT[name] || name, target, q, ach, base, pGap, pPct: pGap !== null && base > 0 ? (pGap / base) * 100 : null };
  });
  const total = (() => {
    const target = getTarget('All Regions');
    const q = QS.map((f) => getValue('All Regions', f));
    const base = previousClass ? getValue('All Regions', 'enrollment2025') : null;
    const pGap = q[3] !== null && base !== null && base !== undefined ? q[3] - base : null;
    return { target, q, base, pGap, pPct: pGap !== null && base > 0 ? (pGap / base) * 100 : null, ach: q.map((v) => (v !== null && target > 0 ? (v / target) * 100 : null)), gap: q[3] !== null && target !== null ? q[3] - target : null };
  })();
  if (!rows.length || total.q[3] === null) return null;

  const below90 = rows.filter((r) => r.ach[3] !== null && r.ach[3] < 90).length;
  const ranked = [...rows].filter((r) => r.ach[3] !== null && r.target > 0).sort((a, b) => b.ach[3] - a.ach[3]);
  const maxVal = Math.max(...ranked.map((r) => Math.max(r.target, r.q[3] || 0)), 1);
  const changeOf = (r) => (r.q[3] !== null && r.q[compare] !== null ? r.q[3] - r.q[compare] : null);
  const changePct = (r) => (changeOf(r) !== null && r.q[compare] > 0 ? (changeOf(r) / r.q[compare]) * 100 : null);

  const prevRows = rows.filter((r) => r.pGap !== null).sort((a, b) => a.pPct - b.pPct);
  const maxPct = Math.max(...prevRows.map((r) => Math.abs(r.pPct || 0)), 1);
  const belowPrev = prevRows.filter((r) => r.pGap < 0).length;

  const insights = [];
  rows.filter((r) => r.q[3] !== null && r.q[0] !== null && r.q[3] < r.q[0]).forEach((r) => insights.push({ bad: true, text: `${r.label} fell from ${r.q[0].toLocaleString()} in Q1 to ${r.q[3].toLocaleString()} in Q4 (${signed(r.q[3] - r.q[0])}).` }));
  const gains = rows.filter((r) => r.ach[0] !== null && r.ach[3] !== null).sort((a, b) => (b.ach[3] - b.ach[0]) - (a.ach[3] - a.ach[0]));
  if (gains.length) insights.push({ bad: false, text: `${gains[0].label} gained the most achievement: ${pct(gains[0].ach[0])} to ${pct(gains[0].ach[3])} (+${(gains[0].ach[3] - gains[0].ach[0]).toFixed(1)} pts).` });
  const lowest = ranked[ranked.length - 1];
  if (lowest && ranked.length > 1) insights.push({ bad: lowest.ach[3] < 90, text: `${lowest.label} has the lowest Q4 achievement at ${pct(lowest.ach[3])}, ${fmt(Math.abs(lowest.q[3] - lowest.target))} ${lowest.q[3] < lowest.target ? 'below' : 'above'} target.` });

  return <div className="ev">
    <div className="ev-kpis">
      <div><small>Q4 enrolment</small><b>{fmt(total.q[3])}</b><span>target {fmt(total.target)}</span></div>
      <div><small>Q4 achievement</small><b>{pct(total.ach[3])}</b><span>Q1 was {pct(total.ach[0])}</span></div>
      <div><small>Growth since Q1</small><b>{signed(total.q[0] !== null ? total.q[3] - total.q[0] : null)}</b><span>Q4 vs Q1</span></div>
      <div><small>Gap to target</small><b className={total.gap < 0 ? 'ev-neg' : ''}>{signed(total.gap)}</b><span>{below90} of {rows.length} regions below 90%</span></div>
    </div>

    {ranked.length > 0 && <>
      <h4>Target vs achievement</h4>
      <div className="ev-legend"><span><i style={{ background: '#b9c6bd' }} />2025–26 target</span><span><i style={{ background: '#246e48' }} />Q4 enrolment</span></div>
      <div className="ev-tbars">{ranked.map((r) => <div key={r.name} className="ev-tbar">
        <span className="ev-bar-name">{r.label}</span>
        <span className="ev-tbar-lines">
          <span className="ev-tbar-row"><span className="ev-tbar-track"><span className="ev-bar-fill is-target" style={{ width: (r.target / maxVal) * 100 + '%' }} /></span><span className="ev-tbar-val">{fmt(r.target)}</span></span>
          <span className="ev-tbar-row"><span className="ev-tbar-track"><span className={'ev-bar-fill' + (r.q[0] !== null && r.q[3] < r.q[0] ? ' is-down' : '')} style={{ width: ((r.q[3] || 0) / maxVal) * 100 + '%' }} /></span><span className="ev-tbar-val"><b>{fmt(r.q[3])}</b> · {pct(r.ach[3])}</span></span>
        </span>
      </div>)}</div>
      <p className="ev-note">Regions ranked by Q4 achievement, highest first. Both bars use the same scale. Red means Q4 enrolment is below Q1.</p>
    </>}

    <div className="ev-head"><h4>Achievement by region and quarter</h4>
      <label>Compare Q4 with <select value={compare} onChange={(e) => setCompare(Number(e.target.value))}>{[0, 1, 2].map((i) => <option key={i} value={i}>{QL[i]}</option>)}</select></label></div>
    <div className="ev-wrap"><table className="ev-table">
      <thead><tr><th>Region</th>{QL.map((l) => <th key={l}>{l}</th>)}<th>Q4 vs {QL[compare]}</th><th>Trend</th></tr></thead>
      <tbody>{rows.map((r) => <tr key={r.name}>
        <th scope="row">{r.label}</th>
        {r.ach.map((v, i) => <td key={i} style={{ background: heat(v) }}>{pct(v)}</td>)}
        <td className={changeOf(r) < 0 ? 'ev-neg-cell' : ''}>{signed(changeOf(r))}{changePct(r) !== null ? ` (${changePct(r).toFixed(1)}%)` : ''}</td>
        <td><Spark values={r.ach} bad={r.ach[3] !== null && r.ach[0] !== null && r.ach[3] < r.ach[0]} /></td>
      </tr>)}</tbody>
    </table></div>
    <p className="ev-note">Darker green means higher achievement.</p>

    {previousClass && total.base !== null && total.base !== undefined && <section className="ev-prev">
      <h4>Previous class scorecard: {className} vs {previousClass}</h4>
      <div className="ev-kpis">
        <div><small>{previousClass} 2025 enrolment</small><b>{fmt(total.base)}</b><span>previous class baseline</span></div>
        <div><small>{className} Q4 enrolment</small><b>{fmt(total.q[3])}</b><span>current year</span></div>
        <div><small>Gap vs previous class</small><b className={total.pGap < 0 ? 'ev-neg' : ''}>{signed(total.pGap)}</b><span>{spct(total.pPct)} of {previousClass}</span></div>
        <div><small>Regions below {previousClass}</small><b className={belowPrev ? 'ev-neg' : ''}>{belowPrev} of {prevRows.length}</b><span>Q4 under the baseline</span></div>
      </div>
      {prevRows.length > 0 && <>
        <h4>Previous class gap by region</h4>
        <div className="ev-div">{prevRows.map((r) => {
          const w = (Math.abs(r.pPct) / maxPct) * 50;
          return <div key={r.name} className="ev-div-row">
            <span className="ev-bar-name">{r.label}</span>
            <span className="ev-div-track"><span className="ev-div-axis" /><span className={'ev-div-fill ' + (r.pGap < 0 ? 'is-neg' : 'is-pos')} style={r.pGap < 0 ? { right: '50%', width: w + '%' } : { left: '50%', width: w + '%' }} /></span>
            <span className={'ev-div-val ' + (r.pGap < 0 ? 'ev-neg' : '')}><b>{signed(r.pGap)}</b> ({spct(r.pPct)})<small>{fmt(r.base)} → {fmt(r.q[3])}</small></span>
          </div>;
        })}</div>
        <p className="ev-note">Gap = Q4 {className} enrolment minus {previousClass} 2025 enrolment. Bar length shows the percentage gap. Red bars to the left mean fewer children than the previous class.</p>
      </>}
    </section>}

    {insights.length > 0 && <><h4>What stands out</h4>
      <ul className="ev-insights">{insights.map((s, i) => <li key={i} className={s.bad ? 'is-bad' : ''}>{s.text}</li>)}</ul></>}
  </div>;
}
