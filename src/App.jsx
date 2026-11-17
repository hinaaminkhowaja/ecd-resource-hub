import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownToLine, BookOpen, Boxes, ChevronDown, CircleHelp,
  FileText, FolderOpen, LibraryBig, Pencil, Plus, Printer, Search,
  Settings2, Shapes, Sofa, Sparkles, Trash2, UsersRound, X,
} from 'lucide-react';
import recDirectory from './data/recs.json';
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

function App() {
  const [resources, setResources] = useState(() => readLocalList(RESOURCE_STORAGE_KEY));
  const [receipts, setReceipts] = useState(() => readLocalList(RECEIPT_STORAGE_KEY));
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

  useEffect(() => {
    window.localStorage.setItem(RESOURCE_STORAGE_KEY, JSON.stringify(resources));
  }, [resources]);

  useEffect(() => {
    window.localStorage.setItem(RECEIPT_STORAGE_KEY, JSON.stringify(receipts));
  }, [receipts]);

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
    const matchesSearch = `${item.title} ${item.description} ${item.type}`.toLowerCase().includes(query.toLowerCase());
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
      setNotice('Resource updated.');
    } else {
      setResources((current) => [...current, { ...form, id: crypto.randomUUID() }]);
      setNotice('Resource added.');
    }
    setResourceDialogOpen(false);
    setEditingResource(null);
  }

  function deleteResource(resource) {
    if (!window.confirm(`Delete “${resource.title}” from this library?`)) return;
    setResources((current) => current.filter((item) => item.id !== resource.id));
    setNotice('Resource deleted.');
  }

  async function saveReceipt(form, existingId, createAnother = false) {
    const existing = receipts.find((item) => item.id === existingId);
    let receipt = {
      ...existing,
      ...form,
      id: existingId || `IBT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    let mailStatus = 'unavailable';
    try {
      const response = await fetch('/api/receipts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ receipt }) });
      if (!response.ok) throw new Error('Receipt service unavailable');
      const result = await response.json();
      receipt = result.receipt || receipt;
      mailStatus = receipt.timeline?.find((event) => event.stage === receipt.stage && event.kind !== 'reminder')?.emailStatus || 'not-configured';
    } catch {
      // Keep the local record available when the receipt service is not running.
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
      setNotice(`Receipt ${receipt.id} saved. You can continue its next stage later.`);
    } else if (receipt.stage === 4) setSelectedReceipt(receipt);
    else setNotice(mailStatus === 'sent'
      ? `Stage ${receipt.stage} saved. Email sent to both contacts.`
      : mailStatus === 'not-configured'
        ? `Stage ${receipt.stage} saved. Email sending is not configured yet.`
        : mailStatus === 'failed' || mailStatus === 'no-recipients'
          ? `Stage ${receipt.stage} saved, but email could not be sent. Check the sender settings and both contact addresses.`
        : `Stage ${receipt.stage} saved in this browser. The receipt service is offline, so no emails or scheduled reminders can run.`);
  }

  async function retryReceiptEmail(receiptId, stage) {
    try {
      const response = await fetch(`/api/receipts/${encodeURIComponent(receiptId)}/retry-email`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage }) });
      if (!response.ok) throw new Error('Email retry failed');
      const result = await response.json();
      const updated = result.receipt;
      setReceipts((current) => current.map((item) => item.id === receiptId ? updated : item));
      setSelectedReceipt((current) => current?.id === receiptId ? updated : current);
      const event = updated.timeline.find((item) => item.stage === stage && item.kind !== 'reminder');
      setNotice(event?.emailStatus === 'sent' ? 'Email sent to both contacts.' : 'Email still could not be sent. Check the SMTP connection and contact addresses.');
    } catch {
      setNotice('The receipt service is unavailable, so the email could not be retried.');
    }
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#home" onClick={() => setActive('All resources')}>
        <span className="brand-mark"><Sparkles size={20} /></span>
        <span><strong>ecd</strong><small>RESOURCE HUB</small></span>
      </a>
      <div className="workspace-label">WORKSPACE</div>
      <button className="workspace"><span className="workspace-avatar">R</span><span><b>RECS collection</b><small>Resource library</small></span><ChevronDown size={16} /></button>
      <div className="nav-heading">LIBRARY</div>
      <nav>{categories.map(({ name, icon: Icon }) => <button key={name} onClick={() => setActive(name)} className={`nav-item ${active === name ? 'selected' : ''}`}><Icon size={18} /><span>{name}</span>{name === 'All resources' && <span className="nav-count">{allResources.length}</span>}</button>)}</nav>
      <div className="nav-heading tools-heading">YOUR SPACE</div>
      <button className="nav-item" onClick={() => { setActive('All resources'); openAddResource(); }}><Plus size={18} /><span>Add a resource</span></button>
      <div className="sidebar-bottom">
        <div className="sync-card"><span className="sync-icon"><FolderOpen size={17} /></span><div><b>Connect your library</b><p>Link OneDrive to browse your RECS files.</p><button onClick={() => setNotice('OneDrive connection is planned. The current REC directory is a snapshot from master sheet.xlsx.')}>Set up connection <span>→</span></button></div></div>
        <button className="nav-item muted" onClick={() => setNotice('Help and support will be added to the resource hub.')}><CircleHelp size={18} /><span>Help & support</span></button>
        <button className="nav-item muted" onClick={() => setNotice('Settings will be available as the hub grows.')}><Settings2 size={18} /><span>Settings</span></button>
        <div className="profile"><div className="profile-avatar">H</div><div><b>RECS team</b><small>ECD programme</small></div><ChevronDown size={16} /></div>
      </div>
    </aside>

    <main className="main-area">
      <header className="topbar"><div className="breadcrumb">RECS collection <span>/</span> <b>{active}</b></div><div className="top-actions"><span className="online-dot"></span><span className="connection-text">Library workspace</span><button className="help-button" onClick={() => setNotice('Create a delivery receipt for curriculum, activity books, plans, furniture, or resource kits.')}>?</button></div></header>
      <div className="content">
        <section className="welcome-row"><div><div className="eyebrow">EARLY CHILDHOOD DEVELOPMENT</div><h1>Resources for every <em>little learner.</em></h1><p className="intro">Your RECS collection of ECD materials, teaching guides, and classroom essentials.</p></div><div className="welcome-art" aria-hidden="true"><span className="sun"></span><span className="arch"><i></i><b></b><small></small></span><span className="plant">✳</span><span className="book-stack"><i></i><b></b><small></small></span></div></section>
        <section className="stats-row"><div className="stat-card"><span className="stat-icon mint-icon"><LibraryBig size={19} /></span><div><b>{allResources.length}</b><small>resources in library</small></div></div><div className="stat-card"><span className="stat-icon peach-icon"><UsersRound size={19} /></span><div><b>{categories.length - 1}</b><small>resource collections</small></div></div><div className="stat-note"><span className="note-star">✳</span><span><b>Made for curious minds</b><small>Manage ECD materials and track delivery handoffs.</small></span></div></section>
        <section className="dashboard-receipt-launch"><div className="receipt-launch-copy"><span className="receipt-launch-icon"><FileText size={23} /></span><div><div className="eyebrow">DELIVERY RECEIPTS</div><h2>Track ECD resource deliveries</h2><p>Create a receipt for guidebooks, activity books, plans, furniture, and resource kits.</p></div></div><button className="receipt-launch-button" onClick={() => { setEditingReceipt(null); setReceiptDialogOpen(true); }}><Plus size={17} />Create a receipt</button></section>
                {receipts.length > 0 && <section className="receipt-history dashboard-delivery-history"><div className="history-heading"><div><div className="eyebrow">DELIVERY WORKFLOW</div><h3>Recent delivery receipts</h3></div><span>{receipts.length} saved</span></div><div className="history-list">{receipts.slice(0, 5).map((receipt) => <button className="history-row" key={receipt.id} onClick={() => { if ((receipt.stage ?? 4) >= 4) setSelectedReceipt(receipt); else { setEditingReceipt(receipt); setReceiptDialogOpen(true); } }}><span><b>{receipt.resourceName || receipt.resourceCategory || 'ECD resource'}</b><small>{receipt.region}{receipt.localBoard ? ` · ${receipt.localBoard}` : ''}{receipt.recName ? ` · ${receipt.recName}` : ''}</small></span><span className="history-quantity">{(receipt.stage ?? 4) >= 4 ? `${receipt.resourceCategory || 'Resource'} · Complete` : `Continue · stage ${receipt.stage} of 4`}</span><span className="history-id">{receipt.id}</span></button>)}</div></section>}
        <section className="library-section">
          <div className="section-heading"><div><div className="eyebrow">EXPLORE THE COLLECTION</div><h2>{active}</h2></div><button className="add-resource-button" onClick={openAddResource}><Plus size={16} /> Add resource</button></div>
          <div className="toolbar"><label className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search resources, topics, or materials…" /></label><label className="format-select"><span>Type</span><select value={format} onChange={(event) => setFormat(event.target.value)}><option>All formats</option><option>PDF</option><option>Guide</option><option>Inventory</option><option>Receipt form</option><option>Other</option></select><ChevronDown size={14} /></label></div>
          <div className="results-line"><span>{filtered.length} resources</span><span>REC directory <span className="tiny-dot">•</span> {regions.length} regions · {recDirectory.length.toLocaleString()} RECs</span></div>
          {filtered.length ? <div className="resource-grid">{filtered.map((item, index) => { const Icon = resourceIcons[item.type] || Shapes; const isBuiltIn = item.id === SYSTEM_RESOURCE_ID; return <article className={`resource-card ${isBuiltIn ? 'guidebook-card' : ''}`} key={item.id}><div className={`card-art ${item.color || colors[index % colors.length]}`}><div className="resource-symbol"><Icon size={27} strokeWidth={1.5} /></div><span className="age-pill">{item.age || 'ECD'}</span></div><div className="card-body"><div className="card-type">{item.type}</div><h3>{isBuiltIn ? <button className="card-title-button" onClick={() => setReceiptDialogOpen(true)}>{item.title}</button> : item.title}</h3><p>{item.description || 'No description added'}</p><div className="card-footer"><span><FileText size={14} />{item.format}</span>{isBuiltIn ? <button className="receipt-link" onClick={() => setReceiptDialogOpen(true)}>Create receipt <span>→</span></button> : <div className="resource-actions"><button onClick={() => { setEditingResource(item); setResourceDialogOpen(true); }} aria-label={`Edit ${item.title}`}><Pencil size={13} /> Edit</button><button className="delete-action" onClick={() => deleteResource(item)} aria-label={`Delete ${item.title}`}><Trash2 size={13} /> Delete</button></div>}</div></div></article>; })}</div> : <div className="empty-state"><Search size={24} /><b>No matching resources</b><span>Try another search or choose a different collection.</span></div>}
          <div className="source-note"><span className="source-mark"><FolderOpen size={17} /></span><span><b>REC dropdown source</b><small>Region, local board, and REC names imported from master sheet.xlsx. OneDrive refresh is not connected yet.</small></span><button onClick={() => setNotice('The app currently uses the imported master sheet snapshot. OneDrive integration can keep it current later.')}>Source details <span>→</span></button></div>
        </section>
        <footer>ECD RESOURCE HUB <span>·</span> A home for early learning resources</footer>
      </div>
    </main>
    {resourceDialogOpen && <ResourceDialog initial={editingResource} onClose={() => { setResourceDialogOpen(false); setEditingResource(null); }} onSave={saveResource} />}
    {receiptDialogOpen && <ReceiptDialog key={`${editingReceipt?.id || 'new'}-${receiptDialogInstance}`} initial={editingReceipt} onClose={() => { setReceiptDialogOpen(false); setEditingReceipt(null); }} onSave={saveReceipt} onRetry={retryReceiptEmail} />}
    {selectedReceipt && <ReceiptPreview receipt={selectedReceipt} onClose={() => setSelectedReceipt(null)} onRetry={retryReceiptEmail} />}
    {notice && <div className="toast" role="status"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss">×</button></div>}
  </div>;
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

function ReceiptDialog({ initial, onClose, onSave, onRetry }) {
  const today = localDateString();
  const [stage, setStage] = useState(initial ? (initial.stage ?? 4) : 0);
  const [form, setForm] = useState(() => ({
    resourceCategory: 'Ibtida Guidebook', resourceName: 'Ibtida Guidebook',
    dispatchReference: '', headOfficeDispatchDate: today, headOfficeDispatchQuantity: '', headOfficeDispatchedBy: '', headOfficeSenderEmail: '', regionDispatchReceiverEmail: '',
    region: '', regionReceivedDate: '', regionReceivedQuantity: '', regionReceivedBy: '', regionSenderEmail: '', headOfficeReceiptReceiverEmail: '', regionReceiptDeadline: '',
    localBoard: '', recName: '', recDispatchDate: '', forwardedQuantity: '', regionDispatchedBy: '', regionDispatchSenderEmail: '', recDispatchReceiverEmail: '', regionDispatchDeadline: '',
    recReceivedDate: '', recReceivedQuantity: '', recReceivedBy: '', recReceiptSenderEmail: '', regionReceiptFinalEmail: '', recReceiptDeadline: '', notes: '', timeline: [],
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
      : stage === 3 && Number(form.recReceivedQuantity) > Number(form.forwardedQuantity)
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
    if (stage === 3) next.recReceivedQuantity = Number(form.recReceivedQuantity);
    const timelineNames = ['Head Office dispatched resources to the region', 'Region confirmed receipt from Head Office', 'Region dispatched resources to the REC', 'REC confirmed receipt from the region'];
    const senders = [form.headOfficeSenderEmail, form.headOfficeSenderEmail, form.regionDispatchSenderEmail, form.recReceiptSenderEmail];
    const receivers = [form.regionDispatchReceiverEmail, form.regionSenderEmail, form.recDispatchReceiverEmail, form.regionReceiptFinalEmail];
    const timeline = [...(form.timeline || []), { stage: stage + 1, event: timelineNames[stage], senderEmail: senders[stage], receiverEmail: receivers[stage], deadline: form[deadlineFields[stage]], completedAt: new Date().toISOString(), status: 'completed' }];
    const createAnother = event.nativeEvent.submitter?.value === 'save-and-new';
    onSave({ ...next, timeline, stage: stage + 1 }, initial?.id, createAnother);
  }

  return <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="resource-dialog receipt-dialog" role="dialog" aria-modal="true" aria-labelledby="receipt-dialog-title">
      <div className="dialog-heading"><div><div className="eyebrow">ECD RESOURCE DISTRIBUTION</div><h2 id="receipt-dialog-title">{initial ? 'Continue acknowledgement' : 'New receipt'}</h2><p className="dialog-subtitle">Record sender, receiver, and deadline for every handoff.</p></div><button className="dialog-close" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
      <form onSubmit={submit}>
        <div className="receipt-stepper">{stepNames.map((name, index) => <div key={name} className={`receipt-step stage-${index + 1} ${index === stage ? 'current' : index < stage ? 'done' : ''}`}><span>{index < stage ? '✓' : `0${index + 1}`}</span><small>{name}</small></div>)}</div>
        <div className="receipt-email-info"><b>Email addresses and delivery timeline</b><span>Enter both sender and receiver email addresses at each handoff, plus a due date. Completed stages are timestamped below. Automatic messages and delay reminders need a connected email service and an always-on backend.</span></div>
        <ReceiptTimeline receipt={form} onRetry={(stageNumber) => initial?.id && onRetry(initial.id, stageNumber)} />
        <div className={`receipt-section-title stage-panel stage-panel-${stage + 1}`}><span>0{stage + 1}</span><div><b>{stepNames[stage]}</b><small>{['Record the shipment sent from Head Office.', 'Confirm what the regional office received.', 'Select an REC and record the regional shipment.', 'Confirm what the REC received.'][stage]}</small></div></div>
        {stage === 0 && <>
          <div className="form-row"><label className="form-field">Resource type<select required value={form.resourceCategory} onChange={(event) => update('resourceCategory', event.target.value)}>{receiptCategories.map((category) => <option key={category}>{category}</option>)}</select></label><label className="form-field">Resource name<input required maxLength="120" value={form.resourceName} onChange={(event) => update('resourceName', event.target.value)} placeholder="e.g. Ibtida Guidebook" /></label></div>
          <div className="form-row"><label className="form-field">Dispatch reference<input maxLength={80} value={form.dispatchReference} onChange={(event) => update('dispatchReference', event.target.value)} placeholder="Optional reference number" /></label><label className="form-field">Dispatch date<input type="date" required value={form.headOfficeDispatchDate} onChange={(event) => update('headOfficeDispatchDate', event.target.value)} /></label></div>
          <label className="form-field">Destination region<select required value={form.region} onChange={(event) => setForm((current) => ({ ...current, region: event.target.value, localBoard: '', recName: '' }))}><option value="">Select a region</option>{regions.map((region) => <option key={region}>{region}</option>)}</select></label>
          <div className="form-row"><label className="form-field">Quantity dispatched<input type="number" required min="1" step="1" value={form.headOfficeDispatchQuantity} onChange={(event) => update('headOfficeDispatchQuantity', event.target.value)} placeholder="Quantity" /></label><label className="form-field">Dispatched by<input required maxLength={100} value={form.headOfficeDispatchedBy} onChange={(event) => update('headOfficeDispatchedBy', event.target.value)} placeholder="Name and designation" /></label></div>
          <div className="form-row"><label className="form-field">Sender email (Head Office)<input type="email" required value={form.headOfficeSenderEmail} onChange={(event) => update('headOfficeSenderEmail', event.target.value)} placeholder="sender@example.org" /></label><label className="form-field">Receiver email (Region)<input type="email" required value={form.regionDispatchReceiverEmail} onChange={(event) => update('regionDispatchReceiverEmail', event.target.value)} placeholder="region@example.org" /></label></div>
          <label className="form-field">Region receipt deadline<input type="date" required value={form.regionReceiptDeadline} onChange={(event) => update('regionReceiptDeadline', event.target.value)} /></label>
        </>}
        {stage === 1 && <>
          <label className="form-field">Region<input readOnly value={form.region} /></label>
          <div className="form-row"><label className="form-field">Date received at region<input type="date" required value={form.regionReceivedDate} onChange={(event) => update('regionReceivedDate', event.target.value)} /></label><label className="form-field">Quantity received<input type="number" required min="1" step="1" max={form.headOfficeDispatchQuantity || undefined} value={form.regionReceivedQuantity} onChange={(event) => update('regionReceivedQuantity', event.target.value)} placeholder="Quantity" /></label></div>
          <div className="form-row"><label className="form-field">Received by at regional office<input required maxLength="100" value={form.regionReceivedBy} onChange={(event) => update('regionReceivedBy', event.target.value)} placeholder="Name and designation" /></label><label className="form-field">REC dispatch deadline<input type="date" required value={form.regionDispatchDeadline} onChange={(event) => update('regionDispatchDeadline', event.target.value)} /></label></div>
          <div className="form-row"><label className="form-field">Sender email (Head Office)<input type="email" required value={form.headOfficeSenderEmail} onChange={(event) => update('headOfficeSenderEmail', event.target.value)} placeholder="region@example.org" /></label><label className="form-field">Receiver email (Region)<input type="email" required value={form.regionSenderEmail} onChange={(event) => update('regionSenderEmail', event.target.value)} placeholder="region@example.org" /></label></div>
        </>}
        {stage === 2 && <>
          <label className="form-field">Local Board<select required value={form.localBoard} onChange={(event) => setForm((current) => ({ ...current, localBoard: event.target.value, recName: '' }))}><option value="">Select a local board</option>{boardOptions.map((board) => <option key={board}>{board}</option>)}</select></label>
          <label className="form-field">REC<select required disabled={!form.localBoard} value={form.recName} onChange={(event) => update('recName', event.target.value)}><option value="">{form.localBoard ? 'Select an REC' : 'Select a local board first'}</option>{recOptions.map((row) => <option key={row.recName}>{row.recName}</option>)}</select></label>
          <div className="form-row"><label className="form-field">Dispatch date to REC<input type="date" required value={form.recDispatchDate} onChange={(event) => update('recDispatchDate', event.target.value)} /></label><label className="form-field">Quantity dispatched<input type="number" required min="1" step="1" max={form.regionReceivedQuantity || undefined} value={form.forwardedQuantity} onChange={(event) => update('forwardedQuantity', event.target.value)} placeholder="Quantity" /></label></div>
          <div className="form-row"><label className="form-field">Dispatched by at regional office<input required maxLength="100" value={form.regionDispatchedBy} onChange={(event) => update('regionDispatchedBy', event.target.value)} placeholder="Name and designation" /></label><label className="form-field">REC receipt deadline<input type="date" required value={form.recReceiptDeadline} onChange={(event) => update('recReceiptDeadline', event.target.value)} /></label></div>
          <div className="form-row"><label className="form-field">Sender email (Region)<input type="email" required value={form.regionDispatchSenderEmail} onChange={(event) => update('regionDispatchSenderEmail', event.target.value)} placeholder="region@example.org" /></label><label className="form-field">Receiver email (REC)<input type="email" required value={form.recDispatchReceiverEmail} onChange={(event) => update('recDispatchReceiverEmail', event.target.value)} placeholder="rec@example.org" /></label></div>
        </>}
        {stage === 3 && <>
          <div className="form-row"><label className="form-field">Region<input readOnly value={form.region} /></label><label className="form-field">REC<input readOnly value={form.recName} /></label></div>
          <div className="form-row"><label className="form-field">Date received at REC<input type="date" required value={form.recReceivedDate} onChange={(event) => update('recReceivedDate', event.target.value)} /></label><label className="form-field">Quantity received<input type="number" required min="1" step="1" max={form.forwardedQuantity || undefined} value={form.recReceivedQuantity} onChange={(event) => update('recReceivedQuantity', event.target.value)} placeholder="Quantity" /></label></div>
          <div className="form-row"><label className="form-field">Sender email (REC)<input type="email" required value={form.recReceiptSenderEmail} onChange={(event) => update('recReceiptSenderEmail', event.target.value)} placeholder="rec@example.org" /></label><label className="form-field">Receiver email (Region)<input type="email" required value={form.regionReceiptFinalEmail} onChange={(event) => update('regionReceiptFinalEmail', event.target.value)} placeholder="region@example.org" /></label></div>
          <label className="form-field">Notes<textarea rows="2" maxLength="300" value={form.notes} onChange={(event) => update('notes', event.target.value)} placeholder="Optional delivery notes or condition" /></label>
        </>}
        {quantityError && <p className="form-error">{quantityError}</p>}
        <div className="dialog-actions receipt-dialog-actions"><button type="button" className="cancel-button" onClick={onClose}>Close</button><button type="submit" name="save-and-new" value="save-and-new" className="save-and-new-button" disabled={Boolean(quantityError)}><Plus size={15} />Save stage &amp; create another receipt</button><button type="submit" className="add-resource-button" disabled={Boolean(quantityError)}><FileText size={15} />{stage === 3 ? 'Complete receipt' : `Save and continue to stage ${stage + 2}`}</button></div>
      </form>
    </section>
  </div>;
}

function ReceiptTimeline({ receipt, onRetry }) {
  const labels = ['Head Office dispatch to region', 'Region receipt confirmation', 'Region dispatch to REC', 'REC receipt confirmation'];
  const deadlineKeys = [null, 'regionReceiptDeadline', 'regionDispatchDeadline', 'recReceiptDeadline'];
  const today = localDateString();
  return <section className="receipt-timeline"><h3>Delivery timeline</h3>{labels.map((label, index) => {
    const event = (receipt.timeline || []).find((item) => item.stage === index + 1 && item.kind !== 'reminder');
    const deadline = receipt[deadlineKeys[index]] || event?.deadline;
    const overdue = !event && deadline && deadline < today;
    return <div className={`timeline-event stage-${index + 1} ${overdue ? 'overdue' : ''}`} key={label}><span className="timeline-marker">{event ? '✓' : index + 1}</span><div><b>{label}</b><small>{event ? `From ${event.senderEmail} · To ${event.receiverEmail} · Completed ${new Date(event.completedAt).toLocaleString()} · Email ${event.emailStatus || 'not connected'}` : `Due ${deadline || 'not set'} · ${overdue ? 'OVERDUE' : deadline === today ? 'DUE TODAY' : 'Pending'}`}</small>{event && event.emailStatus !== 'sent' && event.senderEmail && event.receiverEmail && onRetry && <button type="button" className="timeline-retry" onClick={() => onRetry(index + 1)}>Retry email to both contacts</button>}</div></div>;
  })}{(receipt.timeline || []).filter((event) => event.kind === 'reminder').map((event, index) => <div className="timeline-event overdue" key={`reminder-${event.stage}-${event.reminderDate || index}`}><span className="timeline-marker">!</span><div><b>{event.event}</b><small>To {event.emailedTo?.join(', ') || `${event.senderEmail}, ${event.receiverEmail}`} · {event.reminderDate || new Date(event.completedAt).toLocaleString()} · Email {event.emailStatus || 'pending'}</small></div></div>)}</section>;
}

function ReceiptPreview({ receipt, onClose, onRetry }) {
  return <div className="dialog-backdrop receipt-preview-backdrop">
    <section className="receipt-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="receipt-preview-title">
      <div className="preview-toolbar"><span>Receipt saved · {receipt.id}</span><div><button className="print-button" onClick={() => window.print()}><Printer size={15} /> Print / Save PDF</button><button className="dialog-close" onClick={onClose} aria-label="Close"><X size={18} /></button></div></div>
      <article className="print-sheet" id="receipt-print-sheet">
        <div className="receipt-org">ITREB PAKISTAN · ECED RE DEPARTMENT</div>
        <h1 id="receipt-preview-title">Acknowledgement of Receipt</h1>
        <h2>{receipt.resourceName || 'Ibtida Guidebook'}</h2>
        <div className="receipt-number">Receipt No. <b>{receipt.id}</b></div>
        <p className="receipt-statement">This receipt records the dispatch and receipt of {receipt.resourceName || 'the resource'} through the selected delivery route.</p>
        <table className="receipt-table"><tbody>
          <tr><th>Region</th><td>{receipt.region}</td><th>Dispatch reference</th><td>{receipt.dispatchReference || '—'}</td></tr>
          <tr><th>Head Office dispatch</th><td>{receipt.headOfficeDispatchDate}</td><th>Quantity sent</th><td>{receipt.headOfficeDispatchQuantity}</td></tr>
          <tr><th>Head Office dispatched by</th><td>{receipt.headOfficeDispatchedBy}</td><th>Region received date</th><td>{receipt.regionReceivedDate}</td></tr>
          <tr><th>Region quantity received</th><td>{receipt.regionReceivedQuantity}</td><th>Regional recipient</th><td>{receipt.regionReceivedBy}</td></tr>
          <tr><th>Local Board</th><td>{receipt.localBoard}</td><th>REC</th><td>{receipt.recName}</td></tr>
          <tr><th>Region dispatch date</th><td>{receipt.recDispatchDate}</td><th>Quantity sent to REC</th><td>{receipt.forwardedQuantity}</td></tr>
          <tr><th>Regional dispatcher</th><td>{receipt.regionDispatchedBy}</td><th>REC received date</th><td>{receipt.recReceivedDate}</td></tr>
          <tr><th>REC quantity received</th><td>{receipt.recReceivedQuantity}</td><th>REC recipient</th><td>{receipt.recReceivedBy}</td></tr>
          <tr><th>Head Office dispatch emails</th><td>{receipt.headOfficeSenderEmail || '—'}</td><td>→</td><td>{receipt.regionDispatchReceiverEmail || '—'}</td></tr>
          <tr><th>Region receipt emails</th><td>{receipt.headOfficeSenderEmail || '—'}</td><td>→</td><td>{receipt.regionSenderEmail || '—'}</td></tr>
          <tr><th>Region dispatch emails</th><td>{receipt.regionDispatchSenderEmail || '—'}</td><td>→</td><td>{receipt.recDispatchReceiverEmail || '—'}</td></tr>
          <tr><th>REC receipt emails</th><td>{receipt.recReceiptSenderEmail || '—'}</td><td>→</td><td>{receipt.regionReceiptFinalEmail || '—'}</td></tr>
          {receipt.notes && <tr><th>Notes</th><td colSpan="3">{receipt.notes}</td></tr>}
        </tbody></table>
        <ReceiptTimeline receipt={receipt} onRetry={(stageNumber) => onRetry(receipt.id, stageNumber)} />
        <p className="receipt-confirmation">The named officers confirm dispatch and receipt quantities recorded for each handoff.</p>
        <div className="signature-grid"><div><span></span><b>Head Office dispatch officer</b><small>Name, signature, date</small></div><div><span></span><b>Regional receiving officer</b><small>Name, signature, date</small></div><div><span></span><b>Regional dispatch officer</b><small>Name, signature, date</small></div><div><span></span><b>REC receiving officer</b><small>Name, signature, date</small></div></div>
        <div className="receipt-footer">Generated in the ECD Resource Hub · {new Date(receipt.createdAt).toLocaleDateString()}</div>
      </article>
      <div className="preview-bottom"><button className="cancel-button" onClick={onClose}>Close</button><button className="add-resource-button" onClick={() => window.print()}><Printer size={15} />Print / Save PDF</button></div>
    </section>
  </div>;
}

export default App;

