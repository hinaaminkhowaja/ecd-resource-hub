import React, { useMemo, useState } from 'react';
import { CLASS_GROUPS, classMatches } from './RecAnalysisViews.jsx';
import './red-flags.css';

const REGION_ORDER = ['Southern_01', 'Central_02', 'Upper Chitral_03', 'Lower Chitral_04', 'Gupis-Yasin_05', 'Ishkoman-Puniyal_06', 'Hunza_07', 'Gilgit_08'];
const SHORT = { Southern_01: '1|SO', Central_02: '2|CE', 'Upper Chitral_03': '3|UC', 'Lower Chitral_04': '4|LC', 'Gupis-Yasin_05': '5|GY', 'Ishkoman-Puniyal_06': '6|IP', Hunza_07: '7|HZ', Gilgit_08: '8|GL' };
const PREV = { Nursery: 'Ibtida', 'KG I': 'Nursery', 'KG II': 'KG I' };
const QL = ['Q1', 'Q2', 'Q3', 'Q4'];
const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const fmt = (n) => Math.round(n).toLocaleString();
const lost = (n) => '−' + Math.abs(Math.round(n)).toLocaleString();
const lostPct = (p) => '−' + Math.abs(p).toFixed(1) + '%';
const regionName = (r) => r.replace(/_\d+$/, '');

export function buildPrevious(records, threshold) {
  const out = [];
  records.forEach((r) => {
    if (!PREV[r.className]) return;
    const base = num(r.enrollment2025), q4 = num(r.q4);
    if (base === null || base <= 0 || q4 === null) return;
    const drop = base - q4, pct = (q4 - base) / base * 100;
    const zero = q4 === 0;
    if (!zero && pct > -threshold) return;
    out.push({ key: ['variance', r.recCode, r.classCode, 'previous-class-baseline'].join('::'), r, zero, prev: base, cur: q4, drop, pct, line: `${PREV[r.className]} 2025: ${fmt(base)} → Q4: ${fmt(q4)}`, chips: zero ? ['No children enrolled in Q4'] : [] });
  });
  return out;
}

export function buildQuarter(records, threshold) {
  const out = [];
  records.forEach((r) => {
    const q = ['q1', 'q2', 'q3', 'q4'].map((f) => num(r[f]));
    const cands = [];
    const peakBefore = Math.max(...q.slice(0, 3).map((v) => v ?? 0));
    const zero = q[3] === 0 && peakBefore > 0;
    if (zero) cands.push({ type: 'zero-q4', zero: true, prev: peakBefore, cur: 0, drop: peakBefore, pct: -100, text: `Peak ${fmt(peakBefore)} → Q4 0` });
    for (let i = 1; i < 4; i++) {
      if (q[i - 1] === null || q[i] === null || q[i - 1] <= 0) continue;
      const pct = (q[i] - q[i - 1]) / q[i - 1] * 100;
      if (pct <= -threshold) cands.push({ type: 'quarter-' + QL[i].toLowerCase(), prev: q[i - 1], cur: q[i], drop: q[i - 1] - q[i], pct, text: `${QL[i - 1]} ${fmt(q[i - 1])} → ${QL[i]} ${fmt(q[i])}` });
    }
    const valid = q.map((value, index) => ({ value, index })).filter((x) => x.value !== null);
    if (valid.length > 1) {
      const peak = valid.reduce((b, x) => (x.value > b.value ? x : b));
      valid.filter((x) => x.index > peak.index).forEach((x) => {
        if (zero && x.value === 0) return;
        const pct = peak.value > 0 ? (x.value - peak.value) / peak.value * 100 : null;
        if (pct !== null && pct <= -threshold) cands.push({ type: 'peak-' + QL[x.index].toLowerCase(), prev: peak.value, cur: x.value, drop: peak.value - x.value, pct, text: `Peak ${QL[peak.index]} ${fmt(peak.value)} → ${QL[x.index]} ${fmt(x.value)}` });
      });
    }
    if (!cands.length) return;
    const primary = zero ? cands[0] : [...cands].sort((a, b) => b.drop - a.drop || a.pct - b.pct)[0];
    const chips = cands.filter((c) => c !== primary && !(c.prev === primary.prev && c.cur === primary.cur)).slice(0, 3).map((c) => c.text + ` (${lostPct(c.pct)})`);
    let consecutive = false;
    for (let i = 2; i < 4; i++) if (q[i - 2] !== null && q[i - 1] !== null && q[i] !== null && q[i - 1] < q[i - 2] && q[i] < q[i - 1]) consecutive = true;
    if (consecutive) chips.push('Two consecutive declines');
    if (zero) chips.unshift('No children enrolled in Q4');
    out.push({ key: ['variance', r.recCode, r.classCode, primary.type].join('::'), r, zero: Boolean(zero), prev: primary.prev, cur: primary.cur, drop: primary.drop, pct: primary.pct, line: primary.text, chips });
  });
  return out;
}

export default function RedFlagsView({ records }) {
  const [view, setView] = useState('previous');
  const [region, setRegion] = useState('');
  const [group, setGroup] = useState('');
  const [threshold, setThreshold] = useState(20);
  const [topN, setTopN] = useState(10);
  const [reasons, setReasons] = useState(() => { try { const saved = JSON.parse(window.localStorage.getItem('ecd-resource-hub.red-flag-reasons') || '{}'); return saved && typeof saved === 'object' ? saved : {}; } catch { return {}; } });
  const [editingReason, setEditingReason] = useState('');
  const [reasonDraft, setReasonDraft] = useState({ name: '', designation: '', reason: '' });
  const [rank, setRank] = useState('count');
  const [open, setOpen] = useState({});

  function saveReason(key) {
    const next = { ...reasons, [key]: { ...reasonDraft, updatedAt: new Date().toISOString() } };
    setReasons(next);
    window.localStorage.setItem('ecd-resource-hub.red-flag-reasons', JSON.stringify(next));
    setEditingReason('');
  }

  function editReason(key) {
    const existing = reasons[key] || {};
    setReasonDraft({ name: existing.name || '', designation: existing.designation || '', reason: existing.reason || '' });
    setEditingReason(key);
  }

  const scoped = useMemo(() => records.filter((r) => (!region || r.region === region) && classMatches(group, r.className)), [records, region, group]);
  const prevEntries = useMemo(() => buildPrevious(scoped, threshold), [scoped, threshold]);
  const quarterEntries = useMemo(() => buildQuarter(scoped, threshold), [scoped, threshold]);
  const entries = view === 'previous' ? prevEntries : quarterEntries;

  const regions = useMemo(() => {
    const present = [...new Set(records.map((r) => r.region))];
    return [...REGION_ORDER.filter((x) => present.includes(x)), ...present.filter((x) => !REGION_ORDER.includes(x)).sort()];
  }, [records]);

  const sorted = useMemo(() => [...entries].sort((a, b) => Number(b.zero) - Number(a.zero) || (rank === 'pct' ? a.pct - b.pct : b.drop - a.drop) || a.pct - b.pct), [entries, rank]);
  const byRegion = useMemo(() => {
    const m = {};
    sorted.forEach((e) => { (m[e.r.region] = m[e.r.region] || []).push(e); });
    return m;
  }, [sorted]);

  const shownRegions = region ? [region] : regions;
  const totalLost = entries.reduce((a, e) => a + e.drop, 0);
  const critical = entries.filter((e) => e.zero).length;
  const recsAffected = new Set(entries.map((e) => e.r.recCode)).size;
  const worst = regions.map((rg) => [rg, (byRegion[rg] || []).reduce((a, e) => a + e.drop, 0)]).sort((a, b) => b[1] - a[1])[0];
  const noPrev = view === 'previous' && group === 'Ibtida';

  return <div className="rf">
    <div className="rf-views" role="group" aria-label="Red flag view">
      <button type="button" className={view === 'previous' ? 'active' : ''} onClick={() => setView('previous')}><b>Previous class gaps</b><span>{prevEntries.length.toLocaleString()} RECs flagged</span></button>
      <button type="button" className={view === 'quarter' ? 'active' : ''} onClick={() => setView('quarter')}><b>Quarter gaps</b><span>{quarterEntries.length.toLocaleString()} RECs flagged</span></button>
    </div>
    <p className="rf-intro">{view === 'previous'
      ? 'Children missing compared with the previous class. Q4 enrolment is compared with last year’s enrolment in the preceding class: Nursery vs Ibtida, KG I vs Nursery, KG II vs KG I.'
      : 'Children lost between quarters. Each REC is shown with its biggest drop, either from one quarter to the next or from its quarterly peak down to a later quarter.'} Flagged when the decline is {threshold}% or more, or when Q4 is zero.</p>

    <div className="rf-filters">
      <label>Region<select value={region} onChange={(e) => setRegion(e.target.value)}><option value="">All regions</option>{regions.map((v) => <option key={v} value={v}>{SHORT[v] ? SHORT[v] + ' · ' : ''}{regionName(v)}</option>)}</select></label>
      <label>Class / group<select value={group} onChange={(e) => setGroup(e.target.value)}><option value="">All classes and groups</option>{CLASS_GROUPS.map((g) => <option key={g.label}>{g.label}</option>)}</select></label>
      <label>Flag at<select value={threshold} onChange={(e) => setThreshold(Number(e.target.value))}>{[10, 20, 30, 50].map((v) => <option key={v} value={v}>{v}% decline</option>)}</select></label>
      <label>Rank by<select value={rank} onChange={(e) => setRank(e.target.value)}><option value="count">Children lost</option><option value="pct">Percentage decline</option></select></label>
      <label>Display per region<select value={topN} onChange={(e) => setTopN(Number(e.target.value))}>{[10, 20, 50].map((v) => <option key={v} value={v}>Top {v} RECs</option>)}</select></label>
    </div>

    <div className="rf-kpis">
      <div><small>RECs flagged</small><b>{recsAffected.toLocaleString()}</b><span>{entries.length.toLocaleString()} REC and class records</span></div>
      <div><small>Zero in Q4</small><b className={critical ? 'ra-neg' : ''}>{critical.toLocaleString()}</b><span>critical records</span></div>
      <div><small>{view === 'previous' ? 'Children below previous class' : 'Children lost'}</small><b className="ra-neg">{lost(totalLost)}</b><span>across flagged records</span></div>
      <div><small>Most affected region</small><b>{worst && worst[1] > 0 ? SHORT[worst[0]] || regionName(worst[0]) : '—'}</b><span>{worst && worst[1] > 0 ? lost(worst[1]) + ' children' : 'no flags'}</span></div>
    </div>

    {noPrev && <p className="rf-empty">Ibtida has no previous class, so there are no previous class gaps for it. Choose another class or group.</p>}

    <div className={'rf-regions' + (shownRegions.length === 1 ? ' is-single' : '')}>
      {shownRegions.map((rg) => {
        const list = byRegion[rg] || [];
        const expanded = open[view + rg];
        const items = expanded ? list : list.slice(0, topN);
        const regionLost = list.reduce((a, e) => a + e.drop, 0);
        const crit = list.filter((e) => e.zero).length;
        return <section key={rg} className="rf-panel">
          <header>
            <div><span className="rf-code">{SHORT[rg] || rg}</span><b>{regionName(rg)}</b></div>
            <div className="rf-panel-stats"><span><b>{list.length}</b> flagged</span>{crit > 0 && <span className="ra-neg"><b>{crit}</b> zero Q4</span>}<span className="ra-neg"><b>{lost(regionLost)}</b> children</span></div>
          </header>
          {items.length === 0 && <p className="rf-none">No red flags in this region at {threshold}%.</p>}
          <ol>{items.map((e, i) => {
            const reasonKey = [view, e.r.recCode, e.r.classCode || e.r.className].join('::');
            const savedReason = reasons[reasonKey];
            const kept = e.prev > 0 ? Math.max(0, Math.min(100, (e.cur / e.prev) * 100)) : 0;
            return <li key={e.key} className={e.zero ? 'is-critical' : ''}>
              <span className="rf-rank">{i + 1}</span>
              <div className="rf-main">
                <div className="rf-title"><b>{e.r.recName}</b><span className="ra-class">{e.r.className}</span>{e.zero && <span className="ra-badge is-zero">Zero Q4</span>}</div>
                <small>{e.r.localBoard}</small>
                <div className="rf-line">{e.line}</div>
                <span className="rf-bar" title={`${fmt(e.cur)} of ${fmt(e.prev)} remain`}><span className="rf-bar-keep" style={{ width: kept + '%' }} /></span>
                {e.chips.length > 0 && <div className="rf-chips">{e.chips.map((c, k) => <span key={k}>{c}</span>)}</div>}
              </div>
              <div className="rf-gap"><b>{lost(e.drop)}</b><span>{lostPct(e.pct)}</span></div>
              <div className="rf-reason-area">
                {savedReason ? <div className="rf-reason-saved">
                  <div className="rf-reason-heading"><span>REC follow-up reason</span><button type="button" onClick={() => editReason(reasonKey)}>Edit</button></div>
                  <p>{savedReason.reason}</p>
                  <small>Added by <b>{savedReason.name}</b> · {savedReason.designation}</small>
                </div> : <button type="button" className="rf-add-reason" onClick={() => editReason(reasonKey)}>＋ Add reason and responsible person</button>}
                {editingReason === reasonKey && <div className="rf-reason-editor">
                  <label>Reason / context<textarea rows="2" value={reasonDraft.reason} onChange={(event) => setReasonDraft((draft) => ({ ...draft, reason: event.target.value }))} placeholder="Explain the likely reason for this enrolment gap and any context…" /></label>
                  <div className="rf-reason-person">
                    <label>Name<input value={reasonDraft.name} onChange={(event) => setReasonDraft((draft) => ({ ...draft, name: event.target.value }))} placeholder="Name of person adding the reason" /></label>
                    <label>Designation<input value={reasonDraft.designation} onChange={(event) => setReasonDraft((draft) => ({ ...draft, designation: event.target.value }))} placeholder="e.g. REC In-charge, LB Coordinator" /></label>
                  </div>
                  <div className="rf-reason-actions"><button type="button" onClick={() => setEditingReason('')}>Cancel</button><button type="button" disabled={!reasonDraft.reason.trim() || !reasonDraft.name.trim() || !reasonDraft.designation.trim()} onClick={() => saveReason(reasonKey)}>Save reason</button></div>
                </div>}
              </div>
            </li>;
          })}</ol>
          {list.length > topN && <button type="button" className="rf-more" onClick={() => setOpen((o) => ({ ...o, [view + rg]: !expanded }))}>{expanded ? 'Show top ' + topN + ' only' : 'Show all ' + list.length}</button>}
        </section>;
      })}
    </div>
    <p className="ra-foot">Green in each bar is the share of children still enrolled; the grey remainder is the gap. Reasons are saved in this browser and displayed with the name and designation entered by the contributor.</p>
  </div>;
}
