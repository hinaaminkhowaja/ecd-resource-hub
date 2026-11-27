import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  ArrowDownToLine, BookOpen, Boxes, CalendarPlus, ChevronDown, CircleHelp,
  FileText, FolderOpen, LibraryBig, Pencil, Plus, Printer, Search,
  Settings2, Shapes, Sofa, Sparkles, Trash2, UsersRound, X,
} from 'lucide-react';
import recDirectory from './data/recs.json';
import ibtidaClassroomsEncoded from './data/ibtida-classrooms.json.gz.b64?raw';
import accessEnrollmentEncoded from './data/access-enrollment.json.gz.b64?raw';
import './management.css';
import './receipts.css';

const RESOURCE_STORAGE_KEY = 'ecd-resource-hub.resources';
const RECEIPT_STORAGE_KEY = 'ecd-resource-hub.ibtida-receipts';
const SYSTEM_RESOURCE_ID = 'ibtida-guidebook';
const receiptCategories = ['Ibtida Guidebook', 'Curriculum', 'Activity Books', 'Plans', 'Furniture', 'Resource Kits'];

const categories = [
  { name: 'All resources', icon: LibraryBig },
  { name: 'Curriculum', icon: BookOpen },
  { name: 'Activity books', icon: FileText },
  { name: 'Kits', icon: Boxes },
  { name: 'Furniture', icon: Sofa },
];

const resourceIcons = {
  Curriculum: BookOpen,
  'Activity books': FileText,
  Kits: Boxes,
  Furniture: Sofa,
};

const colors = ['mint', 'peach', 'lavender', 'yellow', 'blue', 'pink'];
const regions = [...new Set(recDirectory.map((row) => row.region))].sort();

async function loadIbtidaClassroomRecords() {
  const binary = window.atob(ibtidaClassroomsEncoded.trim());
  const compressed = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const decompressed = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
  const data = await new Response(decompressed).json();
  return Array.isArray(data.records) ? data.records : [];
}

async function loadAccessEnrollmentData() {
  const binary = window.atob(accessEnrollmentEncoded.trim());
  const compressed = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const decompressed = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(decompressed).json();
}

function displayCount(value) {
  return value === null || value === undefined ? '—' : Number(value).toLocaleString();
}
const ibtidaResource = {
  id: SYSTEM_RESOURCE_ID,
  title: 'Ibtida Guidebook',
  type: 'Curriculum',
  description: 'Create a staged dispatch and receipt record for ECD resources.',
  format: 'Receipt form',
  age: 'Distribution',
  color: 'mint',
  builtIn: true,
};

function readLocalList(key) {
  try {
    const saved = JSON.parse(window.localStorage.getItem(key) || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function localDateString() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function escapeCalendarText(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

function downloadCalendarReminder(receipt, stageNumber, label, deadline) {
  const date = deadline.replaceAll('-', '');
  const title = `${receipt.resourceName || 'ECD resource'} · ${label}`;
  const description = `Receipt ${receipt.id} is due on ${deadline}. Region: ${receipt.region || 'not specified'}. REC: ${receipt.recName || 'not specified'}. Open ECD Resource Hub to update the receipt.`;
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const reminder = escapeCalendarText(title);
  const calendar = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ECD Resource Hub//Receipt Reminders//EN', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT', `UID:${receipt.id}-stage-${stageNumber}@ecd-resource-hub`, `DTSTAMP:${stamp}`,
    `DTSTART:${date}T090000`, `DTEND:${date}T091500`, `SUMMARY:${reminder}`,
    `DESCRIPTION:${escapeCalendarText(description)}`,
    'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', `DESCRIPTION:${reminder} is due tomorrow`, 'END:VALARM',
    'BEGIN:VALARM', 'TRIGGER:-PT15M', 'ACTION:DISPLAY', `DESCRIPTION:${reminder} is due soon`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR', '',
  ].join('\r\n');
  const url = URL.createObjectURL(new Blob([calendar], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${String(receipt.id).replace(/[^a-z0-9-_]/gi, '-')}-stage-${stageNumber}-reminder.ics`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function App() {
  const [resources, setResources] = useState(() => readLocalList(RESOURCE_STORAGE_KEY));
  const [receipts, setReceipts] = useState(() => readLocalList(RECEIPT_STORAGE_KEY));
  const [requests, setRequests] = useState(() => readLocalList('ecd-resource-hub.requests'));
  const [ibtidaClassroomRecords, setIbtidaClassroomRecords] = useState([]);
  const [accessEnrollmentData, setAccessEnrollmentData] = useState(null);
  const [panel, setPanel] = useState('home');
  const [active, setActive] = useState('All resources');
  const [query, setQuery] = useState('');
  const [format, setFormat] = useState('All formats');
  const [notice, setNotice] = useState('');
  const [resourceDialogOpen, setResourceDialogOpen] = useState(false);
  const [editingResource, setEditingResource] = useState(null);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [receiptDialogInstance, setReceiptDialogInstance] = useState(0);
  const [editingReceipt, setEditingReceipt] = useState(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  const panels = [
    { id: 'classrooms', title: 'Classroom Data', description: 'View and import ECED classroom records.', icon: BookOpen },
    { id: 'access', title: 'Enrolment Management', description: 'Monitor targets, enrolment trends, access, and REC-level follow-up.', icon: UsersRound },
    { id: 'materials', title: 'Materials Bank', description: 'Browse curriculum, activity books, plans, kits, and furniture.', icon: LibraryBig },
    { id: 'requests', title: 'Request Materials', description: 'Create and track requirement tickets for needed resources.', icon: Boxes },
    { id: 'receipts', title: 'Delivery Receipts', description: 'Record dispatches and acknowledgements through all four stages.', icon: FileText },
  ];
  const currentPanel = panels.find((item) => item.id === panel);

  useEffect(() => {
    window.localStorage.setItem(RESOURCE_STORAGE_KEY, JSON.stringify(resources));
  }, [resources]);

  useEffect(() => {
    window.localStorage.setItem(RECEIPT_STORAGE_KEY, JSON.stringify(receipts));
  }, [receipts]);

  useEffect(() => {
    window.localStorage.setItem('ecd-resource-hub.requests', JSON.stringify(requests));
  }, [requests]);

  useEffect(() => {
    let active = true;
    loadIbtidaClassroomRecords().then((records) => {
      if (active) setIbtidaClassroomRecords(records);
    }).catch(() => {});
    loadAccessEnrollmentData().then((data) => {
      if (active) setAccessEnrollmentData(data);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const syncReceipts = () => fetch('/api/receipts').then((response) => response.ok ? response.json() : null).then((data) => {
      if (!active || !Array.isArray(data?.receipts) || data.receipts.length === 0) return;
      setReceipts((current) => {
        const merged = new Map(current.map((receipt) => [receipt.id, receipt]));
        data.receipts.forEach((receipt) => merged.set(receipt.id, receipt));
        return [...merged.values()].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
      });
    }).catch(() => {});
    syncReceipts();
    const timer = window.setInterval(syncReceipts, 60_000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const allResources = useMemo(() => [ibtidaResource, ...resources], [resources]);
  const filtered = useMemo(() => allResources.filter((item) => {
    const matchesCategory = active === 'All resources' || item.type === active;
    const matchesSearch = (item.title + ' ' + item.description + ' ' + item.type).toLowerCase().includes(query.toLowerCase());
    const matchesFormat = format === 'All formats' || item.format === format;
    return matchesCategory && matchesSearch && matchesFormat;
  }), [active, query, format, allResources]);

  function openAddResource() {
    setEditingResource(null);
    setResourceDialogOpen(true);
  }

  function saveResource(form) {
    if (editingResource) {
      setResources((current) => current.map((item) => item.id === editingResource.id ? { ...form, id: item.id } : item));
      setNotice('Material updated.');
    } else {
      setResources((current) => [...current, { ...form, id: crypto.randomUUID() }]);
      setNotice('Material added to the bank.');
    }
    setResourceDialogOpen(false);
    setEditingResource(null);
  }

  function deleteResource(resource) {
    if (!window.confirm('Delete "' + resource.title + '" from the materials bank?')) return;
    setResources((current) => current.filter((item) => item.id !== resource.id));
    setNotice('Material deleted.');
  }

  async function saveReceipt(form, existingId, createAnother = false) {
    const existing = receipts.find((item) => item.id === existingId);
    let receipt = {
      ...existing,
      ...form,
      id: existingId || 'IBT-' + new Date().getFullYear() + '-' + String(Date.now()).slice(-6),
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try {
      const response = await fetch('/api/receipts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ receipt }) });
      if (!response.ok) throw new Error('Receipt service unavailable');
      const result = await response.json();
      receipt = result.receipt || receipt;
    } catch {
      // Keep the receipt in the browser if the receipt service is offline.
    }
    setReceipts((current) => existingId
      ? current.map((item) => item.id === existingId ? receipt : item)
      : [receipt, ...current]);
    setReceiptDialogOpen(false);
    setEditingReceipt(null);
    if (createAnother) {
      setReceiptDialogInstance((current) => current + 1);
      setSelectedReceipt(null);
      setReceiptDialogOpen(true);
      setNotice('Receipt ' + receipt.id + ' saved. You can continue its next stage later.');
    } else if (receipt.stage === 4) setSelectedReceipt(receipt);
    else setNotice('Stage ' + receipt.stage + ' saved.');
  }

  function createRequest(form) {
    const request = {
      ...form,
      id: 'REQ-' + new Date().getFullYear() + '-' + String(Date.now()).slice(-6),
      status: 'Submitted',
      createdAt: new Date().toISOString(),
    };
    setRequests((current) => [request, ...current]);
    setNotice('Request ticket ' + request.id + ' created.');
  }

  function updateRequestStatus(requestId, status) {
    setRequests((current) => current.map((request) => request.id === requestId ? { ...request, status } : request));
  }

  return <div className="app-shell panel-app">
    <header className="panel-topbar">
      <button type="button" className="brand panel-brand" onClick={() => setPanel('home')}>
        <span className="brand-mark"><Sparkles size={20} /></span>
        <span><strong>ECED</strong><small>RESOURCE HUB</small></span>
      </button>
      {panel !== 'home' && <button type="button" className="all-panels-button" onClick={() => setPanel('home')}>All panels</button>}
    </header>

    <main className="panel-main">
      {panel === 'home' ? <>
        <section className="panel-welcome">
          <div className="eyebrow">EARLY CHILDHOOD EDUCATION</div>
          <h1>ECED Resource Hub</h1>
          <p>Choose an area to manage classroom information, materials, requests, and deliveries.</p>
        </section>
        <section className="panel-grid" aria-label="ECED work areas">
          {panels.map((item) => {
            const Icon = item.icon;
            const count = item.id === 'materials' ? allResources.length : item.id === 'requests' ? requests.length : item.id === 'receipts' ? receipts.length : null;
            return <button type="button" className={'panel-card panel-card-' + item.id} key={item.id} onClick={() => setPanel(item.id)}>
              <span className="panel-card-icon"><Icon size={23} /></span>
              <span className="panel-card-title">{item.title}</span>
              <span className="panel-card-description">{item.description}</span>
              {count !== null && <span className="panel-card-count">{count} {item.id === 'materials' ? 'materials' : item.id === 'requests' ? 'tickets' : 'receipts'}</span>}
            </button>;
          })}
        </section>
      </> : <div className="panel-workspace">
        <aside className="panel-sidebar" aria-label="ECED panels">
          <div className="panel-sidebar-label">WORK AREAS</div>
          {panels.map((item) => {
            const Icon = item.icon;
            return <button type="button" key={item.id} className={'panel-nav-link ' + (panel === item.id ? 'active' : '')} aria-current={panel === item.id ? 'page' : undefined} onClick={() => setPanel(item.id)}>
              <Icon size={17} /><span>{item.title}</span>
            </button>;
          })}
        </aside>
        <div className="panel-content"><>
        <section className="panel-page-heading">
          <button type="button" className="back-to-panels" onClick={() => setPanel('home')}>← All panels</button>
          <div className="eyebrow">ECED RESOURCE HUB</div>
          <h1>{currentPanel?.title}</h1>
          <p>{currentPanel?.description}</p>
        </section>

        {panel === 'classrooms' && <DataPanel title="Classroom Data" storageKey="ecd-resource-hub.classroom-data" showRecClassFilters sourceRecords={ibtidaClassroomRecords} accessRecords={accessEnrollmentData?.records || []} />}
        {panel === 'access' && <AccessEnrollmentPanel data={accessEnrollmentData} />}

        {panel === 'materials' && <section className="library-section panel-section">
          <div className="panel-action-row"><p>Manage the teaching and classroom materials available to RECs.</p><button className="add-resource-button" onClick={openAddResource}><Plus size={16} />Add material</button></div>
          <div className="material-category-row">{categories.map(({ name }) => <button key={name} className={'category-chip ' + (active === name ? 'selected' : '')} onClick={() => setActive(name)}>{name}</button>)}</div>
          <div className="toolbar"><label className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search materials…" /></label><label className="format-select"><span>Type</span><select value={format} onChange={(event) => setFormat(event.target.value)}><option>All formats</option><option>PDF</option><option>Guide</option><option>Inventory</option><option>Receipt form</option><option>Other</option></select><ChevronDown size={14} /></label></div>
          <div className="results-line"><span>{filtered.length} materials</span><span>REC source · {regions.length} regions · {recDirectory.length.toLocaleString()} RECs</span></div>
          {filtered.length ? <div className="resource-grid">{filtered.map((item, index) => { const Icon = resourceIcons[item.type] || Shapes; const isBuiltIn = item.id === SYSTEM_RESOURCE_ID; return <article className={'resource-card ' + (isBuiltIn ? 'guidebook-card' : '')} key={item.id}><div className={'card-art ' + (item.color || colors[index % colors.length])}><div className="resource-symbol"><Icon size={27} strokeWidth={1.5} /></div><span className="age-pill">{item.age || 'ECD'}</span></div><div className="card-body"><div className="card-type">{item.type}</div><h3>{isBuiltIn ? <button className="card-title-button" onClick={() => { setEditingReceipt(null); setReceiptDialogOpen(true); }}>{item.title}</button> : item.title}</h3><p>{item.description || 'No description added'}</p><div className="card-footer"><span><FileText size={14} />{item.format}</span>{isBuiltIn ? <button className="receipt-link" onClick={() => { setEditingReceipt(null); setReceiptDialogOpen(true); }}>Create receipt <span>→</span></button> : <div className="resource-actions"><button onClick={() => { setEditingResource(item); setResourceDialogOpen(true); }} aria-label={'Edit ' + item.title}><Pencil size={13} />Edit</button><button className="delete-action" onClick={() => deleteResource(item)} aria-label={'Delete ' + item.title}><Trash2 size={13} />Delete</button></div>}</div></div></article>; })}</div> : <div className="empty-state"><Search size={24} /><b>No materials found</b><span>Try another search or choose a different collection.</span></div>}
          <div className="source-note"><span className="source-mark"><FolderOpen size={17} /></span><span><b>RECS directory</b><small>Region, local board, and REC choices continue to use the existing recs.json source file.</small></span></div>
        </section>}

        {panel === 'requests' && <RequestPanel requests={requests} onCreate={createRequest} onStatusChange={updateRequestStatus} />}

        {panel === 'receipts' && <section className="panel-section">
          <div className="panel-action-row"><p>Create and manage four-stage receipts for resource deliveries.</p><button className="receipt-launch-button" onClick={() => { setEditingReceipt(null); setReceiptDialogOpen(true); }}><Plus size={17} />Create a delivery receipt</button></div>
          {receipts.length > 0 ? <div className="history-list panel-receipt-list">{receipts.map((receipt) => <article className="delivery-workflow-item" key={receipt.id}><button className="history-row" onClick={() => { if ((receipt.stage ?? 4) >= 4) setSelectedReceipt(receipt); else { setEditingReceipt(receipt); setReceiptDialogOpen(true); } }}><span><b>{receipt.resourceName || receipt.resourceCategory || 'ECD resource'}</b><small>{receipt.region}{receipt.localBoard ? ' · ' + receipt.localBoard : ''}{receipt.recName ? ' · ' + receipt.recName : ''}</small></span><span className="history-quantity">{(receipt.stage ?? 4) >= 4 ? (receipt.recAcknowledgement === 'not-received' ? 'Not received · follow up' : receipt.recAcknowledgement === 'received-after-deadline' ? 'Received after deadline' : 'Complete') : 'Continue · stage ' + receipt.stage + ' of 4'}</span><span className="history-id">{receipt.id}</span></button><ReceiptTimeline receipt={receipt} /></article>)}</div> : <div className="empty-state"><FileText size={24} /><b>No delivery receipts yet</b><span>Create a receipt to record dispatch and acknowledgement at each stage.</span></div>}
        </section>}
        </></div>
      </div>}

      {resourceDialogOpen && <ResourceDialog initial={editingResource} onClose={() => { setResourceDialogOpen(false); setEditingResource(null); }} onSave={saveResource} />}
      {receiptDialogOpen && <ReceiptDialog key={(editingReceipt?.id || 'new') + '-' + receiptDialogInstance} initial={editingReceipt} onClose={() => { setReceiptDialogOpen(false); setEditingReceipt(null); }} onSave={saveReceipt} />}
      {selectedReceipt && <ReceiptPreview receipt={selectedReceipt} onClose={() => setSelectedReceipt(null)} />}
      {notice && <div className="toast" role="status"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss">×</button></div>}
    </main>
  </div>;
}

function parseCsvRows(text) {
  const source = text.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const character = source[i];
    if (character === '"') {
      if (quoted && source[i + 1] === '"') { field += '"'; i += 1; }
      else quoted = !quoted;
    } else if (character === ',' && !quoted) {
      row.push(field); field = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && source[i + 1] === '\n') i += 1;
      row.push(field); field = '';
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
    } else field += character;
  }
  row.push(field);
  if (row.some((value) => value.trim())) rows.push(row);
  if (rows.length < 2) return [];
  const headers = rows.shift().map((header, index) => header.trim() || 'Column ' + (index + 1));
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ''])));
}

function findRecordField(record, candidates) {
  const wanted = new Set(candidates.map((value) => value.toLowerCase().replace(/[^a-z0-9]/g, '')));
  const key = Object.keys(record).find((name) => wanted.has(name.toLowerCase().replace(/[^a-z0-9]/g, '')));
  return key ? String(record[key] ?? '').trim() : '';
}


function openEnrollmentDatabase() {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open('ecd-resource-hub-enrolment', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('datasets');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function saveEnrollmentDataset(key, value) {
  const db = await openEnrollmentDatabase();
  await new Promise((resolve, reject) => {
    const tx = db.transaction('datasets', 'readwrite');
    tx.objectStore('datasets').put(value, key);
    tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
  });
  db.close();
}
async function loadEnrollmentDataset(key) {
  const db = await openEnrollmentDatabase();
  const value = await new Promise((resolve, reject) => {
    const request = db.transaction('datasets', 'readonly').objectStore('datasets').get(key);
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  db.close(); return value;
}
async function parseHistoricalEnrollmentWorkbook(file) {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const sheet = workbook.Sheets.Sheet1;
  if (!sheet) throw new Error('The historical workbook must contain Sheet1.');
  const rows = XLSX.utils.sheet_to_json(sheet, { range: 2, defval: '' });
  const classNames = { '01IB': 'Ibtida', '02NR': 'Nursery', '03K1': 'KG I', '04K2': 'KG II' };
  const numeric = (value) => {
    if (value === '' || value === null || value === undefined) return null;
    const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null;
  };
  return rows.filter((row) => row.RECName && row.Classes && row.Year && row.Quarter).map((row) => {
    const parts = String(row.Quarter).split('|'), recName = String(row.RECName).trim();
    return {
      region:String(row.RBName || '').trim(), localBoard:String(row.LBName || '').trim(), recName,
      recCode:recName.includes('|') ? recName.split('|')[0].trim() : recName,
      classCode:String(row.Classes).trim(), className:classNames[String(row.Classes).trim()] || String(row.Classes).trim(),
      year:String(row.Year).trim(), quarter:parts[0].trim(), quarterLabel:parts[1] || '',
      enrollment:numeric(row.ENR), adequate:numeric(row.ADQ), moderate:numeric(row.MOD),
      low:numeric(row.LOW), nonAccess:numeric(row.NON), isStep:String(row.IsSTEP || '').trim()
    };
  });
}

function buildEnrollmentVarianceFlags(records, threshold = 20) {
  const flags = [];
  const fields = ['q1', 'q2', 'q3', 'q4'];
  const labels = ['Q1', 'Q2', 'Q3', 'Q4'];
  const valid = (v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
  const add = (r, type, severity, label, previous, current, changePct, comparison) => flags.push({
    key: ['variance', r.recCode, r.classCode, type].join('::'), type, severity, label,
    previous, current, changePct, comparison, region:r.region, localBoard:r.localBoard,
    recName:r.recName, className:r.className, recCode:r.recCode, classCode:r.classCode
  });
  records.forEach((r) => {
    const q = fields.map((f) => valid(r[f]) ? Number(r[f]) : null);
    const pct = (now, before) => before > 0 ? ((now-before)/before)*100 : null;
    if (q[3] === 0) add(r,'zero-q4','critical','Zero enrolment in Q4',null,0,null,'Q4 enrolment');
    for (let i=1;i<4;i++) {
      if (q[i-1] === null || q[i] === null || q[i-1] <= 0) continue;
      const change = pct(q[i],q[i-1]);
      if (change <= -threshold) add(r,'quarter-'+labels[i].toLowerCase(),'high',labels[i]+' decline vs '+labels[i-1],q[i-1],q[i],change,labels[i]+' vs '+labels[i-1]);
    }
    let consecutive = false;
    for (let i=2;i<4;i++) if (q[i-2] !== null && q[i-1] !== null && q[i] !== null && q[i-1] < q[i-2] && q[i] < q[i-1]) consecutive = true;
    if (consecutive) add(r,'consecutive-quarter-decline','high','Two consecutive quarterly declines',null,null,null,'Consecutive quarter trend');
    const validQ = q.map((value,index)=>({value,index})).filter((x)=>x.value!==null);
    if (validQ.length > 1) {
      const peak = validQ.reduce((best,x)=>x.value>best.value?x:best);
      validQ.filter((x)=>x.index>peak.index).forEach((x)=>{
        const change=pct(x.value,peak.value);
        if (change !== null && change <= -threshold) add(r,'peak-'+labels[x.index].toLowerCase(),'high',labels[x.index]+' decline from quarterly peak',peak.value,x.value,change,labels[x.index]+' vs peak '+labels[peak.index]);
      });
    }
    const baseline = valid(r.enrollment2025) ? Number(r.enrollment2025) : null;
    if (r.className !== 'Ibtida' && q[3] !== null && baseline !== null && baseline > 0) {
      const change=pct(q[3],baseline);
      if (change <= -threshold) add(r,'previous-class-baseline','high','Decline vs previous-year preceding class',baseline,q[3],change,'Q4 current class vs ENR25 previous class');
    }
  });
  return flags;
}

function AccessEnrollmentPanel({ data }) {
  const records = data?.records || [];
  const [section, setSection] = useState('overview');
  const [historyRecords, setHistoryRecords] = useState([]);
  const [historyStatus, setHistoryStatus] = useState('Checking saved historical data…');
  const [historyYear, setHistoryYear] = useState('');
  const [historyRegion, setHistoryRegion] = useState('');
  const [historyClass, setHistoryClass] = useState('');
  const [historyLimit, setHistoryLimit] = useState(100);
  const [historySearch, setHistorySearch] = useState('');
  const regions = useMemo(() => [...new Set(records.map((record) => record.region))].sort(), [records]);
  const [region, setRegion] = useState('');
  const [localBoard, setLocalBoard] = useState('');
  const [recName, setRecName] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [summaryRegion, setSummaryRegion] = useState('');
  const [summaryClasses, setSummaryClasses] = useState(['Ibtida', 'Nursery', 'KG I', 'KG II']);
  const [query, setQuery] = useState('');
  const [visibleLimit, setVisibleLimit] = useState(100);
  const [followupRegion, setFollowupRegion] = useState('');
  const [followupGroup, setFollowupGroup] = useState('');
  const [issueVisibleLimit, setIssueVisibleLimit] = useState(60);
  const [issueSyncStatus, setIssueSyncStatus] = useState('loading');
  const [issueSyncReady, setIssueSyncReady] = useState(false);
  const [varianceRegion, setVarianceRegion] = useState('');
  const [varianceClass, setVarianceClass] = useState('');
  const [varianceVisibleLimit, setVarianceVisibleLimit] = useState(100);
  const issueUpdateQueue = useRef(new Map());
  useEffect(() => {
    let active = true;
    loadEnrollmentDataset('historical').then((saved) => {
      if (!active) return;
      if (Array.isArray(saved) && saved.length) {
        setHistoryRecords(saved);
        setHistoryStatus(saved.length.toLocaleString() + ' historical quarter records loaded from this browser.');
      } else setHistoryStatus('Upload the historical workbook to load 2022–23 to 2025–26.');
    }).catch(() => { if (active) setHistoryStatus('Upload the historical workbook to load historical data.'); });
    return () => { active = false; };
  }, []);
  const historicalRows = useMemo(() => {
    const grouped = new Map();
    historyRecords.forEach((record) => {
      const key = [record.region,record.localBoard,record.recCode,record.classCode,record.year].join('::');
      if (!grouped.has(key)) grouped.set(key,{key,region:record.region,localBoard:record.localBoard,recName:record.recName,recCode:record.recCode,classCode:record.classCode,className:record.className,year:record.year,q1:null,q2:null,q3:null,q4:null,q1Adequate:null,q1Moderate:null,q1Low:null,q1NonAccess:null,q2Adequate:null,q2Moderate:null,q2Low:null,q2NonAccess:null,q3Adequate:null,q3Moderate:null,q3Low:null,q3NonAccess:null,q4Adequate:null,q4Moderate:null,q4Low:null,q4NonAccess:null});
      const item=grouped.get(key), q=record.quarter.toLowerCase();
      if(['q1','q2','q3','q4'].includes(q)) {
        item[q]=record.enrollment;
        item[q+'Adequate']=record.adequate;item[q+'Moderate']=record.moderate;item[q+'Low']=record.low;item[q+'NonAccess']=record.nonAccess;
      }
    });
    return [...grouped.values()];
  },[historyRecords]);
  const historicalAnalysis = useMemo(() => {
    const years = [...new Set(historicalRows.map((row) => row.year))].sort();
    const previousClass = { Nursery: 'Ibtida', 'KG I': 'Nursery', 'KG II': 'KG I' };
    const rowIndex = new Map(historicalRows.map((row) => [[row.region, row.recCode, row.className, row.year].join('::'), row]));
    const recRows = historicalRows.map((row) => {
      const yearIndex = years.indexOf(row.year), priorYear = yearIndex > 0 ? years[yearIndex - 1] : null;
      const priorName = previousClass[row.className] || null;
      const prior = priorName && priorYear ? rowIndex.get([row.region, row.recCode, priorName, priorYear].join('::')) : null;
      const result = { ...row, previousClassName: priorName, previousClassYear: priorYear, matchedPreviousClass: Boolean(prior) };
      ['q1','q2','q3','q4'].forEach((q) => {
        const current = row[q], baseline = prior?.[q] ?? null;
        result['previous' + q.toUpperCase()] = baseline;
        result[q + 'PreviousClassVariance'] = current != null && baseline != null ? current - baseline : null;
        result[q + 'PreviousClassPct'] = baseline > 0 && result[q + 'PreviousClassVariance'] != null ? result[q + 'PreviousClassVariance'] / baseline * 100 : null;
        const prevQ = { q2: 'q1', q3: 'q2', q4: 'q3' }[q];
        result[q + 'QuarterVariance'] = prevQ && row[q] != null && row[prevQ] != null ? row[q] - row[prevQ] : null;
        result[q + 'QuarterPct'] = prevQ && row[prevQ] > 0 && result[q + 'QuarterVariance'] != null ? result[q + 'QuarterVariance'] / row[prevQ] * 100 : null;
      });
      return result;
    });
    const totals = new Map();
    recRows.forEach((row) => {
      const key = [row.region, row.className, row.year].join('::');
      if (!totals.has(key)) totals.set(key, { key, region: row.region, className: row.className, year: row.year, recs: 0, q1: 0, q2: 0, q3: 0, q4: 0, q1Count: 0, q2Count: 0, q3Count: 0, q4Count: 0, q1PreviousClass: 0, q2PreviousClass: 0, q3PreviousClass: 0, q4PreviousClass: 0, q1PreviousClassBase: 0, q2PreviousClassBase: 0, q3PreviousClassBase: 0, q4PreviousClassBase: 0, q1Matched: 0, q2Matched: 0, q3Matched: 0, q4Matched: 0 });
      const total = totals.get(key); total.recs += 1;
      ['q1','q2','q3','q4'].forEach((q) => {
        if (row[q] != null) { total[q] += Number(row[q]); total[q + 'Count'] += 1; }
        if (row[q + 'PreviousClassVariance'] != null) { total[q + 'PreviousClass'] += Number(row[q + 'PreviousClassVariance']); total[q + 'PreviousClassBase'] += Number(row['previous' + q.toUpperCase()]); total[q + 'Matched'] += 1; }
      });
    });
    const classSummaries = [...totals.values()].map((item) => {
      ['q1','q2','q3','q4'].forEach((q) => { if (!item[q + 'Count']) item[q] = null; if (!item[q + 'Matched']) item[q + 'PreviousClass'] = null; });
      return item;
    });
    const allRegionMap = new Map();
    classSummaries.forEach((item) => {
      const key = [item.className, item.year].join('::');
      if (!allRegionMap.has(key)) allRegionMap.set(key, { ...item, key: 'All Regions::' + key, region: 'All Regions', recs: 0, q1: 0, q2: 0, q3: 0, q4: 0, q1Count: 0, q2Count: 0, q3Count: 0, q4Count: 0, q1PreviousClass: 0, q2PreviousClass: 0, q3PreviousClass: 0, q4PreviousClass: 0, q1PreviousClassBase: 0, q2PreviousClassBase: 0, q3PreviousClassBase: 0, q4PreviousClassBase: 0, q1Matched: 0, q2Matched: 0, q3Matched: 0, q4Matched: 0 });
      const total = allRegionMap.get(key); total.recs += item.recs;
      ['q1','q2','q3','q4'].forEach((q) => { if (item[q] != null) { total[q] += item[q]; total[q + 'Count'] += item[q + 'Count']; } if (item[q + 'PreviousClass'] != null) { total[q + 'PreviousClass'] += item[q + 'PreviousClass']; total[q + 'PreviousClassBase'] += item[q + 'PreviousClassBase']; total[q + 'Matched'] += item[q + 'Matched']; } });
    });
    const allRegions = [...allRegionMap.values()].map((item) => { ['q1','q2','q3','q4'].forEach((q) => { if (!item[q + 'Count']) item[q] = null; if (!item[q + 'Matched']) item[q + 'PreviousClass'] = null; }); return item; });
    return { years, recRows, classSummaries: [...allRegions, ...classSummaries] };
  }, [historicalRows]);
  const historyYears=useMemo(()=>[...new Set(historyRecords.map(r=>r.year))].sort(),[historyRecords]);
  const historyRegions=useMemo(()=>[...new Set(historyRecords.map(r=>r.region))].sort(),[historyRecords]);
  const filteredHistory=useMemo(()=>{
    const term=historySearch.trim().toLowerCase();
    return historicalAnalysis.recRows.filter(row=>(!historyYear||row.year===historyYear)&&(!historyRegion||row.region===historyRegion)&&(!historyClass||row.className===historyClass)&&(!term||(row.recName+' '+row.localBoard+' '+row.region).toLowerCase().includes(term)));
  },[historicalAnalysis,historyYear,historyRegion,historyClass,historySearch]);
  async function importHistoricalWorkbook(file) {
    if(!file)return;
    setHistoryStatus('Reading '+file.name+'…');
    try {
      const parsed=await parseHistoricalEnrollmentWorkbook(file);
      await saveEnrollmentDataset('historical',parsed);
      setHistoryRecords(parsed);
      setHistoryStatus(parsed.length.toLocaleString()+' historical quarter records imported from '+file.name+'. Saved in this browser.');
      setHistoryLimit(100);
    } catch(error) { setHistoryStatus(error.message||'Could not read this workbook. Please check its format.'); }
  }
  const [issueNotes, setIssueNotes] = useState(() => {
    try { return JSON.parse(window.localStorage.getItem('ecd-resource-hub.access-issues') || '{}'); }
    catch { return {}; }
  });
  const boardOptions = useMemo(() => [...new Set(records.filter((record) => !region || record.region === region).map((record) => record.localBoard))].sort(), [records, region]);
  const recOptions = useMemo(() => records.filter((record) => (!region || record.region === region) && (!localBoard || record.localBoard === localBoard)).reduce((list, record) => list.some((item) => item.recName === record.recName) ? list : [...list, record], []), [records, region, localBoard]);
  const filtered = useMemo(() => {
    const searchText = query.toLowerCase();
    return records.filter((record) => {
      const matchesSearch = !searchText || (record.recName + ' ' + record.localBoard + ' ' + record.region).toLowerCase().includes(searchText);
      return (!region || record.region === region)
        && (!localBoard || record.localBoard === localBoard)
        && (!recName || record.recName === recName)
        && (!classFilter || record.className === classFilter)
        && matchesSearch;
    });
  }, [records, region, localBoard, recName, classFilter, query]);
  const classGroups = [
    { label: 'Ibtida', classes: ['Ibtida'] },
    { label: 'Nursery', classes: ['Nursery'] },
    { label: 'KG I', classes: ['KG I'] },
    { label: 'KG II', classes: ['KG II'] },
    { label: 'Ibtida–KG II', classes: ['Ibtida', 'Nursery', 'KG I', 'KG II'] },
    { label: 'Ibtida–KG I', classes: ['Ibtida', 'Nursery', 'KG I'] },
    { label: 'Nursery–KG I', classes: ['Nursery', 'KG I'] },
  ];
  const classNames = ['Ibtida', 'Nursery', 'KG I', 'KG II'];
  const varianceFlags = useMemo(() => buildEnrollmentVarianceFlags(records), [records]);
  const filteredVarianceFlags = varianceFlags.filter((flag) =>
    (!varianceRegion || flag.region === varianceRegion) && (!varianceClass || flag.className === varianceClass)
  );
  const visibleVarianceFlags = filteredVarianceFlags.slice(0, varianceVisibleLimit);
  const criticalVarianceCount = filteredVarianceFlags.filter((flag) => flag.severity === 'critical').length;
  const highVarianceCount = filteredVarianceFlags.filter((flag) => flag.severity === 'high').length;

  const summaryRows = useMemo(() => {
    const makeSummary = (regionName, group) => {
      const subset = records.filter((record) => record.region === regionName && group.classes.includes(record.className));
      const sum = (field) => {
        const values = subset.map((record) => record[field]).filter((value) => value !== null && value !== undefined && value !== '');
        return values.length ? values.reduce((total, value) => total + Number(value), 0) : null;
      };
      const enrollment2025 = sum('enrollment2025');
      const q1 = sum('q1');
      const q2 = sum('q2');
      const q3 = sum('q3');
      const q4 = sum('q4');
      const delta = (later, earlier) => later !== null && earlier !== null ? later - earlier : null;
      return {
        region: regionName, group: group.label,
        recs: new Set(subset.map((record) => record.recCode)).size,
        enrollment2025, q1, q2, q3, q4,
        q1Vs2025: delta(q1, enrollment2025), q2VsQ1: delta(q2, q1),
        q3VsQ2: delta(q3, q2), q4VsQ3: delta(q4, q3), q4Vs2025: delta(q4, enrollment2025),
        adequateQ1: sum('adequateQ1'), moderateQ1: sum('moderateQ1'), lowQ1: sum('lowQ1'), nonQ1: sum('nonQ1'),
      };
    };
    return regions.flatMap((regionName) => classGroups.map((group) => makeSummary(regionName, group)));
  }, [records, regions]);
  const regionalTargetRows = summaryRows.map((row) => {
    const targetRow = (data?.regions || []).find((target) => target.region === row.region);
    const targetField = { 'Ibtida': 'ibtida', 'Ibtida–KG I': 'ecdIbtidaKg1', 'Nursery–KG I': 'nurseryKg1' }[row.group];
    const target = targetField && targetRow ? targetRow[targetField] : null;
    return { ...row, target, targetDifference: target !== null && row.q4 !== null ? row.q4 - target : null };
  });
  const separateSummaryRows = summaryRows.filter((row) => classNames.includes(row.group) && (!summaryRegion || row.region === summaryRegion) && summaryClasses.includes(row.group));
  useEffect(() => {
    let active = true;
    fetch('/api/access-issues').then((response) => response.ok ? response.json() : Promise.reject(new Error('Shared issue storage is unavailable.'))).then((result) => {
      if (!active) return;
      const shared = result?.issues && typeof result.issues === 'object' ? result.issues : {};
      setIssueNotes((current) => ({ ...current, ...shared }));
      setIssueSyncStatus('shared');
    }).catch(() => { if (active) setIssueSyncStatus('device'); }).finally(() => { if (active) setIssueSyncReady(true); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    window.localStorage.setItem('ecd-resource-hub.access-issues', JSON.stringify(issueNotes));
    if (!issueSyncReady) return undefined;
    setIssueSyncStatus('saving');
    const timer = window.setTimeout(() => {
      const updates = Object.fromEntries(issueUpdateQueue.current);
      if (!Object.keys(updates).length) { setIssueSyncStatus('shared'); return; }
      issueUpdateQueue.current.clear();
      fetch('/api/access-issues', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ updates }) })
        .then((response) => { if (!response.ok) throw new Error('Could not save shared issue notes.'); setIssueSyncStatus('shared'); })
        .catch(() => { Object.entries(updates).forEach(([key, issue]) => issueUpdateQueue.current.set(key, issue)); setIssueSyncStatus('device'); });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [issueNotes, issueSyncReady]);
  const differenceFields = [
    ['q1Vs2025', 'Q1 vs 2025'], ['q2VsQ1', 'Q2 vs Q1'], ['q3VsQ2', 'Q3 vs Q2'],
    ['q4VsQ3', 'Q4 vs Q3'], ['q4Vs2025', 'Q4 vs 2025'],
  ];
  const issueItems = summaryRows.flatMap((row) => differenceFields.filter(([field]) => row[field] !== null && row[field] !== 0).map(([field, label]) => ({
    key: row.region + '::' + row.group + '::' + field,
    region: row.region, group: row.group, label, value: row[field],
  }))).filter((item) => (!followupRegion || item.region === followupRegion) && (!followupGroup || item.group === followupGroup));
  const shown = filtered.slice(0, visibleLimit);
  const classesForFollowup = classGroups.map((group) => group.label);
  const fmtDiff = (value) => value === null || value === undefined ? '—' : (value > 0 ? '+' : '') + Number(value).toLocaleString();
  const fmtVariancePct = (value, baseline) => value === null || value === undefined ? '—' : fmtDiff(value) + (baseline > 0 ? ' (' + (Number(value) / Number(baseline) * 100).toFixed(1) + '%)' : '');
  const diffClass = (value) => value === null || value === undefined || Number(value) === 0 ? '' : Number(value) < 0 ? 'access-difference-cell' : 'access-increase-cell';
  const updateIssue = (key, field, value) => {
    const updated = { ...(issueNotes[key] || {}), [field]: value, updatedAt: new Date().toISOString() };
    issueUpdateQueue.current.set(key, updated);
    setIssueNotes((current) => ({ ...current, [key]: updated }));
  };
  return <section className="panel-section access-enrollment-panel">
    <div className="panel-action-row"><p>2025–26 quarterly enrolment, regional and class totals, targets, and variances. Negative differences are highlighted in red.</p><span className="access-source-tag">Source: {data?.source || 'classwise data 26.xlsx'}</span></div>
    {!data ? <div className="empty-state"><UsersRound size={24} /><b>Loading access data…</b></div> : <>
      {data.unmatchedRECCount > 0 && <div className="access-directory-note"><b>{data.unmatchedRECCount} RECs in this workbook are not in the existing REC directory.</b><span>Their enrollment remains visible here. They cannot appear in Classroom Data selectors until the REC source list includes: {(data.unmatchedRECNames || []).join(', ')}.</span></div>}
      <nav className="enrolment-section-tabs" aria-label="Enrolment management sections">
        <button type="button" className={section==='overview'?'active':''} onClick={()=>setSection('overview')}>Enrolment Overview</button>
        <button type="button" className={section==='rec-class'?'active':''} onClick={()=>setSection('rec-class')}>REC & Class Analysis</button>
        <button type="button" className={section==='red-flags'?'active':''} onClick={()=>setSection('red-flags')}>Variance & Red Flags</button>
        <button type="button" className={section==='follow-up'?'active':''} onClick={()=>setSection('follow-up')}>Investigation & Follow-up</button>
      </nav>
      {section==='overview' && <>
      <section className="access-overview-dashboard">
        <div className="access-detail-heading"><div><span className="eyebrow">2025–26 ENROLMENT OVERVIEW</span><h2>Class-wise regional comparison</h2><p>Each class is shown separately. Select a region to focus the comparison, or keep All Regions to see the consolidated picture alongside every region.</p></div><span>8 regions · 4 classes · 3 combined groups</span></div>
        <div className="classroom-filter-panel access-filters">
          <div className="classroom-location-selects">
            <label className="form-field">Region view<select value={summaryRegion} onChange={(event)=>setSummaryRegion(event.target.value)}><option value="">All regions</option>{regions.map((value)=><option key={value}>{value}</option>)}</select></label>
          </div>
        </div>
        {classGroups.map((group)=>{
          const className=group.label;
          const classRows=summaryRows.filter((row)=>row.group===className);
          const regionalDisplayOrder=['Southern_01','Central_02','Upper Chitral_03','Lower Chitral_04','Gupis-Yasin_05','Ishkoman-Puniyal_06','Hunza_07','Gilgit_08'];
          const displayRegions=summaryRegion?[summaryRegion]:['All Regions',...regionalDisplayOrder.filter((name)=>regions.includes(name))];
          const getValue=(regionName,field)=>{
            if(regionName!=='All Regions') return classRows.find((row)=>row.region===regionName)?.[field] ?? null;
            const values=classRows.map((row)=>row[field]).filter((value)=>value!==null&&value!==undefined&&value!=='');
            return values.length?values.reduce((total,value)=>total+Number(value),0):null;
          };
          // 2025–26 targets supplied in the confirmed column order:
          // Total, Southern, Central, Upper Chitral, Lower Chitral,
          // Gupis-Yasin, Ishkoman-Puniyal, Hunza, Gilgit.
          const suppliedClassTargets={
            'Nursery':{total:9343,regions:{'Southern_01':1059,'Central_02':362,'Upper Chitral_03':1744,'Lower Chitral_04':1123,'Gupis-Yasin_05':2087,'Ishkoman-Puniyal_06':1446,'Hunza_07':774,'Gilgit_08':750}},
            'KG I':{total:9343,regions:{'Southern_01':1059,'Central_02':362,'Upper Chitral_03':1744,'Lower Chitral_04':1123,'Gupis-Yasin_05':2087,'Ishkoman-Puniyal_06':1446,'Hunza_07':774,'Gilgit_08':750}},
            'KG II':{total:8263,regions:{'Southern_01':1040,'Central_02':396,'Upper Chitral_03':1442,'Lower Chitral_04':951,'Gupis-Yasin_05':1516,'Ishkoman-Puniyal_06':1282,'Hunza_07':812,'Gilgit_08':825}}
          };
          const getSingleClassTarget=(targetClass,regionName)=>{
            const supplied=suppliedClassTargets[targetClass];
            if(supplied) return regionName==='All Regions'?supplied.total:(supplied.regions[regionName]??null);
            if(targetClass==='Ibtida'&&regionName==='All Regions'){
              const values=(data?.regions||[]).map((item)=>item.ibtida).filter((value)=>value!==null&&value!==undefined&&value!=='').map(Number);
              return values.length?values.reduce((total,value)=>total+value,0):null;
            }
            const targetRow=(data?.regions||[]).find((item)=>item.region===regionName);
            return targetRow&&targetClass==='Ibtida'&&targetRow.ibtida!==null&&targetRow.ibtida!==undefined&&targetRow.ibtida!==''?Number(targetRow.ibtida):null;
          };
          const getRegionalTarget=(regionName)=>{
            const targetClasses=group.classes;
            const values=targetClasses.map((targetClass)=>getSingleClassTarget(targetClass,regionName));
            return values.every((value)=>value!==null)?values.reduce((total,value)=>total+value,0):null;
          };
          const getTarget=(regionName)=>getRegionalTarget(regionName);
          const metrics=[
            ['RECs','recs',true],
            ['2025–26 Target',null,'target'],
            ...(className==='Ibtida'?[]:[['2025 baseline','enrollment2025']]),
            ['Q1 enrolment','q1'],
            ['Q1 vs target',null,'targetVariance','q1'],
            ['Q2 enrolment','q2'],
            ['Q2 vs target',null,'targetVariance','q2'],
            ['Q2 vs Q1','q2VsQ1','diff','q1'],
            ['Q3 enrolment','q3'],
            ['Q3 vs target',null,'targetVariance','q3'],
            ['Q3 vs Q2','q3VsQ2','diff','q2'],
            ['Q4 enrolment','q4'],
            ['Q4 vs target',null,'targetVariance','q4'],
            ['Q4 vs Q1',null,'quarterVariance','q1'],
            ['Q4 vs Q2',null,'quarterVariance','q2'],
            ['Q4 vs Q3','q4VsQ3','diff','q3'],
            ...(className==='Ibtida'?[]:[['Q4 vs 2025 baseline','q4Vs2025','diff','enrollment2025']])
          ];
          return <section className="access-class-overview" key={className}>
            <div className="access-class-overview-heading"><h3>{className}</h3><span>{group.classes.length===1?(className==='Ibtida'?'Class enrolment and target':className==='Nursery'?'Previous-class comparison: Ibtida':className==='KG I'?'Previous-class comparison: Nursery':'Previous-class comparison: KG I'):'Combined class group'}</span></div>
            <div className="access-table-wrap"><table className="data-table access-class-matrix">
              <thead><tr><th>Indicator</th>{displayRegions.map((regionName)=><th key={regionName}>{regionName==='All Regions'?'All':({'Southern_01':'Southern','Central_02':'Central','Upper Chitral_03':'U. Chitral','Lower Chitral_04':'L. Chitral','Gupis-Yasin_05':'Gupis-Yasin','Ishkoman-Puniyal_06':'Ish.-Pun.','Hunza_07':'Hunza','Gilgit_08':'Gilgit'}[regionName]||regionName)}</th>)}</tr></thead>
              <tbody>{metrics.map(([label,field,kind,baselineField])=><tr key={label} className={['q1','q2','q3','q4'].includes(field)?`access-quarter-row access-quarter-${field}`:''}><th scope="row">{label}</th>{displayRegions.map((regionName)=>{
                const target=getTarget(regionName);
                const quarterValue=baselineField&&['q1','q2','q3','q4'].includes(baselineField)?getValue(regionName,baselineField):null;
                const value=kind==='target'?target:kind==='targetVariance'?(quarterValue!==null&&target!==null?quarterValue-target:null):kind==='quarterVariance'?(getValue(regionName,'q4')!==null&&quarterValue!==null?getValue(regionName,'q4')-quarterValue:null):getValue(regionName,field);
                const baseline=baselineField&&kind==='diff'?getValue(regionName,baselineField):null;
                const display=kind==='diff'?fmtVariancePct(value,baseline):kind==='targetVariance'||kind==='quarterVariance'?fmtDiff(value):displayCount(value);
                return <td key={regionName} className={(kind==='diff'||kind==='targetVariance'||kind==='quarterVariance')?diffClass(value):''}>{display}</td>;
              })}</tr>)}</tbody>
            </table></div>
          </section>;
        })}
      </section>
      {historicalAnalysis.recRows.length>0&&<section className="access-history-overview">
        <div className="access-detail-heading"><div><span className="eyebrow">HISTORICAL TRENDS</span><h2>Quarterly enrolment and previous-class comparison</h2><p>Historical academic years are available in REC & Class Analysis. These totals are aggregated from REC-level records.</p></div><span>{historicalAnalysis.years.length} academic years</span></div>
        <div className="access-table-wrap"><table className="data-table access-summary-table"><thead><tr><th>Class</th><th>Academic year</th><th>RECs</th><th>Q1</th><th>Q2</th><th>Q2 vs Q1</th><th>Q3</th><th>Q3 vs Q2</th><th>Q4</th><th>Q4 vs Q3</th><th>Q1 vs previous class</th><th>Q2 vs previous class</th><th>Q3 vs previous class</th><th>Q4 vs previous class</th></tr></thead><tbody>{historicalAnalysis.classSummaries.filter((row)=>row.region===(summaryRegion||'All Regions')).sort((a,b)=>classNames.indexOf(a.className)-classNames.indexOf(b.className)||a.year.localeCompare(b.year)).map((row)=><tr key={row.key}><td>{row.className}</td><td>{row.year}</td><td>{row.recs.toLocaleString()}</td><td>{displayCount(row.q1)}</td><td>{displayCount(row.q2)}</td><td className={diffClass(row.q2!=null&&row.q1!=null?row.q2-row.q1:null)}>{fmtVariancePct(row.q2!=null&&row.q1!=null?row.q2-row.q1:null,row.q1)}</td><td>{displayCount(row.q3)}</td><td className={diffClass(row.q3!=null&&row.q2!=null?row.q3-row.q2:null)}>{fmtVariancePct(row.q3!=null&&row.q2!=null?row.q3-row.q2:null,row.q2)}</td><td>{displayCount(row.q4)}</td><td className={diffClass(row.q4!=null&&row.q3!=null?row.q4-row.q3:null)}>{fmtVariancePct(row.q4!=null&&row.q3!=null?row.q4-row.q3:null,row.q3)}</td>{['q1','q2','q3','q4'].map((q)=><td key={q} className={diffClass(row[q+'PreviousClass'])}>{fmtVariancePct(row[q+'PreviousClass'],row[q+'PreviousClassBase'])}</td>)}</tr>)}</tbody></table></div>
        <p className="access-variance-note">Previous-class comparison: Nursery vs Ibtida, KG I vs Nursery, and KG II vs KG I. 2022–23 has no preceding-year baseline in this workbook; Ibtida has no preceding ECED class.</p>
      </section>}
      </>}
      {section==='red-flags' && <>
      <section className="access-variance-section">
        <div className="access-detail-heading"><div><span className="eyebrow">ENROLMENT VARIANCE ANALYSIS</span><h2>REC and class red flags</h2><p>Flags are calculated from quarterly enrolment figures using a 20% decline threshold.</p></div><span>{filteredVarianceFlags.length.toLocaleString()} flags</span></div>
        <div className="access-variance-summary">
          <article><small>Critical · zero Q4</small><strong>{criticalVarianceCount.toLocaleString()}</strong></article>
          <article><small>Significant declines</small><strong>{highVarianceCount.toLocaleString()}</strong></article>
          <article><small>REC / class records flagged</small><strong>{new Set(filteredVarianceFlags.map((flag) => flag.recCode + '::' + flag.classCode)).size.toLocaleString()}</strong></article>
        </div>
        <div className="classroom-location-selects access-variance-filters">
          <label className="form-field">Region<select value={varianceRegion} onChange={(event) => { setVarianceRegion(event.target.value); setVarianceVisibleLimit(100); }}><option value="">All regions</option>{regions.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label className="form-field">Class<select value={varianceClass} onChange={(event) => { setVarianceClass(event.target.value); setVarianceVisibleLimit(100); }}><option value="">All classes</option>{classNames.map((value) => <option key={value}>{value}</option>)}</select></label>
        </div>
        <div className="access-variance-list">
          {visibleVarianceFlags.map((flag) => <article className={'access-variance-card ' + (flag.severity === 'critical' ? 'is-critical' : '')} key={flag.key}>
            <div className="access-variance-card-heading"><div><b>{flag.recName}</b><small>{flag.region} · {flag.localBoard} · {flag.className}</small></div><span className={flag.severity === 'critical' ? 'variance-critical-pill' : 'variance-high-pill'}>{flag.severity === 'critical' ? 'Critical' : 'Red flag'}</span></div>
            <strong>{flag.label}</strong>
            <p>{flag.comparison}{flag.previous !== null && flag.current !== null ? ': ' + displayCount(flag.previous) + ' → ' + displayCount(flag.current) : ''}{flag.changePct !== null ? ' (' + flag.changePct.toFixed(1) + '%)' : ''}</p>
            <label className="form-field">Investigation reason<textarea rows="2" value={issueNotes[flag.key]?.reason || ''} onChange={(event) => updateIssue(flag.key, 'reason', event.target.value)} placeholder="Record why this enrolment change occurred" /></label>
            <label className="form-field">Assigned person<input value={issueNotes[flag.key]?.assignedUser || ''} onChange={(event) => updateIssue(flag.key, 'assignedUser', event.target.value)} placeholder="Name of person responsible for follow-up" /></label>
          </article>)}
        </div>
        {filteredVarianceFlags.length > varianceVisibleLimit && <button type="button" className="show-more-access" onClick={() => setVarianceVisibleLimit((limit) => limit + 100)}>Show 100 more flags</button>}
        {!filteredVarianceFlags.length && <div className="empty-state"><b>No red flags for the selected filters</b><span>Records without a comparable baseline are not assigned a percentage decline.</span></div>}
        <p className="access-variance-note">ENR25 is treated as the previous-year enrolment in the preceding class. Ibtida is excluded from this progression comparison. Quarterly peak declines and quarter-on-quarter declines are reported separately. The source workbook is not changed.</p>
      </section>
      </>}
      {section==='follow-up' && <>
      <section className="access-followup">
        <div className="access-detail-heading"><div><span className="eyebrow">FOLLOW-UP</span><h2>Reasons for enrolment differences</h2><p>Record a reason and assign a person to follow up. <span className="access-sync-status">{issueSyncStatus === 'shared' ? 'Saved for users of this app.' : issueSyncStatus === 'saving' || issueSyncStatus === 'loading' ? 'Saving…' : 'Saved on this device only; shared storage is unavailable.'}</span></p></div><span>{issueItems.length.toLocaleString()} differences</span></div>
        <div className="classroom-location-selects access-followup-filters"><label className="form-field">Region<select value={followupRegion} onChange={(event) => { setFollowupRegion(event.target.value); setIssueVisibleLimit(60); }}><option value="">All regions</option>{regions.map((value) => <option key={value}>{value}</option>)}</select></label><label className="form-field">Class / group<select value={followupGroup} onChange={(event) => { setFollowupGroup(event.target.value); setIssueVisibleLimit(60); }}><option value="">All classes and groups</option>{classesForFollowup.map((value) => <option key={value}>{value}</option>)}</select></label></div>
        {issueItems.length ? <div className="access-issue-list">{issueItems.slice(0, issueVisibleLimit).map((item) => <article className="access-issue-card" key={item.key}><div className="access-issue-heading"><span><b>{item.region}</b><small>{item.group}</small></span><strong className="access-difference-pill">{item.label}: {fmtDiff(item.value)}</strong></div><label className="form-field">Issue or reason<textarea rows="2" value={issueNotes[item.key]?.reason || ''} onChange={(event) => updateIssue(item.key, 'reason', event.target.value)} placeholder="Describe the reason for this change" /></label><label className="form-field">Assigned user<input value={issueNotes[item.key]?.assignedUser || ''} onChange={(event) => updateIssue(item.key, 'assignedUser', event.target.value)} placeholder="Enter the responsible person’s name" /></label></article>)}</div> : <div className="empty-state"><b>No non-zero differences for these filters</b></div>}
        {issueItems.length > issueVisibleLimit && <><span className="access-followup-limit">Showing {issueVisibleLimit} of {issueItems.length.toLocaleString()} differences.</span><button type="button" className="show-more-access" onClick={() => setIssueVisibleLimit((limit) => limit + 60)}>Show 60 more differences</button></>}
      </section>
      </>}
      {section==='rec-class' && <>
        <section className="access-history-section">
          <div className="access-detail-heading"><div><span className="eyebrow">HISTORICAL ACCESS & ENROLMENT</span><h2>Quarterly trends · 2022–23 to 2025–26</h2><p>Import the historical workbook once in this browser. Its REC, class, year, quarter, and access records are saved locally for later visits.</p></div><span>{historyRecords.length.toLocaleString()} quarter records</span></div>
          <div className="access-history-import"><label className="form-field">Import historical workbook (.xlsx)<input type="file" accept=".xlsx,.xls" onChange={(event)=>importHistoricalWorkbook(event.target.files?.[0])}/></label><span>{historyStatus}</span></div>
          {historyRecords.length>0 && <>
            <div className="classroom-location-selects access-variance-filters">
              <label className="form-field">Academic year<select value={historyYear} onChange={e=>{setHistoryYear(e.target.value);setHistoryLimit(100);}}><option value="">All years</option>{historyYears.map(v=><option key={v}>{v}</option>)}</select></label>
              <label className="form-field">Region<select value={historyRegion} onChange={e=>{setHistoryRegion(e.target.value);setHistoryLimit(100);}}><option value="">All regions</option>{historyRegions.map(v=><option key={v}>{v}</option>)}</select></label>
              <label className="form-field">Class<select value={historyClass} onChange={e=>{setHistoryClass(e.target.value);setHistoryLimit(100);}}><option value="">All classes</option>{classNames.map(v=><option key={v}>{v}</option>)}</select></label>
              <label className="form-field">Search REC / Local Board<input value={historySearch} onChange={e=>{setHistorySearch(e.target.value);setHistoryLimit(100);}} placeholder="Enter REC or board name"/></label>
            </div>
            <div className="access-history-summary"><b>{filteredHistory.length.toLocaleString()} REC/class/year combinations</b><span>Quarterly enrolment and Q1 access categories are shown.</span></div>
            <div className="access-table-wrap"><table className="data-table access-history-table"><thead><tr><th>Year</th><th>Region</th><th>Local Board</th><th>REC</th><th>Class</th><th>Q1</th><th>Q2</th><th>Q2 vs Q1</th><th>Q3</th><th>Q3 vs Q2</th><th>Q4</th><th>Q4 vs Q3</th><th>Q1 vs previous class</th><th>Q2 vs previous class</th><th>Q3 vs previous class</th><th>Q4 vs previous class</th>{['q1','q2','q3','q4'].map((q)=> <React.Fragment key={q}><th>{q.toUpperCase()} Adequate</th><th>{q.toUpperCase()} Moderate</th><th>{q.toUpperCase()} Low</th><th>{q.toUpperCase()} Non-access</th></React.Fragment>)}</tr></thead><tbody>{filteredHistory.slice(0,historyLimit).map(row=><tr key={row.key}><td>{row.year}</td><td>{row.region}</td><td>{row.localBoard}</td><td>{row.recName}</td><td>{row.className}</td><td>{displayCount(row.q1)}</td><td>{displayCount(row.q2)}</td><td className={diffClass(row.q2QuarterVariance)}>{fmtVariancePct(row.q2QuarterVariance, row.q1)}</td><td>{displayCount(row.q3)}</td><td className={diffClass(row.q3QuarterVariance)}>{fmtVariancePct(row.q3QuarterVariance, row.q2)}</td><td>{displayCount(row.q4)}</td><td className={diffClass(row.q4QuarterVariance)}>{fmtVariancePct(row.q4QuarterVariance, row.q3)}</td>{['q1','q2','q3','q4'].map((q)=><td key={q} className={diffClass(row[q+'PreviousClassVariance'])}>{fmtVariancePct(row[q+'PreviousClassVariance'], row['previous'+q.toUpperCase()])}</td>)}{['q1','q2','q3','q4'].map((q)=><React.Fragment key={q}><td>{displayCount(row[q+'Adequate'])}</td><td>{displayCount(row[q+'Moderate'])}</td><td>{displayCount(row[q+'Low'])}</td><td>{displayCount(row[q+'NonAccess'])}</td></React.Fragment>)}</tr>)}</tbody></table></div>
            {filteredHistory.length>historyLimit&&<button type="button" className="show-more-access" onClick={()=>setHistoryLimit(n=>n+100)}>Show 100 more records</button>}
          </>}
        </section>
      <div className="access-detail-heading"><div><span className="eyebrow">REC-WISE DATA</span><h2>Quarterly enrolment by class</h2></div><span>{filtered.length.toLocaleString()} matching records</span></div>
      <div className="classroom-filter-panel access-filters"><div className="classroom-location-selects"><label className="form-field">Region<select value={region} onChange={(event) => { setRegion(event.target.value); setLocalBoard(''); setRecName(''); setVisibleLimit(100); }}><option value="">All regions</option>{regions.map((value) => <option key={value}>{value}</option>)}</select></label><label className="form-field">Local Board<select value={localBoard} onChange={(event) => { setLocalBoard(event.target.value); setRecName(''); setVisibleLimit(100); }}><option value="">All local boards</option>{boardOptions.map((value) => <option key={value}>{value}</option>)}</select></label><label className="form-field">REC<select value={recName} onChange={(event) => { setRecName(event.target.value); setVisibleLimit(100); }}><option value="">All RECs</option>{recOptions.map((value) => <option key={value.recName}>{value.recName}</option>)}</select></label><label className="form-field">Class<select value={classFilter} onChange={(event) => { setClassFilter(event.target.value); setVisibleLimit(100); }}><option value="">All classes</option>{classNames.map((name) => <option key={name}>{name}</option>)}</select></label><label className="form-field">Search REC<input value={query} onChange={(event) => { setQuery(event.target.value); setVisibleLimit(100); }} placeholder="REC or board name" /></label></div></div>
      <div className="access-table-wrap"><table className="data-table"><thead><tr><th>Region</th><th>Local Board</th><th>REC</th><th>Class</th><th>2025 baseline</th><th>2025–26 Q1</th><th>Q1 vs 2025</th><th>2025–26 Q2</th><th>Q2 vs Q1</th><th>2025–26 Q3</th><th>Q3 vs Q2</th><th>2025–26 Q4</th><th>Q4 vs Q3</th><th>Q4 vs 2025</th><th>Latest</th><th>Reasons / assigned user</th></tr></thead><tbody>{shown.map((record, index) => <tr key={record.recCode + '-' + record.classCode + '-' + index}><td>{record.region}</td><td>{record.localBoard}</td><td>{record.recName}{record.directoryMatch === false ? ' · not in REC directory' : ''}</td><td>{record.className}</td><td>{displayCount(record.enrollment2025)}</td><td>{displayCount(record.q1)}</td><td className={diffClass(record.q1Vs2025)}>{fmtDiff(record.q1Vs2025)}</td><td>{displayCount(record.q2)}</td><td className={diffClass(record.q2VsQ1)}>{fmtDiff(record.q2VsQ1)}</td><td>{displayCount(record.q3)}</td><td className={diffClass(record.q3VsQ2)}>{fmtDiff(record.q3VsQ2)}</td><td>{displayCount(record.q4)}</td><td className={diffClass(record.q4VsQ3)}>{fmtDiff(record.q4VsQ3)}</td><td className={diffClass(record.q4Vs2025)}>{fmtDiff(record.q4Vs2025)}</td><td>{displayCount(record.latestEnrollment)}{record.latestQuarter ? ' (' + record.latestQuarter + ')' : ''}</td><td><details className="rec-reason-editor"><summary>{issueNotes['rec::' + record.recCode + '::' + record.classCode]?.reason ? 'Edit reason' : 'Add reason'}</summary><label className="form-field">Issue or reason<textarea rows="2" value={issueNotes['rec::' + record.recCode + '::' + record.classCode]?.reason || ''} onChange={(event) => updateIssue('rec::' + record.recCode + '::' + record.classCode, 'reason', event.target.value)} placeholder="Enter the reason for this difference" /></label><label className="form-field">User name<input value={issueNotes['rec::' + record.recCode + '::' + record.classCode]?.assignedUser || ''} onChange={(event) => updateIssue('rec::' + record.recCode + '::' + record.classCode, 'assignedUser', event.target.value)} placeholder="Name" /></label><label className="form-field">Designation<input value={issueNotes['rec::' + record.recCode + '::' + record.classCode]?.designation || ''} onChange={(event) => updateIssue('rec::' + record.recCode + '::' + record.classCode, 'designation', event.target.value)} placeholder="Designation" /></label></details></td></tr>)}</tbody></table></div>
      {filtered.length > shown.length && <button type="button" className="show-more-access" onClick={() => setVisibleLimit((limit) => limit + 100)}>Show 100 more records</button>}
      </>}
    </>}
  </section>;
}
function DataPanel({ title, storageKey, showRecClassFilters = false, sourceRecords = [], accessRecords = [] }) {
  const [rows, setRows] = useState(() => readLocalList(storageKey));
  const [message, setMessage] = useState('');
  const [region, setRegion] = useState('');
  const [localBoard, setLocalBoard] = useState('');
  const [recName, setRecName] = useState('');
  const [selectedClasses, setSelectedClasses] = useState([]);
  const [editingIndex, setEditingIndex] = useState(null);
  const [draftRecord, setDraftRecord] = useState(null);
  const [reviewedAt, setReviewedAt] = useState(() => window.localStorage.getItem(storageKey + '.reviewedAt') || '');
  const columns = rows.length ? Object.keys(rows[0]) : [];
  const boardOptions = useMemo(() => [...new Set(recDirectory.filter((row) => row.region === region).map((row) => row.localBoard))].sort(), [region]);
  const recOptions = useMemo(() => recDirectory.filter((row) => row.region === region && row.localBoard === localBoard), [region, localBoard]);
  const sourceRecord = showRecClassFilters ? sourceRecords.find((record) => record.region === region && record.localBoard === localBoard && record.recName === recName) : null;
  const accessClassRows = showRecClassFilters && region && localBoard && recName ? accessRecords.filter((record) => record.region === region && record.localBoard === localBoard && record.recName === recName && (!selectedClasses.length || selectedClasses.includes(record.className))) : [];
  const ibtidaAccessRecord = accessRecords.find((record) => record.region === region && record.localBoard === localBoard && record.recName === recName && record.className === 'Ibtida') || null;
  const classOptions = ['Ibtida', 'Nursery', 'KG I', 'KG II'];

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(rows));
  }, [rows, storageKey]);

  const visibleRows = useMemo(() => {
    const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return rows.map((record, index) => ({ record, index })).filter(({ record }) => {
      if (!showRecClassFilters) return true;
      const rowRegion = findRecordField(record, ['region', 'region name']);
      const rowBoard = findRecordField(record, ['local board', 'board', 'local board name']);
      const rowRec = findRecordField(record, ['rec', 'rec name', 'school', 'school name', 'centre', 'center']);
      const rowClass = findRecordField(record, ['class', 'class name', 'grade']);
      return (!region || !rowRegion || normalize(rowRegion) === normalize(region))
        && (!localBoard || !rowBoard || normalize(rowBoard) === normalize(localBoard))
        && (!recName || !rowRec || normalize(rowRec) === normalize(recName))
        && (!selectedClasses.length || !rowClass || selectedClasses.some((value) => normalize(value) === normalize(rowClass)));
    });
  }, [rows, showRecClassFilters, region, localBoard, recName, selectedClasses]);

  async function importCsv(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const imported = parseCsvRows(await file.text());
      if (!imported.length) {
        setMessage('This CSV has no data rows. Check that the first row contains column headings.');
        return;
      }
      setRows(imported);
      setEditingIndex(null);
      setDraftRecord(null);
      setReviewedAt('');
      window.localStorage.removeItem(storageKey + '.reviewedAt');
      setMessage(imported.length + ' rows loaded. Review the records below and confirm when ready.');
    } catch {
      setMessage('The CSV file could not be read.');
    }
    event.target.value = '';
  }

  function toggleClass(className) {
    setSelectedClasses((current) => current.includes(className) ? current.filter((value) => value !== className) : [...current, className]);
  }

  function beginEdit(index, record) {
    setEditingIndex(index);
    setDraftRecord({ ...record });
  }

  function saveEditedRecord() {
    if (editingIndex === null || !draftRecord) return;
    setRows((current) => current.map((record, index) => index === editingIndex ? draftRecord : record));
    setEditingIndex(null);
    setDraftRecord(null);
    setReviewedAt('');
    window.localStorage.removeItem(storageKey + '.reviewedAt');
    setMessage('Record changes saved. Please confirm the review when you are finished.');
  }

  function confirmReview() {
    const timestamp = new Date().toISOString();
    window.localStorage.setItem(storageKey + '.reviewedAt', timestamp);
    setReviewedAt(timestamp);
    setMessage('Classroom data review confirmed.');
  }

  return <section className="panel-section data-panel">
    <div className="panel-action-row"><p>{showRecClassFilters ? 'Choose a location and class to review classroom records.' : 'Import a CSV exported from Excel to display this information here.'}<br />{showRecClassFilters && 'You can import your classroom data below, then edit and confirm the records.'}</p><label className="csv-import-button"><ArrowDownToLine size={15} />Import CSV<input type="file" accept=".csv,text/csv" onChange={importCsv} /></label></div>
    {showRecClassFilters && <div className="classroom-filter-panel">
      <div className="classroom-location-selects">
        <label className="form-field">Region<select value={region} onChange={(event) => { setRegion(event.target.value); setLocalBoard(''); setRecName(''); }}><option value="">Select a region</option>{regions.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="form-field">Local Board<select value={localBoard} disabled={!region} onChange={(event) => { setLocalBoard(event.target.value); setRecName(''); }}><option value="">Select a local board</option>{boardOptions.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="form-field">REC<select value={recName} disabled={!localBoard} onChange={(event) => setRecName(event.target.value)}><option value="">Select an REC</option>{recOptions.map((value) => <option key={value.recName}>{value.recName}</option>)}</select></label>
      </div>
      <fieldset className="classroom-class-select"><legend>Classes</legend>{classOptions.map((className) => <label key={className} className={'class-choice ' + (selectedClasses.includes(className) ? 'selected' : '')}><input type="checkbox" checked={selectedClasses.includes(className)} onChange={() => toggleClass(className)} /><span>{className}</span></label>)}</fieldset>
      <div className="classroom-filter-summary">{visibleRows.length} classroom records shown{selectedClasses.length ? ' · ' + selectedClasses.join(', ') + ' selected' : ' · All classes'}</div>
    </div>}
    {message && <p className="data-import-message">{message}</p>}
    {showRecClassFilters && selectedClasses.includes('Ibtida') && rows.length > 0 && <div className="classroom-review-banner"><div><b>Ibtida classroom data</b><span>{reviewedAt ? 'Review confirmed ' + new Date(reviewedAt).toLocaleString() : 'Review the displayed records, make any needed edits, then confirm.'}</span></div><button type="button" className="confirm-review-button" onClick={confirmReview} disabled={editingIndex !== null}>{reviewedAt ? 'Confirm again' : 'Confirm review'}</button></div>}
    {showRecClassFilters && region && localBoard && recName && <div className="classroom-access-link"><div><b>Linked enrolment from Access &amp; Enrollment</b><span>Latest available 2026 count for the selected REC and class.</span></div>{accessClassRows.length ? <div className="classroom-access-cards">{accessClassRows.map((record) => <article key={record.classCode}><b>{record.className}</b><strong>{displayCount(record.latestEnrollment)}</strong><span>{record.latestQuarter || 'No quarter'} · 2025 baseline {displayCount(record.enrollment2025)} · change {displayCount(record.q4Vs2025)}</span></article>)}</div> : <p>No linked enrolment rows match this REC and class selection.</p>}</div>}
    {showRecClassFilters && selectedClasses.includes('Ibtida') && region && localBoard && recName && <IbtidaClassroomForm key={[region, localBoard, recName].join('::')} region={region} localBoard={localBoard} recName={recName} sourceRecord={sourceRecord} accessRecord={ibtidaAccessRecord} />}
    {visibleRows.length ? <div className="data-table-wrap"><table className="data-table"><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}{showRecClassFilters && <th>Review</th>}</tr></thead><tbody>{visibleRows.map(({ record, index }) => <tr key={index}>{columns.map((column) => <td key={column}>{editingIndex === index ? <input className="data-cell-input" aria-label={column} value={draftRecord?.[column] ?? ''} onChange={(event) => setDraftRecord((current) => ({ ...current, [column]: event.target.value }))} /> : record[column]}</td>)}{showRecClassFilters && <td className="data-row-actions">{editingIndex === index ? <><button type="button" onClick={saveEditedRecord}>Save</button><button type="button" className="cancel-edit-button" onClick={() => { setEditingIndex(null); setDraftRecord(null); }}>Cancel</button></> : <button type="button" onClick={() => beginEdit(index, record)}>Edit</button>}</td>}</tr>)}</tbody></table></div> : <div className="empty-state"><BookOpen size={24} /><b>{rows.length ? 'No matching records' : 'No ' + title.toLowerCase() + ' loaded'}</b><span>{rows.length ? 'No records match the selected region, REC, and classes.' : 'Import the Ibtida classroom data file when it is available to populate this panel.'}</span></div>}
  </section>;
}

const ibtidaModels = ['Regular model', 'Regular model with AKES', 'Weekend model', 'Multigrade model'];
const ibtidaModelGroup = { title: 'Class model', fields: [{ id: 'model', label: 'Ibtida model', type: 'model' }] };
const ibtidaBasicFields = [
  { id: 'yearInitiated', label: 'Year initiated', type: 'number' },
  { id: 'sustainabilityYear', label: 'Sustainability year', type: 'number' },
  { id: 'repoYear', label: 'REPO year', type: 'number' },
  { id: 'modelAtInitiation', label: 'Model at initiation' },
  { id: 'modelAtSustainability', label: 'Model at sustainability' },
  { id: 'daysClassesConducted', label: 'Number of days classes are conducted', type: 'number' },
  { id: 'dailyDuration', label: 'Time duration per day for Ibtida class' },
  { id: 'classTimings', label: 'Time of classes' },
  { id: 'numberOfStudents', label: 'Number of students', type: 'number' },
  { id: 'modelFunctioning', label: 'Is the model functioning?', type: 'yesno' },
  { id: 'curriculumGuidelines', label: 'Ibtida curriculum guidelines are available', type: 'yesno' },
  { id: 'lowCostMaterials', label: 'Low-cost or no-cost learning materials are available', type: 'yesno' },
  { id: 'teachersConductParwaaz', label: 'Ibtida teachers conduct Parwaaz sessions', type: 'yesno' },
  { id: 'overallObservation', label: 'Overall observation about the Ibtida programme', type: 'textarea' },
  { id: 'challenges', label: 'Challenges faced in the Ibtida programme', type: 'textarea' },
];
const ibtidaTeachersGroup = { title: 'Teacher details & training', fields: [] };
const ibtidaRoomsGroup = {
  title: 'Rooms & premises',
  fields: [
    { id: 'roomAvailable', label: 'Room is available', type: 'yesno' },
    { id: 'roomWellPainted', label: 'Room is well painted', type: 'yesno' },
    { id: 'adequateLight', label: 'Adequate provision of light', type: 'yesno' },
    { id: 'adequateVentilation', label: 'Adequate provision of ventilation', type: 'yesno' },
    { id: 'goodFlooring', label: 'Flooring is good to sit on', type: 'yesno' },
    { id: 'spaceSufficient', label: 'Space is sufficient for a class', type: 'yesno' },
    { id: 'roomAgeAppropriate', label: 'Room is age appropriate for children', type: 'yesno' },
    { id: 'otherClassesSameRoom', label: 'Any other classes conducted in the same room?', type: 'text' },
    { id: 'parwaazSameRoom', label: 'Are Parwaaz sessions conducted in the same room?', type: 'yesno' },
    { id: 'renovationStatus', label: 'Renovation provided?', type: 'recordStatus' },
  ],
};
const ibtidaFurnitureGroup = {
  title: 'Furniture checklist',
  fields: [
    { id: 'halfMoonTables', label: 'Half moon tables', type: 'checkQuantity' },
    { id: 'tables', label: 'Tables', type: 'checkQuantity' },
    { id: 'cushions', label: 'Cushions', type: 'checkQuantity' },
    { id: 'seatingArrangement', label: 'Chairs or other proper seating', type: 'checkQuantity' },
    { id: 'shelves', label: 'Shelves', type: 'checkQuantity' },
    { id: 'bookRacks', label: 'Book racks', type: 'checkQuantity' },
    { id: 'softBoard', label: 'Soft board', type: 'checkQuantity' },
    { id: 'whiteBoard', label: 'White board', type: 'checkQuantity' },
    { id: 'cupboard', label: 'Cupboard', type: 'checkQuantity' },
    { id: 'moveableShelves', label: 'Moveable shelves made from low-cost materials', type: 'check' },
  ],
};
const ibtidaKitGroup = {
  title: 'Resource kit checklist',
  fields: [
    { id: 'resourceKitAvailable', label: 'Ibtida resource kit is available', type: 'yesno' },
    { id: 'resourceKitShelves', label: 'Resource kit is kept on shelves', type: 'yesno' },
    { id: 'resourceKitUsed', label: 'Resource kit is used by students', type: 'yesno' },
    { id: 'resourceKitCondition', label: 'Condition of the resource kit is good', type: 'yesno' },
    { id: 'kitProvisionAtInitiation', label: 'Resource kit provided at initiation' },
    { id: 'kitProvisionAtSustainability', label: 'Resource kit provided at sustainability' },
    { id: 'kitJarsBaskets', label: 'Jars and baskets', type: 'check' },
    { id: 'kitPuzzlesBlocks', label: 'Different puzzles and blocks', type: 'check' },
    { id: 'kitUtensils', label: 'Utensils', type: 'check' },
    { id: 'kitFlashcards', label: 'Flashcards', type: 'check' },
    { id: 'kitAnimalsFruits', label: 'Animals, birds, fruits, and vegetables', type: 'check' },
    { id: 'kitBalls', label: 'Balls', type: 'check' },
    { id: 'kitTentHouse', label: 'Tent house', type: 'check' },
    { id: 'kitLearningBoards', label: 'Learning boards', type: 'check' },
    { id: 'kitSportsMusicGardening', label: 'Sports, musical, and gardening kits', type: 'check' },
    { id: 'kitFeltSheet', label: 'Felt sheet', type: 'check' },
    { id: 'kitRingsTower', label: 'Rings or tower', type: 'check' },
    { id: 'kitStationery', label: 'Stationery', type: 'check' },
    { id: 'kitStoryBooks', label: 'Story books', type: 'check' },
    { id: 'parwaazKitAvailable', label: 'Parwaaz kit is available in the room', type: 'check' },
    { id: 'parwaazKitUsedByIbtida', label: 'Parwaaz kit is used by Ibtida children', type: 'check' },
    { id: 'ibtidaKitUsedInParwaaz', label: 'Ibtida kit is used in Parwaaz sessions', type: 'check' },
  ],
};
const ibtidaWeekendRoomsGroup = {
  title: 'Hall & premises',
  fields: [
    { id: 'hallAvailable', label: 'Hall or premises are available', type: 'yesno' },
    { id: 'spaceSufficient', label: 'Space is sufficient for the class', type: 'yesno' },
    { id: 'classConducted', label: 'Ibtida class is conducted at this REC', type: 'yesno' },
    { id: 'classConductedSchedule', label: 'Ibtida class day and timings' },
    { id: 'weekendClassDay', label: 'Day for weekend classes' },
  ],
};
const ibtidaMultigradeGroup = {
  title: 'Multigrade classes',
  fields: [
    { id: 'ibtidaNurseryMerged', label: 'Are classes merged with Ibtida?', type: 'yesno' },
    { id: 'otherClassesMerged', label: 'Which other classes are merged with Ibtida and Nursery?' },
    { id: 'nurseryChildren', label: 'Number of children in Nursery class', type: 'number' },
    { id: 'otherClassChildren', label: 'Number of children in the other class or classes', type: 'number' },
    { id: 'multigradePremises', label: 'Premises are suitable for a multigrade class', type: 'yesno' },
    { id: 'multigradePremisesNotes', label: 'Other premises details for multigrade classes' },
    { id: 'multigradeFramework', label: 'Head Office multigrade activity framework is available', type: 'yesno' },
    { id: 'teachersOriented', label: 'Teachers are oriented about multigrade classes', type: 'yesno' },
    { id: 'smallGroupActivities', label: 'Separate small-group activities are conducted for Ibtida and Nursery', type: 'yesno' },
    { id: 'modelContinues', label: 'The same initiated model continues to be followed', type: 'yesno' },
  ],
};

function ibtidaGroupsForModel(model) {
  const groups = [ibtidaModelGroup, { title: 'Class profile & staffing', fields: ibtidaBasicFields }, ibtidaTeachersGroup];
  if (model === 'Regular model' || model === 'Regular model with AKES') {
    groups.push(ibtidaRoomsGroup, ibtidaFurnitureGroup, ibtidaKitGroup);
  } else if (model === 'Weekend model') {
    groups.push(ibtidaWeekendRoomsGroup, ibtidaKitGroup);
  } else if (model === 'Multigrade model') {
    groups.push(ibtidaMultigradeGroup);
  }
  return groups;
}

function displayIbtidaValue(profile, field) {
  if (field.type === 'check') return profile[field.id] === 'Yes' ? '✓' : profile[field.id] === 'No' ? 'Not available' : 'Not checked';
  if (field.type === 'checkQuantity') {
    const available = profile[field.id] === 'Yes';
    return available ? '✓ Available' + (profile[field.id + 'Quantity'] ? ' · Quantity: ' + profile[field.id + 'Quantity'] : '') : profile[field.id] === 'No' ? 'Not available' : 'Not checked';
  }
  return profile[field.id] || 'Not recorded';
}

function getRenovationStatus(record) {
  if (!record) return 'Not recorded';
  const values = [record.initiated?.renovation, record.sustainability?.renovation]
    .filter((value) => value !== null && value !== undefined && value !== '');
  if (!values.length) return 'Not recorded';
  const normalized = values.map((value) => String(value).trim().toLowerCase());
  if (normalized.some((value) => value === 'yes' || (Number.isFinite(Number(value)) && Number(value) > 0))) return 'Yes';
  if (normalized.every((value) => value === 'no' || (Number.isFinite(Number(value)) && Number(value) === 0))) return 'No';
  return 'Not recorded';
}

function historicalFieldContext(record, fieldId) {
  if (!record) return '';
  const furnitureIds = {
    halfMoonTables: 'halfMoonTables',
    cushions: 'cushions',
    shelves: 'shelves',
    bookRacks: 'bookRack',
    softBoard: 'softBoard',
    whiteBoard: 'whiteBoard',
    cupboard: 'cupboard',
  };
  if (furnitureIds[fieldId]) {
    const item = furnitureIds[fieldId];
    const stages = [
      ['Initiated', record.initiated?.furniture?.[item]],
      ['Sustainability', record.sustainability?.furniture?.[item]],
      ['REPO', record.repo?.furniture?.[item]],
    ].filter(([, value]) => value !== null && value !== undefined && value !== '');
    if (stages.length) return stages.map(([stage, value]) => stage + ': ' + String(value).replace(/^yes$/i, 'Yes').replace(/^no$/i, 'No')).join(' · ');
  }
  if (fieldId === 'resourceKitAvailable') {
    const stages = [
      ['At initiation', record.initiated?.resourceKitProvided],
      ['At sustainability', record.sustainability?.resourceKitProvided],
    ].filter(([, value]) => value !== null && value !== undefined && value !== '');
    if (stages.length) return stages.map(([stage, value]) => stage + ': ' + value).join(' · ');
  }
  if (fieldId === 'overallObservation' && record.regionalRemarks) return 'Regional remarks: ' + record.regionalRemarks;
  return '';
}

function IbtidaClassroomForm({ region, localBoard, recName, sourceRecord, accessRecord }) {
  const profileId = [region, localBoard, recName].join('::');
  const sourcePrefill = useMemo(() => sourceRecord ? {
    ...Object.fromEntries(Object.entries(sourceRecord.prefill || {}).filter(([field]) => !['femaleStudents', 'maleStudents'].includes(field))),
    numberOfStudents: accessRecord?.latestEnrollment ?? sourceRecord.prefill?.numberOfStudents ?? '',
    numberOfStudentsSource: accessRecord?.latestEnrollment !== null && accessRecord?.latestEnrollment !== undefined ? 'access' : (sourceRecord.prefill?.numberOfStudentsSource || ''),
    yearInitiated: sourceRecord.prefill?.yearInitiated ?? sourceRecord.initiated?.year ?? '',
    sustainabilityYear: sourceRecord.sustainability?.year ?? '',
    repoYear: sourceRecord.repo?.year ?? '',
    modelAtInitiation: sourceRecord.initiated?.model || '',
    modelAtSustainability: sourceRecord.sustainability?.model || '',
    renovationStatus: getRenovationStatus(sourceRecord),
    kitProvisionAtInitiation: sourceRecord.initiated?.resourceKitProvided || '',
    kitProvisionAtSustainability: sourceRecord.sustainability?.resourceKitProvided || '',
  } : (accessRecord ? { numberOfStudents: accessRecord.latestEnrollment ?? '', numberOfStudentsSource: 'access' } : null), [sourceRecord, accessRecord]);
  const [profile, setProfile] = useState(() => {
    try { return JSON.parse(window.localStorage.getItem('ecd-resource-hub.ibtida-classrooms') || '{}')[profileId] || sourcePrefill || {}; }
    catch { return sourcePrefill || {}; }
  });
  const [hasSavedProfile, setHasSavedProfile] = useState(() => {
    try { return Boolean(JSON.parse(window.localStorage.getItem('ecd-resource-hub.ibtida-classrooms') || '{}')[profileId]); }
    catch { return false; }
  });
  const [isEditing, setIsEditing] = useState(() => !Object.keys(profile).length);
  const [editingSection, setEditingSection] = useState('');
  const [comparisonProfile, setComparisonProfile] = useState(null);

  useEffect(() => {
    const linkedEnrollment = accessRecord?.latestEnrollment;
    if (linkedEnrollment !== null && linkedEnrollment !== undefined && profile.numberOfStudentsSource !== 'manual' && (String(profile.numberOfStudents ?? '') !== String(linkedEnrollment) || profile.numberOfStudentsSource !== 'access')) {
      setProfile((current) => current.numberOfStudentsSource === 'manual' ? current : { ...current, numberOfStudents: linkedEnrollment, numberOfStudentsSource: 'access' });
    }
    if (!sourcePrefill) return;
    if (hasSavedProfile) {
      const missingFields = Object.entries(sourcePrefill).filter(([field]) => !Object.hasOwn(profile, field));
      if (missingFields.length) setProfile((current) => ({ ...Object.fromEntries(missingFields), ...current }));
      return;
    }
    if (Object.keys(profile).length) return;
    setProfile(sourcePrefill);
    setIsEditing(false);
  }, [sourcePrefill, hasSavedProfile, profile]);
  const [message, setMessage] = useState('');
  const groups = ibtidaGroupsForModel(profile.model);

  function update(field, value) {
    setProfile((current) => ({ ...current, [field]: value, ...(field === 'numberOfStudents' ? { numberOfStudentsSource: 'manual' } : {}) }));
  }

  function updateTeacher(index, field, value) {
    setProfile((current) => ({ ...current, teachers: (current.teachers || []).map((teacher, teacherIndex) => teacherIndex === index ? { ...teacher, [field]: value } : teacher) }));
  }

  function addTeacher() {
    setProfile((current) => ({ ...current, teachers: [...(current.teachers || []), { name: '', itrebTraining: '', otherTraining: '', experienceYears: '' }] }));
  }

  function removeTeacher(index) {
    setProfile((current) => ({ ...current, teachers: (current.teachers || []).filter((_, teacherIndex) => teacherIndex !== index) }));
  }

  function saveProfile() {
    try {
      const allProfiles = JSON.parse(window.localStorage.getItem('ecd-resource-hub.ibtida-classrooms') || '{}');
      allProfiles[profileId] = { ...profile, sectionConfirmations: {}, updatedAt: new Date().toISOString(), reviewedAt: '' };
      window.localStorage.setItem('ecd-resource-hub.ibtida-classrooms', JSON.stringify(allProfiles));
      setProfile(allProfiles[profileId]);
      setHasSavedProfile(true);
      setIsEditing(false);
      setMessage('Ibtida classroom details saved. Review the details and confirm when ready.');
    } catch {
      setMessage('The classroom details could not be saved in this browser.');
    }
  }

  function beginSectionChange(title) {
    setComparisonProfile({ ...profile, teachers: profile.teachers ? profile.teachers.map((teacher) => ({ ...teacher })) : [] });
    setEditingSection(title);
  }

  function cancelSectionChange() {
    if (comparisonProfile) setProfile(comparisonProfile);
    setComparisonProfile(null);
    setEditingSection('');
  }

  function confirmSection(title) {
    const timestamp = new Date().toISOString();
    try {
      const confirmations = { ...(profile.sectionConfirmations || {}) };
      if (!profile.sectionConfirmations && profile.reviewedAt) groups.forEach((group) => { confirmations[group.title] = profile.reviewedAt; });
      confirmations[title] = timestamp;
      const updated = { ...profile, sectionConfirmations: confirmations, reviewedAt: '', updatedAt: timestamp };
      const allProfiles = JSON.parse(window.localStorage.getItem('ecd-resource-hub.ibtida-classrooms') || '{}');
      allProfiles[profileId] = updated;
      window.localStorage.setItem('ecd-resource-hub.ibtida-classrooms', JSON.stringify(allProfiles));
      setProfile(updated);
      setHasSavedProfile(true);
      setComparisonProfile(null);
      setEditingSection('');
      setMessage(title + ' confirmed.');
    } catch {
      setMessage('This section could not be saved in this browser.');
    }
  }

  function sectionIsConfirmed(title) {
    if (profile.sectionConfirmations && Object.prototype.hasOwnProperty.call(profile.sectionConfirmations, title)) return Boolean(profile.sectionConfirmations[title]);
    return Boolean(profile.reviewedAt);
  }

  function renderField(field) {
    const value = profile[field.id] || '';
    if (field.type === 'model') return <select required value={value} onChange={(event) => update(field.id, event.target.value)}><option value="">Select a model</option>{ibtidaModels.map((model) => <option key={model}>{model}</option>)}</select>;
    if (field.type === 'recordStatus') return <select value={value} onChange={(event) => update(field.id, event.target.value)}><option value="Not recorded">Not recorded</option><option>Yes</option><option>No</option></select>;
    if (field.type === 'yesno') return <select value={value} onChange={(event) => update(field.id, event.target.value)}><option value="">Choose</option><option>Yes</option><option>No</option><option>Not observed</option></select>;
    if (field.type === 'check') return <label className="ibtida-tick-choice"><input type="checkbox" checked={value === 'Yes'} onChange={(event) => update(field.id, event.target.checked ? 'Yes' : 'No')} /><span>Available</span></label>;
    if (field.type === 'checkQuantity') return <div className="ibtida-tick-quantity"><label className="ibtida-tick-choice"><input type="checkbox" checked={value === 'Yes'} onChange={(event) => update(field.id, event.target.checked ? 'Yes' : 'No')} /><span>Available</span></label>{value === 'Yes' && <input type="number" min="0" aria-label={field.label + ' quantity'} placeholder="Quantity" value={profile[field.id + 'Quantity'] || ''} onChange={(event) => update(field.id + 'Quantity', event.target.value)} />}</div>;
    if (field.type === 'textarea') return <textarea rows="3" value={value} onChange={(event) => update(field.id, event.target.value)} />;
    return <input type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'} min={field.type === 'number' ? '0' : undefined} value={value} onChange={(event) => update(field.id, event.target.value)} />;
  }

  function sectionSummary(group, values) {
    if (group.title === 'Teacher details & training') return (values.teachers || []).length
      ? <div className="teacher-summary-list">{values.teachers.map((teacher, index) => <article className="teacher-summary" key={index}><b>{teacher.name || 'Teacher ' + (index + 1)}</b><span>ITREB training: {teacher.itrebTraining || 'Not recorded'}</span><span>Other training: {teacher.otherTraining || 'Not recorded'}</span><span>Experience: {teacher.experienceYears ? teacher.experienceYears + ' years' : 'Not recorded'}</span></article>)}</div>
      : <p className="teacher-empty">No teachers recorded yet.</p>;
    return <dl>{group.fields.map((field) => <div key={field.id}><dt>{field.label}</dt><dd>{displayIbtidaValue(values, field)}</dd>{historicalFieldContext(sourceRecord, field.id) && <small className="ibtida-field-history">{historicalFieldContext(sourceRecord, field.id)}</small>}</div>)}</dl>;
  }

  function sectionEditor(group) {
    if (group.title === 'Teacher details & training') return <>
      {(profile.teachers || []).map((teacher, index) => <div className="teacher-record" key={index}><div className="teacher-record-heading"><b>Teacher {index + 1}</b><button type="button" className="teacher-remove-button" onClick={() => removeTeacher(index)}>Remove</button></div><div className="ibtida-field-grid">
        <label className="form-field">Teacher name<input value={teacher.name || ''} onChange={(event) => updateTeacher(index, 'name', event.target.value)} /></label>
        <label className="form-field">Training attended through ITREB<textarea rows="2" value={teacher.itrebTraining || ''} onChange={(event) => updateTeacher(index, 'itrebTraining', event.target.value)} /></label>
        <label className="form-field">Any other training<textarea rows="2" value={teacher.otherTraining || ''} onChange={(event) => updateTeacher(index, 'otherTraining', event.target.value)} /></label>
        <label className="form-field">Years of experience<input type="number" min="0" step="0.5" value={teacher.experienceYears || ''} onChange={(event) => updateTeacher(index, 'experienceYears', event.target.value)} /></label>
      </div></div>)}
      <button type="button" className="add-teacher-button" onClick={addTeacher}><Plus size={14} />Add teacher</button>
    </>;
    return <div className="ibtida-field-grid">{group.fields.map((field) => <div className={'form-field ibtida-field-' + (field.type || 'text')} key={field.id}><span className="ibtida-field-label">{field.label}</span>{renderField(field)}{historicalFieldContext(sourceRecord, field.id) && <small className="ibtida-field-history">{historicalFieldContext(sourceRecord, field.id)}</small>}</div>)}</div>;
  }

  return <section className="panel-section ibtida-classroom-form">
    <div className="ibtida-form-heading"><div><div className="eyebrow">CLASSROOM PROFILE · IBTIDA</div><h2>{recName}</h2><p>{region} · {localBoard}</p>{!isEditing && <small className="ibtida-model-label">{profile.model}</small>}</div></div>
    {sourceRecord && !hasSavedProfile && <p className="ibtida-prefill-notice">Prefilled from available Ibtida records. Review or edit the survey details, then save and confirm.</p>}
    {message && <p className="data-import-message">{message}</p>}
    {isEditing ? <form className="ibtida-groups-form" onSubmit={(event) => { event.preventDefault(); saveProfile(); }}>
      {groups.map((group) => group.title === 'Teacher details & training' ? <fieldset className="ibtida-field-group teacher-details-group" key={group.title}><legend>{group.title}</legend>
        {(profile.teachers || []).map((teacher, index) => <div className="teacher-record" key={index}><div className="teacher-record-heading"><b>Teacher {index + 1}</b><button type="button" className="teacher-remove-button" onClick={() => removeTeacher(index)}>Remove</button></div>
          <div className="ibtida-field-grid">
            <label className="form-field">Teacher name<input value={teacher.name || ''} onChange={(event) => updateTeacher(index, 'name', event.target.value)} /></label>
            <label className="form-field">Training attended through ITREB<textarea rows="2" value={teacher.itrebTraining || ''} onChange={(event) => updateTeacher(index, 'itrebTraining', event.target.value)} /></label>
            <label className="form-field">Any other training<textarea rows="2" value={teacher.otherTraining || ''} onChange={(event) => updateTeacher(index, 'otherTraining', event.target.value)} /></label>
            <label className="form-field">Years of experience<input type="number" min="0" step="0.5" value={teacher.experienceYears || ''} onChange={(event) => updateTeacher(index, 'experienceYears', event.target.value)} /></label>
          </div>
        </div>)}
        <button type="button" className="add-teacher-button" onClick={addTeacher}><Plus size={14} />Add teacher</button>
      </fieldset> : <fieldset className="ibtida-field-group" key={group.title}><legend>{group.title}</legend><div className="ibtida-field-grid">{group.fields.map((field) => <div className={'form-field ibtida-field-' + (field.type || 'text')} key={field.id}><span className="ibtida-field-label">{field.label}</span>{renderField(field)}{historicalFieldContext(sourceRecord, field.id) && <small className="ibtida-field-history">{historicalFieldContext(sourceRecord, field.id)}</small>}</div>)}</div></fieldset>)}
      <div className="dialog-actions"><button className="add-resource-button" type="submit"><FileText size={15} />Save classroom details</button></div>
    </form> : <>
      <div className="ibtida-saved-groups">{groups.map((group) => {
        const isConfirmed = sectionIsConfirmed(group.title);
        if (editingSection === group.title) return <section className="ibtida-saved-group ibtida-review-card ibtida-editing-card" key={group.title}>
          <h3>{group.title} · review changes</h3>
          <div className="ibtida-side-by-side">
            <div className="ibtida-compare-pane"><h4>Available information</h4>{sectionSummary(group, comparisonProfile || profile)}</div>
            <div className="ibtida-compare-pane ibtida-change-pane"><h4>Change information</h4>{sectionEditor(group)}</div>
          </div>
          <div className="ibtida-section-actions"><button type="button" className="cancel-button" onClick={cancelSectionChange}>Cancel</button><button type="button" className="confirm-review-button" onClick={() => confirmSection(group.title)}>Confirm changes ✓</button></div>
        </section>;
        return <section className={'ibtida-saved-group ibtida-review-card ' + (isConfirmed ? 'is-confirmed' : 'needs-confirmation')} key={group.title}>
          <div className="ibtida-section-heading"><h3>{group.title}</h3><div className="ibtida-section-status">{isConfirmed ? <span className="ibtida-green-check">✓ Confirmed</span> : <span className="ibtida-pending-check">Review needed</span>}<button type="button" className="ibtida-change-button" onClick={() => beginSectionChange(group.title)}>Change</button></div></div>
          {sectionSummary(group, profile)}
          <div className="ibtida-section-actions"><button type="button" className={isConfirmed ? 'confirm-review-button ibtida-confirmed-button' : 'confirm-review-button'} onClick={() => confirmSection(group.title)}>{isConfirmed ? '✓ Confirmed' : 'Confirm this section'}</button></div>
        </section>;
      })}</div>
      <div className="ibtida-section-help">Review each section. Choose <b>Change</b> to compare the saved information with your updates side by side.</div>
    </>}
  </section>;
}

function RequestPanel({ requests, onCreate, onStatusChange }) {
  const [form, setForm] = useState({ resourceCategory: receiptCategories[0], resourceName: '', region: '', localBoard: '', recName: '', quantity: '', neededBy: '', reason: '' });
  const boardOptions = useMemo(() => [...new Set(recDirectory.filter((row) => row.region === form.region).map((row) => row.localBoard))].sort(), [form.region]);
  const recOptions = useMemo(() => recDirectory.filter((row) => row.region === form.region && row.localBoard === form.localBoard), [form.region, form.localBoard]);
  const today = localDateString();

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function submit(event) {
    event.preventDefault();
    onCreate({ ...form, quantity: Number(form.quantity) });
    setForm({ resourceCategory: receiptCategories[0], resourceName: '', region: '', localBoard: '', recName: '', quantity: '', neededBy: '', reason: '' });
  }

  return <section className="panel-section request-panel">
    <form className="request-form" onSubmit={submit}>
      <h2>Create a requirement ticket</h2>
      <div className="form-row"><label className="form-field">Resource type<select required value={form.resourceCategory} onChange={(event) => update('resourceCategory', event.target.value)}>{receiptCategories.map((category) => <option key={category}>{category}</option>)}</select></label><label className="form-field">Resource name<input required maxLength={120} value={form.resourceName} onChange={(event) => update('resourceName', event.target.value)} placeholder="Name of requested item" /></label></div>
      <div className="form-row"><label className="form-field">Region<select required value={form.region} onChange={(event) => setForm((current) => ({ ...current, region: event.target.value, localBoard: '', recName: '' }))}><option value="">Select a region</option>{regions.map((region) => <option key={region}>{region}</option>)}</select></label><label className="form-field">Local Board<select required disabled={!form.region} value={form.localBoard} onChange={(event) => setForm((current) => ({ ...current, localBoard: event.target.value, recName: '' }))}><option value="">Select a local board</option>{boardOptions.map((board) => <option key={board}>{board}</option>)}</select></label></div>
      <div className="form-row"><label className="form-field">REC<select required disabled={!form.localBoard} value={form.recName} onChange={(event) => update('recName', event.target.value)}><option value="">Select an REC</option>{recOptions.map((row) => <option key={row.recName}>{row.recName}</option>)}</select></label><label className="form-field">Quantity<input type="number" min="1" step="1" required value={form.quantity} onChange={(event) => update('quantity', event.target.value)} /></label></div>
      <div className="form-row"><label className="form-field">Required by<input type="date" min={today} required value={form.neededBy} onChange={(event) => update('neededBy', event.target.value)} /></label><label className="form-field">Reason or notes<input maxLength={200} value={form.reason} onChange={(event) => update('reason', event.target.value)} placeholder="Optional details" /></label></div>
      <div className="dialog-actions"><button type="submit" className="add-resource-button"><Plus size={15} />Generate request ticket</button></div>
    </form>
    <div className="request-list"><div className="history-heading"><div><div className="eyebrow">REQUEST TRACKER</div><h2>Requirement tickets</h2></div><span>{requests.length} total</span></div>
      {requests.length ? requests.map((request) => <article className="request-ticket" key={request.id}><div className="request-ticket-heading"><div><b>{request.resourceName}</b><small>{request.resourceCategory} · {request.region} · {request.localBoard} · {request.recName}</small></div><strong>{request.id}</strong></div><div className="request-ticket-details"><span>Quantity: <b>{request.quantity}</b></span><span>Needed by: <b>{request.neededBy}</b></span><label>Status<select value={request.status} onChange={(event) => onStatusChange(request.id, event.target.value)}><option>Submitted</option><option>Under review</option><option>Approved</option><option>Fulfilled</option><option>Declined</option></select></label></div>{request.reason && <p>{request.reason}</p>}</article>) : <div className="empty-state"><Boxes size={24} /><b>No request tickets yet</b><span>Complete the form above to create the first one.</span></div>}
    </div>
  </section>;
}


function ResourceDialog({ initial, onClose, onSave }) {
  const [form, setForm] = useState(() => ({
    title: initial?.title || '',
    type: initial?.type || 'Curriculum',
    description: initial?.description || '',
    format: initial?.format || 'PDF',
    age: initial?.age || '',
  }));

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function submit(event) {
    event.preventDefault();
    onSave({ ...form, color: initial?.color || colors[Math.floor(Math.random() * colors.length)] });
  }

  return <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="resource-dialog" role="dialog" aria-modal="true" aria-labelledby="resource-dialog-title">
      <div className="dialog-heading"><div><div className="eyebrow">RESOURCE DETAILS</div><h2 id="resource-dialog-title">{initial ? 'Edit resource' : 'Add a resource'}</h2></div><button className="dialog-close" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
      <form onSubmit={submit}>
        <label className="form-field">Resource name<input autoFocus required maxLength={120} value={form.title} onChange={(event) => update('title', event.target.value)} placeholder="e.g. Early Years Curriculum" /></label>
        <label className="form-field">Collection<select required value={form.type} onChange={(event) => update('type', event.target.value)}>{categories.slice(1).map(({ name }) => <option key={name}>{name}</option>)}</select></label>
        <label className="form-field">Description<textarea rows="3" maxLength={300} value={form.description} onChange={(event) => update('description', event.target.value)} placeholder="What is this resource for?" /></label>
        <div className="form-row"><label className="form-field">File type<select value={form.format} onChange={(event) => update('format', event.target.value)}><option>PDF</option><option>Guide</option><option>Inventory</option><option>Other</option></select></label><label className="form-field">Age group<input maxLength={40} value={form.age} onChange={(event) => update('age', event.target.value)} placeholder="e.g. Ages 3–5" /></label></div>
        <div className="dialog-actions"><button type="button" className="cancel-button" onClick={onClose}>Cancel</button><button type="submit" className="add-resource-button"><Plus size={15} />{initial ? 'Save changes' : 'Add resource'}</button></div>
      </form>
    </section>
  </div>;
}

function ReceiptDialog({ initial, onClose, onSave }) {
  const today = localDateString();
  const [stage, setStage] = useState(initial ? (initial.stage ?? 4) : 0);
  const [form, setForm] = useState(() => ({
    resourceCategory: 'Ibtida Guidebook', resourceName: 'Ibtida Guidebook',
    dispatchReference: '', headOfficeDispatchDate: today, headOfficeDispatchQuantity: '', headOfficeDispatchedBy: '',
    region: '', regionReceivedDate: '', regionReceivedQuantity: '', regionReceivedBy: '', regionReceiptDeadline: '',
    localBoard: '', recName: '', recDispatchDate: '', forwardedQuantity: '', regionDispatchedBy: '', regionDispatchDeadline: '',
    recReceivedDate: '', recReceivedQuantity: '', recReceivedName: '', recReceivedDesignation: '', recAcknowledgement: '', recReceiptDeadline: '', notes: '', timeline: [],
    ...initial,
  }));
  const boardOptions = useMemo(() => [...new Set(recDirectory.filter((row) => row.region === form.region).map((row) => row.localBoard))].sort(), [form.region]);
  const recOptions = useMemo(() => recDirectory.filter((row) => row.region === form.region && row.localBoard === form.localBoard), [form.region, form.localBoard]);
  const stepNames = ['Head Office dispatch', 'Region receipt', 'Region dispatch to REC', 'REC receipt'];
  const deadlineFields = ['regionReceiptDeadline', 'regionDispatchDeadline', 'recReceiptDeadline', null];
  const quantityError = stage === 1 && Number(form.regionReceivedQuantity) > Number(form.headOfficeDispatchQuantity)
    ? 'The region receipt quantity cannot exceed the Head Office dispatch quantity.'
    : stage === 2 && Number(form.forwardedQuantity) > Number(form.regionReceivedQuantity)
      ? 'The quantity sent to the REC cannot exceed the quantity received by the region.'
      : stage === 3 && form.recAcknowledgement !== 'not-received' && Number(form.recReceivedQuantity) > Number(form.forwardedQuantity)
        ? 'The REC receipt quantity cannot exceed the quantity dispatched by the region.' : '';

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function submit(event) {
    event.preventDefault();
    if (quantityError) return;
    const next = { ...form };
    if (stage === 0) next.headOfficeDispatchQuantity = Number(form.headOfficeDispatchQuantity);
    if (stage === 1) next.regionReceivedQuantity = Number(form.regionReceivedQuantity);
    if (stage === 2) next.forwardedQuantity = Number(form.forwardedQuantity);
    if (stage === 3) next.recReceivedQuantity = form.recAcknowledgement === 'not-received' ? 0 : Number(form.recReceivedQuantity);
    const timelineNames = ['Head Office dispatched resources to the region', 'Region confirmed receipt from Head Office', 'Region dispatched resources to the REC', form.recAcknowledgement === 'not-received' ? 'REC reported the resource was not received' : 'REC confirmed receipt from the region'];
                const timeline = [...(form.timeline || []), { stage: stage + 1, event: timelineNames[stage], deadline: form[deadlineFields[stage]], completedAt: new Date().toISOString(), status: stage === 3 ? form.recAcknowledgement : 'completed', acknowledgement: stage === 3 ? form.recAcknowledgement : undefined }];
    const createAnother = event.nativeEvent.submitter?.value === 'save-and-new';
    onSave({ ...next, timeline, stage: stage + 1 }, initial?.id, createAnother);
  }

  return <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="resource-dialog receipt-dialog" role="dialog" aria-modal="true" aria-labelledby="receipt-dialog-title">
      <div className="dialog-heading"><div><div className="eyebrow">ECD RESOURCE DISTRIBUTION</div><h2 id="receipt-dialog-title">{initial ? 'Continue acknowledgement' : 'New receipt'}</h2><p className="dialog-subtitle">Record resources, quantities, and deadlines for each handoff.</p></div><button className="dialog-close" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
      <form onSubmit={submit}>
        <div className="receipt-stepper">{stepNames.map((name, index) => <div key={name} className={`receipt-step stage-${index + 1} ${index === stage ? 'current' : index < stage ? 'done' : ''}`}><span>{index < stage ? '✓' : `0${index + 1}`}</span><small>{name}</small></div>)}</div>

        <div className={`receipt-section-title stage-panel stage-panel-${stage + 1}`}><span>0{stage + 1}</span><div><b>{stepNames[stage]}</b><small>{['Record the shipment sent from Head Office.', 'Confirm what the regional office received.', 'Select an REC and record the regional shipment.', 'Confirm what the REC received.'][stage]}</small></div></div>
        {stage === 0 && <>
          <div className="form-row"><label className="form-field">Resource type<select required value={form.resourceCategory} onChange={(event) => update('resourceCategory', event.target.value)}>{receiptCategories.map((category) => <option key={category}>{category}</option>)}</select></label><label className="form-field">Resource name<input required maxLength="120" value={form.resourceName} onChange={(event) => update('resourceName', event.target.value)} placeholder="e.g. Ibtida Guidebook" /></label></div>
          <div className="form-row"><label className="form-field">Dispatch reference<input maxLength={80} value={form.dispatchReference} onChange={(event) => update('dispatchReference', event.target.value)} placeholder="Optional reference number" /></label><label className="form-field">Dispatch date<input type="date" required value={form.headOfficeDispatchDate} onChange={(event) => update('headOfficeDispatchDate', event.target.value)} /></label></div>
          <label className="form-field">Destination region<select required value={form.region} onChange={(event) => setForm((current) => ({ ...current, region: event.target.value, localBoard: '', recName: '' }))}><option value="">Select a region</option>{regions.map((region) => <option key={region}>{region}</option>)}</select></label>
          <div className="form-row"><label className="form-field">Quantity dispatched<input type="number" required min="1" step="1" value={form.headOfficeDispatchQuantity} onChange={(event) => update('headOfficeDispatchQuantity', event.target.value)} placeholder="Quantity" /></label><label className="form-field">Dispatched by<input required maxLength={100} value={form.headOfficeDispatchedBy} onChange={(event) => update('headOfficeDispatchedBy', event.target.value)} placeholder="Name and designation" /></label></div>


          <label className="form-field">Region receipt deadline<input type="date" required value={form.regionReceiptDeadline} onChange={(event) => update('regionReceiptDeadline', event.target.value)} /></label>
        </>}
        {stage === 1 && <>
          <label className="form-field">Region<input readOnly value={form.region} /></label>
          <div className="form-row"><label className="form-field">Date received at region<input type="date" required value={form.regionReceivedDate} onChange={(event) => update('regionReceivedDate', event.target.value)} /></label><label className="form-field">Quantity received<input type="number" required min="1" step="1" max={form.headOfficeDispatchQuantity || undefined} value={form.regionReceivedQuantity} onChange={(event) => update('regionReceivedQuantity', event.target.value)} placeholder="Quantity" /></label></div>
          <div className="form-row"><label className="form-field">Received by at regional office<input required maxLength="100" value={form.regionReceivedBy} onChange={(event) => update('regionReceivedBy', event.target.value)} placeholder="Name and designation" /></label><label className="form-field">REC dispatch deadline<input type="date" required value={form.regionDispatchDeadline} onChange={(event) => update('regionDispatchDeadline', event.target.value)} /></label></div>


        </>}
        {stage === 2 && <>
          <label className="form-field">Local Board<select required value={form.localBoard} onChange={(event) => setForm((current) => ({ ...current, localBoard: event.target.value, recName: '' }))}><option value="">Select a local board</option>{boardOptions.map((board) => <option key={board}>{board}</option>)}</select></label>
          <label className="form-field">REC<select required disabled={!form.localBoard} value={form.recName} onChange={(event) => update('recName', event.target.value)}><option value="">{form.localBoard ? 'Select an REC' : 'Select a local board first'}</option>{recOptions.map((row) => <option key={row.recName}>{row.recName}</option>)}</select></label>
          <div className="form-row"><label className="form-field">Dispatch date to REC<input type="date" required value={form.recDispatchDate} onChange={(event) => update('recDispatchDate', event.target.value)} /></label><label className="form-field">Quantity dispatched<input type="number" required min="1" step="1" max={form.regionReceivedQuantity || undefined} value={form.forwardedQuantity} onChange={(event) => update('forwardedQuantity', event.target.value)} placeholder="Quantity" /></label></div>
          <div className="form-row"><label className="form-field">Dispatched by at regional office<input required maxLength="100" value={form.regionDispatchedBy} onChange={(event) => update('regionDispatchedBy', event.target.value)} placeholder="Name and designation" /></label><label className="form-field">REC receipt deadline<input type="date" required value={form.recReceiptDeadline} onChange={(event) => update('recReceiptDeadline', event.target.value)} /></label></div>


        </>}
        {stage === 3 && <>
          <div className="form-row"><label className="form-field">Region<input readOnly value={form.region} /></label><label className="form-field">REC<input readOnly value={form.recName} /></label></div>
          <label className="form-field">Acknowledgement<select required value={form.recAcknowledgement} onChange={(event) => update('recAcknowledgement', event.target.value)}><option value="">Select acknowledgement</option><option value="received-within-deadline">Received within deadline</option><option value="received-after-deadline">Received after deadline</option><option value="not-received">Not received</option></select></label>
          {form.recAcknowledgement !== 'not-received' && <>
            <div className="form-row"><label className="form-field">Date received at REC<input type="date" required value={form.recReceivedDate} onChange={(event) => update('recReceivedDate', event.target.value)} /></label><label className="form-field">Quantity received<input type="number" required min="1" step="1" max={form.forwardedQuantity || undefined} value={form.recReceivedQuantity} onChange={(event) => update('recReceivedQuantity', event.target.value)} placeholder="Quantity" /></label></div>
            <div className="form-row"><label className="form-field">Receiver name<input required maxLength="100" value={form.recReceivedName} onChange={(event) => update('recReceivedName', event.target.value)} placeholder="Full name" /></label><label className="form-field">Designation<input required maxLength="100" value={form.recReceivedDesignation} onChange={(event) => update('recReceivedDesignation', event.target.value)} placeholder="Role or designation" /></label></div>
          </>}


          <label className="form-field">Notes<textarea rows="2" maxLength="300" value={form.notes} onChange={(event) => update('notes', event.target.value)} placeholder="Optional delivery notes or condition" /></label>
        </>}
        {quantityError && <p className="form-error">{quantityError}</p>}
        <div className="dialog-actions receipt-dialog-actions"><button type="button" className="cancel-button" onClick={onClose}>Close</button><button type="submit" name="save-and-new" value="save-and-new" className="save-and-new-button" disabled={Boolean(quantityError)}><Plus size={15} />Save stage &amp; create another receipt</button><button type="submit" className="add-resource-button" disabled={Boolean(quantityError)}><FileText size={15} />{stage === 3 ? 'Complete receipt' : `Save and continue to stage ${stage + 2}`}</button></div>
      </form>
    </section>
  </div>;
}

function ReceiptTimeline({ receipt }) {
  const labels = ['Head Office dispatch to region', 'Region receipt confirmation', 'Region dispatch to REC', 'REC receipt confirmation'];
  const deadlineKeys = [null, 'regionReceiptDeadline', 'regionDispatchDeadline', 'recReceiptDeadline'];
  const today = localDateString();
  return <section className="receipt-timeline"><h3>Delivery timeline</h3>{labels.map((label, index) => {
    const event = (receipt.timeline || []).find((item) => item.stage === index + 1 && item.kind !== 'reminder');
    const deadline = receipt[deadlineKeys[index]] || event?.deadline;
    const overdue = !event && deadline && deadline < today;
    const acknowledgement = event?.acknowledgement === 'not-received' ? ' · Not received' : event?.acknowledgement === 'received-after-deadline' ? ' · Received after deadline' : event?.acknowledgement === 'received-within-deadline' ? ' · Received within deadline' : '';
    return <div className={`timeline-event stage-${index + 1} ${overdue ? 'overdue' : ''}`} key={label}><span className="timeline-marker">{event ? '✓' : index + 1}</span><div><b>{label}</b><small>{event ? `Completed ${new Date(event.completedAt).toLocaleString()}${acknowledgement}` : `Due ${deadline || 'not set'} · ${overdue ? 'OVERDUE' : deadline === today ? 'DUE TODAY' : 'Pending'}`}</small>{!event && deadline && !overdue && <button type="button" className="calendar-reminder-button" onClick={() => downloadCalendarReminder(receipt, index + 1, label, deadline)}><CalendarPlus size={13} />Add to calendar</button>}</div></div>;
  })}</section>;
}

function acknowledgementLabel(value) {
  return ({ 'received-within-deadline': 'Received within deadline', 'received-after-deadline': 'Received after deadline', 'not-received': 'Not received' })[value] || 'Not recorded';
}

function ReceiptPreview({ receipt, onClose }) {
  return <div className="dialog-backdrop receipt-preview-backdrop">
    <section className="receipt-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="receipt-preview-title">
      <div className="preview-toolbar"><span>Receipt saved · {receipt.id}</span><div><button className="print-button" onClick={() => window.print()}><Printer size={15} /> Print / Save PDF</button><button className="dialog-close" onClick={onClose} aria-label="Close"><X size={18} /></button></div></div>
      <article className="print-sheet" id="receipt-print-sheet">
        <div className="receipt-org">ITREB PAKISTAN · ECED RE DEPARTMENT</div>
        <h1 id="receipt-preview-title">Acknowledgement of Receipt</h1>
        <h2>{receipt.resourceName || 'Ibtida Guidebook'}</h2>
        <div className="receipt-number">Receipt No. <b>{receipt.id}</b></div>
        <p className="receipt-statement">{receipt.recAcknowledgement === 'not-received' ? `The REC acknowledged that ${receipt.resourceName || 'the resource'} was not received.` : `This receipt records the dispatch and receipt of ${receipt.resourceName || 'the resource'} through the selected delivery route.`}</p>
        <table className="receipt-table"><tbody>
          <tr><th>Region</th><td>{receipt.region}</td><th>Dispatch reference</th><td>{receipt.dispatchReference || '—'}</td></tr>
          <tr><th>Head Office dispatch</th><td>{receipt.headOfficeDispatchDate}</td><th>Quantity sent</th><td>{receipt.headOfficeDispatchQuantity}</td></tr>
          <tr><th>Head Office dispatched by</th><td>{receipt.headOfficeDispatchedBy}</td><th>Region received date</th><td>{receipt.regionReceivedDate}</td></tr>
          <tr><th>Region quantity received</th><td>{receipt.regionReceivedQuantity}</td><th>Regional recipient</th><td>{receipt.regionReceivedBy}</td></tr>
          <tr><th>Local Board</th><td>{receipt.localBoard}</td><th>REC</th><td>{receipt.recName}</td></tr>
          <tr><th>Region dispatch date</th><td>{receipt.recDispatchDate}</td><th>Quantity sent to REC</th><td>{receipt.forwardedQuantity}</td></tr>
          <tr><th>Regional dispatcher</th><td>{receipt.regionDispatchedBy}</td><th>REC received date</th><td>{receipt.recAcknowledgement === 'not-received' ? '—' : receipt.recReceivedDate}</td></tr>
          <tr><th>REC acknowledgement</th><td>{acknowledgementLabel(receipt.recAcknowledgement)}</td><th>Quantity received</th><td>{receipt.recAcknowledgement === 'not-received' ? '—' : receipt.recReceivedQuantity}</td></tr>
          <tr><th>Receiver name</th><td>{receipt.recReceivedName || '—'}</td><th>Designation</th><td>{receipt.recReceivedDesignation || '—'}</td></tr>





          {receipt.notes && <tr><th>Notes</th><td colSpan="3">{receipt.notes}</td></tr>}
        </tbody></table>
        <p className="receipt-confirmation">{receipt.recAcknowledgement === 'not-received' ? 'The REC contact named the delivery as not received.' : 'The named REC contact acknowledges receipt and the quantities recorded.'}</p>
        <div className="signature-grid"><div><span></span><b>Head Office dispatch officer</b><small>Name, signature, date</small></div><div><span></span><b>Regional receiving officer</b><small>Name, signature, date</small></div><div><span></span><b>Regional dispatch officer</b><small>Name, signature, date</small></div><div><span></span><b>REC receiving officer</b><small>Name, signature, date</small></div></div>
        <div className="receipt-footer">Generated in the ECD Resource Hub · {new Date(receipt.createdAt).toLocaleDateString()}</div>
      </article>
      <div className="preview-bottom"><button className="cancel-button" onClick={onClose}>Close</button><button className="add-resource-button" onClick={() => window.print()}><Printer size={15} />Print / Save PDF</button></div>
    </section>
  </div>;
}

export default App;

