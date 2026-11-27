import React, { useEffect, useMemo, useState } from 'react';
import './rec-analysis.css';

export const CLASS_GROUPS = [
  { label: 'Ibtida', classes: ['Ibtida'] },
  { label: 'Nursery', classes: ['Nursery'] },
  { label: 'KG I', classes: ['KG I'] },
  { label: 'KG II', classes: ['KG II'] },
  { label: 'Ibtida–KG II', classes: ['Ibtida', 'Nursery', 'KG I', 'KG II'] },
  { label: 'Ibtida–KG I', classes: ['Ibtida', 'Nursery', 'KG I'] },
  { label: 'Nursery–KG I', classes: ['Nursery', 'KG I'] },
];
export const classMatches = (selection, className) => {
  if (!selection) return true;
  const group = CLASS_GROUPS.find((g) => g.label === selection);
  return group ? group.classes.includes(className) : className === selection;
};

const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const fmt = (v) => (num(v) === null ? '—' : num(v).toLocaleString());
const signed = (v) => (num(v) === null ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toLocaleString());
const withPct = (change, base) => {
  if (num(change) === null) return '—';
  if (!(base > 0)) return signed(change);
  const p = (change / base) * 100;
  return signed(change) + ` (${p > 0 ? '+' : p < 0 ? '−' : ''}${Math.abs(p).toFixed(1)}%)`;
};
const tone = (v) => (num(v) === null || v === 0 ? '' : v < 0 ? 'ra-neg' : 'ra-pos');
const sumOf = (rows, f) => { const v = rows.map((r) => num(r[f])).filter((x) => x !== null); return v.length ? v.reduce((a, x) => a + x, 0) : null; };

function Spark({ values }) {
  const v = values.map(num);
  const ok = v.filter((x) => x !== null);
  if (ok.length < 2) return <span className="ra-muted">—</span>;
  const lo = Math.min(...ok), hi = Math.max(...ok), span = hi - lo || 1;
  const pts = v.map((x, i) => (x === null ? null : [4 + i * 24, 24 - ((x - lo) / span) * 18])).filter(Boolean);
  const down = ok[ok.length - 1] < ok[0];
  const c = down ? '#be322d' : '#246e48';
  const last = pts[pts.length - 1];
  return <svg viewBox="0 0 80 28" width="80" height="28" role="img" aria-label="Enrolment trend Q1 to Q4"><polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><circle cx={last[0]} cy={last[1]} r="3" fill={c} /></svg>;
}

const STATUS = {
  zero: { label: 'Zero Q4', cls: 'is-zero' },
  drop: { label: 'Sharp decline', cls: 'is-drop' },
  down: { label: 'Declining', cls: 'is-down' },
  flat: { label: 'Stable', cls: 'is-flat' },
  up: { label: 'Growing', cls: 'is-up' },
  na: { label: 'No data', cls: 'is-na' },
};
export function recStatus(r) {
  const q1 = num(r.q1), q4 = num(r.q4);
  if (q4 === 0) return 'zero';
  if (q1 === null || q4 === null) return 'na';
  if (q1 > 0 && (q4 - q1) / q1 <= -0.2) return 'drop';
  if (q4 < q1) return 'down';
  if (q4 > q1) return 'up';
  return 'flat';
}

export function RecWiseView({ records, renderReason }) {
  const [statusFilter, setStatusFilter] = useState('');
  const [sort, setSort] = useState('default');
  const [limit, setLimit] = useState(50);
  useEffect(() => setLimit(50), [records, statusFilter, sort]);

  const decorated = useMemo(() => records.map((r) => ({ r, status: recStatus(r), change: num(r.q4) !== null && num(r.q1) !== null ? num(r.q4) - num(r.q1) : null })), [records]);
  const counts = useMemo(() => decorated.reduce((a, d) => { a[d.status] = (a[d.status] || 0) + 1; return a; }, {}), [decorated]);
  const chips = [['', 'All', decorated.length], ['zero', 'Zero Q4', counts.zero || 0], ['decline', 'Declining', (counts.down || 0) + (counts.drop || 0)], ['up', 'Growing', counts.up || 0], ['flat', 'Stable', counts.flat || 0]];
  const visible = useMemo(() => {
    let list = decorated.filter((d) => !statusFilter || (statusFilter === 'decline' ? d.status === 'down' || d.status === 'drop' : d.status === statusFilter));
    if (sort === 'decline') list = [...list].sort((a, b) => (a.change ?? 1e9) - (b.change ?? 1e9));
    else if (sort === 'q4') list = [...list].sort((a, b) => (num(b.r.q4) ?? -1) - (num(a.r.q4) ?? -1));
    else if (sort === 'name') list = [...list].sort((a, b) => String(a.r.recName).localeCompare(String(b.r.recName)));
    return list;
  }, [decorated, statusFilter, sort]);

  const recCount = new Set(records.map((r) => r.recCode)).size;
  const q1 = sumOf(records, 'q1'), q4 = sumOf(records, 'q4');
  const classes = ['Ibtida', 'Nursery', 'KG I', 'KG II'].map((c) => {
    const rows = records.filter((r) => r.className === c);
    return rows.length ? { c, q1: sumOf(rows, 'q1'), q4: sumOf(rows, 'q4'), recs: rows.length } : null;
  }).filter(Boolean);
  if (!records.length) return <div className="empty-state"><b>No records match these filters</b><span>Change the region, board, REC or class and try again.</span></div>;

  return <div className="ra">
    <div className="ra-kpis">
      <div><small>RECs</small><b>{recCount.toLocaleString()}</b><span>{records.length.toLocaleString()} REC and class records</span></div>
      <div><small>Q4 enrolment</small><b>{fmt(q4)}</b><span>Q1 was {fmt(q1)}</span></div>
      <div><small>Q4 vs Q1</small><b className={tone(q4 - q1)}>{q1 !== null && q4 !== null ? signed(q4 - q1) : '—'}</b><span>{q1 > 0 ? ((q4 - q1) / q1 * 100).toFixed(1) + '% change' : ''}</span></div>
      <div><small>Declining records</small><b className={(counts.down || 0) + (counts.drop || 0) ? 'ra-neg' : ''}>{((counts.down || 0) + (counts.drop || 0)).toLocaleString()}</b><span>{(counts.zero || 0).toLocaleString()} with zero Q4</span></div>
    </div>

    {classes.length > 1 && <div className="ra-classes">{classes.map((x) => <div key={x.c}>
      <small>{x.c}</small><b>{fmt(x.q4)}</b><span className={tone(x.q4 - x.q1)}>{signed(x.q4 - x.q1)} vs Q1</span>
    </div>)}</div>}

    <div className="ra-toolbar">
      <div className="ev-chips" role="group" aria-label="Filter by status">{chips.map(([key, label, n]) => <button key={label} type="button" className={statusFilter === key ? 'active' : ''} onClick={() => setStatusFilter(key)}>{label} <i>{n.toLocaleString()}</i></button>)}</div>
      <label>Sort by <select value={sort} onChange={(e) => setSort(e.target.value)}><option value="default">Default order</option><option value="decline">Biggest decline (Q4 vs Q1)</option><option value="q4">Largest Q4 enrolment</option><option value="name">REC name</option></select></label>
    </div>

    <div className="ra-wrap"><table className="ra-table">
      <thead><tr><th>REC</th><th>Class</th><th>2025 baseline</th><th>Q1</th><th>Q2</th><th>Q3</th><th>Q4</th><th>Q4 vs Q1</th><th>Q4 vs 2025</th><th>Trend</th><th>Status</th><th>Reason</th></tr></thead>
      <tbody>{visible.slice(0, limit).map(({ r, status, change }, i) => {
        const s = STATUS[status];
        return <tr key={r.recCode + '-' + r.classCode + '-' + i}>
          <th scope="row"><b>{r.recName}</b><small>{r.region} · {r.localBoard}{r.directoryMatch === false ? ' · not in REC directory' : ''}</small></th>
          <td><span className="ra-class">{r.className}</span></td>
          <td>{fmt(r.enrollment2025)}</td>
          <td>{fmt(r.q1)}</td><td>{fmt(r.q2)}</td><td>{fmt(r.q3)}</td>
          <td title={r.latestQuarter ? `Latest: ${fmt(r.latestEnrollment)} (${r.latestQuarter})` : undefined}><b>{fmt(r.q4)}</b></td>
          <td className={'ra-var ' + tone(change)}>{withPct(change, num(r.q1))}</td>
          <td className={'ra-var ' + tone(num(r.q4Vs2025))}>{withPct(num(r.q4Vs2025), num(r.enrollment2025))}</td>
          <td><Spark values={[r.q1, r.q2, r.q3, r.q4]} /></td>
          <td><span className={'ra-badge ' + s.cls}>{s.label}</span></td>
          <td>{renderReason(r)}</td>
        </tr>;
      })}</tbody>
    </table></div>
    {visible.length === 0 && <p className="ra-muted">No records with this status.</p>}
    <p className="ra-foot">Showing {Math.min(limit, visible.length).toLocaleString()} of {visible.length.toLocaleString()} records. Sharp decline means Q4 is 20% or more below Q1.</p>
    {visible.length > limit && <button type="button" className="show-more-access" onClick={() => setLimit((n) => n + 50)}>Show 50 more records</button>}
  </div>;
}

const YEAR_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#e87ba4', '#6250d6'];
const ACCESS = [['Adequate', '#246e48'], ['Moderate', '#e0a526'], ['Low', '#e8793d'], ['NonAccess', '#be322d']];

export function HistoryView({ rows }) {
  const [limit, setLimit] = useState(50);
  useEffect(() => setLimit(50), [rows]);
  const years = useMemo(() => [...new Set(rows.map((r) => r.year))].sort(), [rows]);
  const totals = useMemo(() => years.map((y) => {
    const yr = rows.filter((r) => r.year === y);
    return { year: y, q: ['q1', 'q2', 'q3', 'q4'].map((f) => sumOf(yr, f)) };
  }), [rows, years]);
  if (!rows.length) return null;

  const all = totals.flatMap((t) => t.q).filter((v) => v !== null);
  const lo = Math.min(...all) * 0.95, hi = Math.max(...all) * 1.04, span = hi - lo || 1;
  const X = (i) => 70 + i * 170, Y = (v) => 190 - ((v - lo) / span) * 150;

  return <div className="ra">
    <h4 className="ra-h">Quarterly enrolment by academic year</h4>
    <div className="ra-legend">{totals.map((t, i) => <span key={t.year}><i style={{ background: YEAR_COLORS[i % YEAR_COLORS.length] }} />{t.year}</span>)}</div>
    <svg viewBox="0 0 620 220" width="100%" role="img" aria-label="Total enrolment per quarter, one line per academic year" className="ra-chart">
      {[0, 1, 2, 3].map((i) => <g key={i}><line x1={X(i)} x2={X(i)} y1="30" y2="190" stroke="#e1e6e2" /><text x={X(i)} y="210" textAnchor="middle" fontSize="12" fill="#6a7a70">Q{i + 1}</text></g>)}
      {totals.map((t, ti) => {
        const col = YEAR_COLORS[ti % YEAR_COLORS.length];
        const pts = t.q.map((v, i) => (v === null ? null : [X(i), Y(v), v])).filter(Boolean);
        return <g key={t.year}>
          <polyline points={pts.map((p) => p[0] + ',' + p[1]).join(' ')} fill="none" stroke={col} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          {pts.map((p, i) => <g key={i}><circle cx={p[0]} cy={p[1]} r="4" fill={col} /><text x={p[0]} y={p[1] - 9} textAnchor="middle" fontSize="11" fill="#33443a">{Math.round(p[2]).toLocaleString()}</text></g>)}
        </g>;
      })}
    </svg>

    <h4 className="ra-h">REC records</h4>
    <div className="ra-legend">{ACCESS.map(([k, c]) => <span key={k}><i style={{ background: c }} />{k === 'NonAccess' ? 'Non-access' : k}</span>)}<span className="ra-muted">Q4 access mix</span></div>
    <div className="ra-wrap"><table className="ra-table">
      <thead><tr><th>REC</th><th>Year</th><th>Class</th><th>Q1</th><th>Q2</th><th>Q3</th><th>Q4</th><th>Q4 vs Q1</th><th>Q4 vs previous class</th><th>Q4 access mix</th></tr></thead>
      <tbody>{rows.slice(0, limit).map((r) => {
        const ch = num(r.q4) !== null && num(r.q1) !== null ? num(r.q4) - num(r.q1) : null;
        const parts = ACCESS.map(([k, c]) => [num(r['q4' + k]) || 0, c, k]);
        const tot = parts.reduce((a, p) => a + p[0], 0);
        return <tr key={r.key}>
          <th scope="row"><b>{r.recName}</b><small>{r.region} · {r.localBoard}</small></th>
          <td>{r.year}</td><td><span className="ra-class">{r.className}</span></td>
          <td>{fmt(r.q1)}</td><td>{fmt(r.q2)}</td><td>{fmt(r.q3)}</td><td><b>{fmt(r.q4)}</b></td>
          <td className={'ra-var ' + tone(ch)}>{withPct(ch, num(r.q1))}</td>
          <td className={'ra-var ' + tone(num(r.q4PreviousClassVariance))}>{withPct(num(r.q4PreviousClassVariance), num(r.previousQ4))}</td>
          <td>{tot > 0 ? <span className="ra-stack" title={parts.map((p) => `${p[2]}: ${p[0]}`).join(' · ')}>{parts.map((p, i) => <span key={i} style={{ width: (p[0] / tot) * 100 + '%', background: p[1] }} />)}</span> : <span className="ra-muted">—</span>}</td>
        </tr>;
      })}</tbody>
    </table></div>
    <p className="ra-foot">Showing {Math.min(limit, rows.length).toLocaleString()} of {rows.length.toLocaleString()} records.</p>
    {rows.length > limit && <button type="button" className="show-more-access" onClick={() => setLimit((n) => n + 50)}>Show 50 more records</button>}
  </div>;
}
