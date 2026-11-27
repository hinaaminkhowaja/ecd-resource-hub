import React, { useMemo, useState } from 'react';
import { CLASS_GROUPS, classMatches } from './RecAnalysisViews.jsx';
import './red-flags.css';

const REGION_ORDER = ['Southern_01', 'Central_02', 'Upper Chitral_03', 'Lower Chitral_04', 'Gupis-Yasin_05', 'Ishkoman-Puniyal_06', 'Hunza_07', 'Gilgit_08'];
const SHORT = { Southern_01: '1|SO', Central_02: '2|CE', 'Upper Chitral_03': '3|UC', 'Lower Chitral_04': '4|LC', 'Gupis-Yasin_05': '5|GY', 'Ishkoman-Puniyal_06': '6|IP', Hunza_07: '7|HZ', Gilgit_08: '8|GL' };
const PREV = { Nursery: 'Ibtida', 'KG I': 'Nursery', 'KG II': 'KG I' };
const QL = ['Q1', 'Q2', 'Q3', 'Q4'];
const MIN_GAP = 7; // Ignore differences of 1–6 children.
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
    if (drop < MIN_GAP || (!zero && pct > -threshold)) return;
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
    if (primary.drop < MIN_GAP) return;
    out.push({ key: ['variance', r.recCode, r.classCode, primary.type].join('::'), r, zero: Boolean(zero), prev: primary.prev, cur: primary.cur, drop: primary.drop, pct: primary.pct, line: primary.text, chips });
  });
  return out;
}

export default function RedFlagsView({ records }) {
  const [view, setView] = useState('previous');
  const [region, setRegion] = useState('');
  const [group, setGroup] = useState('');
  const [threshold, setThreshold] = useState(20);
  const [reasons, setReasons] = useState(() => { try { const saved = JSON.parse(window.localStorage.getItem('ecd-resource-hub.red-flag-reasons') || '{}'); return saved && typeof saved === 'object' ? saved : {}; } catch { return {}; } });
  const [reasonDrafts, setReasonDrafts] = useState({});
  const [open, setOpen] = useState({});

  function updateReasonDraft(key, field, value) {
    setReasonDrafts((current) => ({
      ...current,
      [key]: { ...(current[key] || {}), [field]: value }
    }));
  }

  function saveReason(key) {
    const draft = reasonDrafts[key] || {};
    const next = { ...reasons, [key]: { ...(reasons[key] || {}), ...draft, updatedAt: new Date().toISOString() } };
    setReasons(next);
    window.localStorage.setItem('ecd-resource-hub.red-flag-reasons', JSON.stringify(next));
  }

  const scoped = useMemo(() => records.filter((r) => (!region || r.region === region) && classMatches(group, r.className)), [records, region, group]);
  const prevEntries = useMemo(() => buildPrevious(scoped, threshold), [scoped, threshold]);
  const quarterEntries = useMemo(() => buildQuarter(scoped, threshold), [scoped, threshold]);
  const entries = view === 'previous' ? prevEntries : quarterEntries;

  const regions = useMemo(() => {
    const present = [...new Set(records.map((r) => r.region))];
    return [...REGION_ORDER.filter((x) => present.includes(x)), ...present.filter((x) => !REGION_ORDER.includes(x)).sort()];
  }, [records]);

  const groupedByRegion = useMemo(() => {
    const grouped = {};
    [...entries].sort((a, b) => a.pct - b.pct || b.drop - a.drop).forEach((e) => {
      const regionKey = e.r.region;
      const recKey = String(e.r.recCode || e.r.recName || 'unknown');
      grouped[regionKey] ||= {};
      grouped[regionKey][recKey] ||= { recCode: recKey, recName: e.r.recName, localBoard: e.r.localBoard, variances: [], worstPct: e.pct, totalDrop: 0, zero: false };
      const rec = grouped[regionKey][recKey];
      rec.variances.push(e);
      rec.worstPct = Math.min(rec.worstPct, e.pct);
      rec.totalDrop += e.drop;
      rec.zero = rec.zero || e.zero;
    });
    Object.keys(grouped).forEach((key) => {
      grouped[key] = Object.values(grouped[key]).sort((a, b) => a.worstPct - b.worstPct || b.totalDrop - a.totalDrop);
    });
    return grouped;
  }, [entries]);
  const byRegion = groupedByRegion;
  const shownRegions = region ? [region] : regions;
  const totalLost = entries.reduce((a, e) => a + e.drop, 0);
  const critical = entries.filter((e) => e.zero).length;
  const recsAffected = Object.values(byRegion).reduce((sum, recs) => sum + recs.length, 0);
  const worst = regions.map((rg) => [rg, (byRegion[rg] || []).reduce((a, rec) => a + rec.totalDrop, 0)]).sort((a, b) => b[1] - a[1])[0];
  const noPrev = view === 'previous' && group === 'Ibtida';

  return <div className="rf">
    <div className="rf-views" role="group" aria-label="Red flag view">
      <button type="button" className={view === 'previous' ? 'active' : ''} onClick={() => setView('previous')}><b>Previous class gaps</b><span>{prevEntries.length.toLocaleString()} RECs flagged</span></button>
      <button type="button" className={view === 'quarter' ? 'active' : ''} onClick={() => setView('quarter')}><b>Quarter gaps</b><span>{quarterEntries.length.toLocaleString()} RECs flagged</span></button>
    </div>
    <p className="rf-intro">{view === 'previous'
      ? 'Children missing compared with the previous class. Q4 enrolment is compared with last year’s enrolment in the preceding class: Nursery vs Ibtida, KG I vs Nursery, KG II vs KG I.'
      : 'Children lost between quarters. Each REC is shown with its biggest drop, either from one quarter to the next or from its quarterly peak down to a later quarter.'} Flagged when the decline is {threshold}% or more, or when Q4 is zero. Differences of fewer than 7 children are excluded.</p>

    <div className="rf-filters">
      <label>Region<select value={region} onChange={(e) => setRegion(e.target.value)}><option value="">All regions</option>{regions.map((v) => <option key={v} value={v}>{SHORT[v] ? SHORT[v] + ' · ' : ''}{regionName(v)}</option>)}</select></label>
      <label>Class / group<select value={group} onChange={(e) => setGroup(e.target.value)}><option value="">All classes and groups</option>{CLASS_GROUPS.map((g) => <option key={g.label}>{g.label}</option>)}</select></label>
      <label>Flag at<select value={threshold} onChange={(e) => setThreshold(Number(e.target.value))}>{[10, 20, 30, 50].map((v) => <option key={v} value={v}>{v}% decline</option>)}</select></label>
      <div className="rf-fixed-top"><b>Top 10 RECs per region</b><span>Only gaps of 7 or more children are included.</span></div>
    </div>

    <div className="rf-kpis">
      <div><small>RECs flagged</small><b>{recsAffected.toLocaleString()}</b><span>{entries.length.toLocaleString()} class variances</span></div>
      <div><small>Zero in Q4</small><b className={critical ? 'ra-neg' : ''}>{critical.toLocaleString()}</b><span>critical records</span></div>
      <div><small>{view === 'previous' ? 'Children below previous class' : 'Children lost'}</small><b className="ra-neg">{lost(totalLost)}</b><span>across flagged records</span></div>
      <div><small>Most affected region</small><b>{worst && worst[1] > 0 ? SHORT[worst[0]] || regionName(worst[0]) : '—'}</b><span>{worst && worst[1] > 0 ? lost(worst[1]) + ' children' : 'no flags'}</span></div>
    </div>

    {noPrev && <p className="rf-empty">Ibtida has no previous class, so there are no previous class gaps for it. Choose another class or group.</p>}

    <div className={'rf-regions' + (shownRegions.length === 1 ? ' is-single' : '')}>
      {shownRegions.map((rg) => {
        const list = byRegion[rg] || [];
        const items = list.slice(0, 10);
        const regionLost = list.reduce((a, rec) => a + rec.totalDrop, 0);
        const crit = list.filter((rec) => rec.zero).length;
        return <section key={rg} className="rf-panel">
          <header>
            <div><span className="rf-code">{SHORT[rg] || rg}</span><b>{regionName(rg)}</b></div>
            <div className="rf-panel-stats"><span><b>{list.length}</b> RECs flagged</span>{crit > 0 && <span className="ra-neg"><b>{crit}</b> zero Q4</span>}<span className="ra-neg"><b>{lost(regionLost)}</b> children</span></div>
          </header>
          {items.length === 0 && <p className="rf-none">No red flags in this region at {threshold}%.</p>}
          <ol>{items.map((rec, i) => {
            const reasonKey = [view, rec.recCode, 'REC'].join('::');
            const savedReason = reasons[reasonKey];
            const previousClassReasons = rec.variances.map((e) => ({ className: e.r.className, detail: reasons[[view, e.r.recCode, e.r.classCode || e.r.className].join('::')] })).filter((item) => item.detail);
            return <li key={rec.recCode} className={rec.zero ? 'is-critical' : ''}>
              <span className="rf-rank">{i + 1}</span>
              <div className="rf-main">
                <div className="rf-title"><b>{rec.recName}</b>{rec.zero && <span className="ra-badge is-zero">Zero Q4</span>}</div>
                <small>{rec.localBoard}</small>
                <div className="rf-variance-list">
                  {rec.variances.map((e) => {
                    const kept = e.prev > 0 ? Math.max(0, Math.min(100, (e.cur / e.prev) * 100)) : 0;
                    return <div className="rf-class-variance" key={e.key}>
                      <div className="rf-class-heading"><b>{e.r.className}</b><span className="rf-variance-line">{e.line}</span></div>
                      <div className="rf-class-metrics"><strong>{lost(e.drop)}</strong><b>{lostPct(e.pct)}</b></div>
                      <span className="rf-bar" title={fmt(e.cur) + ' of ' + fmt(e.prev) + ' remain'}><span className="rf-bar-keep" style={{ width: kept + '%' }} /></span>
                      {e.chips.length > 0 && <div className="rf-chips">{e.chips.map((c, k) => <span key={k}>{c}</span>)}</div>}
                    </div>;
                  })}
                </div>
              </div>
              <div className="rf-rec-severity"><small>Worst decline</small><b>{lostPct(rec.worstPct)}</b><span>{lost(rec.totalDrop)} children across classes</span></div>
              <div className="rf-reason-area">
                {previousClassReasons.map((item) => <div className="rf-reason-saved rf-legacy-reason" key={item.className}><div className="rf-reason-heading"><span>Existing reason · {item.className}</span></div><p>{item.detail.reason}</p><small>Added by <b>{item.detail.name}</b> · {item.detail.designation}</small></div>)}
                {savedReason && <div className="rf-reason-saved">
                  <div className="rf-reason-heading"><span>REC reason / context</span><span>Recorded</span></div>
                  <p>{savedReason.reason}</p>
                  <small>Added by <b>{savedReason.name}</b> · {savedReason.designation}</small>
                </div>}
                <div className="rf-reason-editor">
                  <div className="rf-reason-editor-heading"><b>{savedReason ? 'Update REC reason / context' : 'Add reason for this REC'}</b><span>Always visible</span></div>
                  <label>Reason / context<textarea rows="2" value={(reasonDrafts[reasonKey] || savedReason || {}).reason || ''} onChange={(event) => updateReasonDraft(reasonKey, 'reason', event.target.value)} placeholder="Explain the likely reason for the enrolment gaps across the classes…" /></label>
                  <div className="rf-reason-person">
                    <label>Name<input value={(reasonDrafts[reasonKey] || savedReason || {}).name || ''} onChange={(event) => updateReasonDraft(reasonKey, 'name', event.target.value)} placeholder="Name of person adding the reason" /></label>
                    <label>Designation<input value={(reasonDrafts[reasonKey] || savedReason || {}).designation || ''} onChange={(event) => updateReasonDraft(reasonKey, 'designation', event.target.value)} placeholder="e.g. REC In-charge, LB Coordinator" /></label>
                  </div>
                  <div className="rf-reason-actions"><button type="button" disabled={!((reasonDrafts[reasonKey] || savedReason || {}).reason || '').trim() || !((reasonDrafts[reasonKey] || savedReason || {}).name || '').trim() || !((reasonDrafts[reasonKey] || savedReason || {}).designation || '').trim()} onClick={() => saveReason(reasonKey)}>{savedReason ? 'Save updated reason' : 'Save reason'}</button></div>
                </div>}
              </div>
            </li>;
          })}</ol>
        </section>;
      })}
    </div>
    <p className="ra-foot">RECs are ranked by their highest percentage decline (most severe first). All flagged class variances for a REC are grouped together; add one shared reason and contributor details beneath the REC. Reasons are saved in this browser.</p>
  </div>;
}
