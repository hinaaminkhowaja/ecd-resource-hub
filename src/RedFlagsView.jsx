import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { FileSpreadsheet, Printer } from 'lucide-react';
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

export default function RedFlagsView({ records, user }) {
  const [view, setView] = useState('previous');
  const [region, setRegion] = useState('');
  const [localBoard, setLocalBoard] = useState('');
  const [group, setGroup] = useState('');
  const [threshold, setThreshold] = useState(20);
  const [reasons, setReasons] = useState({});
  const [reasonDrafts, setReasonDrafts] = useState({});
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/red-flags').then((response) => response.ok ? response.json() : null)
      .then((data) => { if (active && data?.reasons) setReasons(data.reasons); })
      .catch(() => { if (active) setSaveMessage('Local data service is not running. Start the app with npm run dev.'); });
    return () => { active = false; };
  }, []);

  function updateReasonDraft(key, field, value) {
    setReasonDrafts((current) => ({
      ...current,
      [key]: { ...(current[key] || {}), [field]: value }
    }));
  }

  async function saveReason(key, rec, classes) {
    const draft = { ...(reasons[key] || {}), ...(reasonDrafts[key] || {}), region:rec.region, recName:rec.recName, recCode:rec.recCode, localBoard:rec.localBoard || '', classes, view, name:(reasonDrafts[key] || {}).name || (reasons[key] || {}).name || '', designation:(reasonDrafts[key] || {}).designation || (reasons[key] || {}).designation || '' };
    setSaveMessage('Saving…');
    try {
      const response = await fetch('/api/red-flags', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, reason: draft }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save the reason.');
      setReasons((current) => ({ ...current, [key]: result.reason }));
      setReasonDrafts((current) => { const next = { ...current }; delete next[key]; return next; });
      setSaveMessage('Reason saved successfully. It is now visible below and available in the downloads.');
    } catch (error) { setSaveMessage(error.message || 'Could not save the reason.'); }
  }

  const localBoardsForFilter = useMemo(() => [...new Set(records.filter((r) => !region || r.region === region).map((r) => r.localBoard || 'Unassigned'))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })), [records, region]);
  const scoped = useMemo(() => records.filter((r) => (!region || r.region === region) && (!localBoard || (r.localBoard || 'Unassigned') === localBoard) && classMatches(group, r.className)), [records, region, localBoard, group]);
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
      grouped[key] = Object.values(grouped[key]).sort((a, b) => String(a.localBoard || '').localeCompare(String(b.localBoard || ''), undefined, { numeric: true, sensitivity: 'base' }) || String(a.recCode || a.recName || '').localeCompare(String(b.recCode || b.recName || ''), undefined, { numeric: true, sensitivity: 'base' }));
    });
    return grouped;
  }, [entries]);
  const byRegion = groupedByRegion;
  const shownRegions = (region ? [region] : regions).filter((rg) => (byRegion[rg] || []).length > 0);
  const totalLost = entries.reduce((a, e) => a + e.drop, 0);
  const critical = entries.filter((e) => e.zero).length;
  const recsAffected = Object.values(byRegion).reduce((sum, recs) => sum + recs.length, 0);
  const worst = regions.map((rg) => [rg, (byRegion[rg] || []).reduce((a, rec) => a + rec.totalDrop, 0)]).sort((a, b) => b[1] - a[1])[0];
  const noPrev = view === 'previous' && group === 'Ibtida';
  const reasonRows = Object.entries(reasons).map(([key, value]) => ({ key, ...value, view: value.view || key.split('::')[0] })).sort((a,b)=>String(a.region||'').localeCompare(String(b.region||'')) || String(a.recName||'').localeCompare(String(b.recName||'')));
  function downloadReasonsExcel() {
    const rows = reasonRows.map((item) => ({ Region:item.region||'', 'Local Board':item.localBoard||'', REC:item.recName||item.recCode||'', 'REC Code':item.recCode||'', 'Assessment View':item.view==='previous'?'Previous class gaps':'Quarter gaps', Classes:Array.isArray(item.classes)?item.classes.join(', '):'', Reason:item.reason||'', 'Added by':item.name||'', Designation:item.designation||'', 'User email':item.submittedBy||'', 'Last updated':item.updatedAt?new Date(item.updatedAt).toLocaleString():'' }));
    const sheet=XLSX.utils.json_to_sheet(rows.length?rows:[{Message:'No reasons have been saved yet.'}]);
    sheet['!cols']=[{wch:22},{wch:26},{wch:32},{wch:12},{wch:22},{wch:24},{wch:60},{wch:24},{wch:24},{wch:32},{wch:22}];
    const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,sheet,'REC Reasons');
    XLSX.writeFile(book,'ECED_Enrolment_Red_Flag_Reasons.xlsx');
  }

  return <div className="rf">
    <div className="rf-downloads"><div><b>Saved reasons: {reasonRows.length}</b><span>{user?.role === 'ADMIN' ? 'All regions' : user?.region?.replace(/_\d+$/,'')}</span></div><button type="button" onClick={downloadReasonsExcel}><FileSpreadsheet size={16}/>Download Excel</button><button type="button" onClick={()=>window.print()}><Printer size={16}/>Download PDF</button></div>
    <div className="rf-views" role="group" aria-label="Red flag view">
      <button type="button" className={view === 'previous' ? 'active' : ''} onClick={() => setView('previous')}><b>Previous class gaps</b><span>{prevEntries.length.toLocaleString()} RECs flagged</span></button>
      <button type="button" className={view === 'quarter' ? 'active' : ''} onClick={() => setView('quarter')}><b>Quarter gaps</b><span>{quarterEntries.length.toLocaleString()} RECs flagged</span></button>
    </div>
    <p className="rf-intro">{view === 'previous'
      ? 'Children missing compared with the previous class. Q4 enrolment is compared with last year’s enrolment in the preceding class: Nursery vs Ibtida, KG I vs Nursery, KG II vs KG I.'
      : 'Children lost between quarters. Each REC is shown with its biggest drop, either from one quarter to the next or from its quarterly peak down to a later quarter.'} Flagged when the decline is {threshold}% or more, or when Q4 is zero. Differences of fewer than 7 children are excluded.</p>

    <div className="rf-filters">
      <label>Region<select value={region} onChange={(e) => { setRegion(e.target.value); setLocalBoard(''); }}><option value="">All regions</option>{regions.map((v) => <option key={v} value={v}>{SHORT[v] ? SHORT[v] + ' · ' : ''}{regionName(v)}</option>)}</select></label>
      <label>Local Board<select value={localBoard} onChange={(e) => setLocalBoard(e.target.value)}><option value="">All local boards</option>{localBoardsForFilter.map((v) => <option key={v} value={v}>{v === 'Unassigned' ? 'Local Board not specified' : v}</option>)}</select></label>
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
        const regionTone = Math.max(0, REGION_ORDER.indexOf(rg));
        const localBoards = [...new Set(items.map((rec) => rec.localBoard || 'Unassigned'))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
        const boardGroups = localBoards.map((board) => ({ board, recs: items.filter((rec) => (rec.localBoard || 'Unassigned') === board) }));
        return <section key={rg} className={`rf-panel rf-region-${regionTone}`}>
          <header>
            <div><span className="rf-code">{SHORT[rg] || rg}</span><b>{regionName(rg)}</b></div>
            <div className="rf-panel-stats"><span><b>{list.length}</b> RECs flagged</span>{crit > 0 && <span className="ra-neg"><b>{crit}</b> zero Q4</span>}<span className="ra-neg"><b>{lost(regionLost)}</b> children</span></div>
          </header>
          <div className="rf-local-board-groups">{boardGroups.map(({ board, recs: boardRecs }, boardIndex) => <section className={`rf-local-board-group rf-lb-group-${boardIndex % 8}`} key={board}>
            <div className="rf-local-board-heading"><b>{board === 'Unassigned' ? 'Local Board not specified' : board}</b><span>{boardRecs.length} {boardRecs.length === 1 ? 'REC' : 'RECs'}</span></div>
            <ol>{boardRecs.map((rec) => {
            const i = items.indexOf(rec);
            const reasonKey = [view, rec.recCode, 'REC'].join('::');
            const savedReason = reasons[reasonKey];
            const previousClassReasons = rec.variances.map((e) => ({ className: e.r.className, detail: reasons[[view, e.r.recCode, e.r.classCode || e.r.className].join('::')] })).filter((item) => item.detail);
            return <li key={rec.recCode} className={rec.zero ? 'is-critical' : ''}>
              <span className="rf-rank">{i + 1}</span>
              <div className="rf-main">
                <div className="rf-title"><b>{rec.recName}</b>{rec.zero && <span className="ra-badge is-zero">Zero Q4</span>}</div>
                <small className={`rf-local-board rf-lb-${Math.max(0, localBoards.indexOf(rec.localBoard || 'Unassigned')) % 8}`}>{rec.localBoard || 'Local board not specified'}</small>
                <div className="rf-variance-list">
                  {rec.variances.map((e) => {
                    const kept = e.prev > 0 ? Math.max(0, Math.min(100, (e.cur / e.prev) * 100)) : 0;
                    return <div className="rf-class-variance" key={e.key}>
                      <div className="rf-class-heading"><strong className="rf-class-name">{e.r.className}</strong><span className="rf-variance-line">{e.line}</span></div>
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
                  <div className="rf-reason-actions"><button type="button" disabled={!((reasonDrafts[reasonKey] || savedReason || {}).reason || '').trim() || !((reasonDrafts[reasonKey] || savedReason || {}).name || '').trim() || !((reasonDrafts[reasonKey] || savedReason || {}).designation || '').trim()} onClick={() => saveReason(reasonKey, rec, rec.variances.map((entry) => entry.r.className))}>{savedReason ? 'Save updated reason' : 'Save reason'}</button></div>
                </div>
              </div>
            </li>;
          })}</ol>
          </section>)}</div>
        </section>;
      })}
    </div>
    <p className="ra-foot">RECs are ranked by their highest percentage decline (most severe first). All flagged class variances for a REC are grouped together; add one shared reason and contributor details beneath the REC. Reasons are saved in the Codespace project data folder.</p>
    {saveMessage && <p className="ra-foot" role="status">{saveMessage}</p>}
    <section className="rf-print-report"><h1>ECED Resource Hub — Enrolment Red-Flag Reasons</h1><p>Saved reasons for {user?.role === 'ADMIN' ? 'all regions' : (user?.region || 'assigned region')}</p><table><thead><tr><th>Region</th><th>Local Board</th><th>REC</th><th>View</th><th>Class(es)</th><th>Reason</th><th>Name</th><th>Designation</th><th>Updated</th></tr></thead><tbody>{reasonRows.map((item)=><tr key={item.key}><td>{item.region||''}</td><td>{item.localBoard||''}</td><td>{item.recName||item.recCode||''}</td><td>{item.view==='previous'?'Previous class gaps':'Quarter gaps'}</td><td>{Array.isArray(item.classes)?item.classes.join(', '):''}</td><td>{item.reason||''}</td><td>{item.name||''}</td><td>{item.designation||''}</td><td>{item.updatedAt?new Date(item.updatedAt).toLocaleString():''}</td></tr>)}</tbody></table></section>
  </div>;
}
