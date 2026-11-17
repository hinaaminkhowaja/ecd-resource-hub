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
  description: 'Acknowledge receipt from Head Office and record onward delivery to a REC.',
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
  const [editingReceipt, setEditingReceipt] = useState(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  useEffect(() => {
    window.localStorage.setItem(RESOURCE_STORAGE_KEY, JSON.stringify(resources));
  }, [resources]);

  useEffect(() => {
    window.localStorage.setItem(RECEIPT_STORAGE_KEY, JSON.stringify(receipts));
  }, [receipts]);

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

  function saveReceipt(form, existingId) {
    const existing = receipts.find((item) => item.id === existingId);
    const receipt = {
      ...existing,
      ...form,
      id: existingId || `IBT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setReceipts((current) => existingId
      ? current.map((item) => item.id === existingId ? receipt : item)
      : [receipt, ...current]);
    setReceiptDialogOpen(false);
    setEditingReceipt(null);
    if (receipt.stage === 4) setSelectedReceipt(receipt);
    else setNotice(`Stage ${receipt.stage} saved. Continue the receipt when the next handoff happens.`);
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
      <header className="topbar"><div className="breadcrumb">RECS collection <span>/</span> <b>{active}</b></div><div className="top-actions"><span className="online-dot"></span><span className="connection-text">Library workspace</span><button className="help-button" onClick={() => setNotice('The Ibtida Guidebook receipt records Head Office receipt at region and onward delivery to one REC.')}>?</button></div></header>
      <div className="content">
        <section className="welcome-row"><div><div className="eyebrow">EARLY CHILDHOOD DEVELOPMENT</div><h1>Resources for every <em>little learner.</em></h1><p className="intro">Your RECS collection of ECD materials, teaching guides, and classroom essentials.</p></div><div className="welcome-art" aria-hidden="true"><span className="sun"></span><span className="arch"><i></i><b></b><small></small></span><span className="plant">✳</span><span className="book-stack"><i></i><b></b><small></small></span></div></section>
        <section className="stats-row"><div className="stat-card"><span className="stat-icon mint-icon"><LibraryBig size={19} /></span><div><b>{allResources.length}</b><small>resources in library</small></div></div><div className="stat-card"><span className="stat-icon peach-icon"><UsersRound size={19} /></span><div><b>{categories.length - 1}</b><small>resource collections</small></div></div><div className="stat-note"><span className="note-star">✳</span><span><b>Made for curious minds</b><small>Manage learning materials and record guidebook deliveries.</small></span></div></section>
        <section className="library-section">
          <div className="section-heading"><div><div className="eyebrow">EXPLORE THE COLLECTION</div><h2>{active}</h2></div><button className="add-resource-button" onClick={openAddResource}><Plus size={16} /> Add resource</button></div>
          <div className="toolbar"><label className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search resources, topics, or materials…" /></label><label className="format-select"><span>Type</span><select value={format} onChange={(event) => setFormat(event.target.value)}><option>All formats</option><option>PDF</option><option>Guide</option><option>Inventory</option><option>Receipt form</option><option>Other</option></select><ChevronDown size={14} /></label></div>
          <div className="results-line"><span>{filtered.length} resources</span><span>REC directory <span className="tiny-dot">•</span> {regions.length} regions · {recDirectory.length.toLocaleString()} RECs</span></div>
          {filtered.length ? <div className="resource-grid">{filtered.map((item, index) => { const Icon = resourceIcons[item.type] || Shapes; const isBuiltIn = item.id === SYSTEM_RESOURCE_ID; return <article className={`resource-card ${isBuiltIn ? 'guidebook-card' : ''}`} key={item.id}><div className={`card-art ${item.color || colors[index % colors.length]}`}><div className="resource-symbol"><Icon size={27} strokeWidth={1.5} /></div><span className="age-pill">{item.age || 'ECD'}</span></div><div className="card-body"><div className="card-type">{item.type}</div><h3>{isBuiltIn ? <button className="card-title-button" onClick={() => setReceiptDialogOpen(true)}>{item.title}</button> : item.title}</h3><p>{item.description || 'No description added'}</p><div className="card-footer"><span><FileText size={14} />{item.format}</span>{isBuiltIn ? <button className="receipt-link" onClick={() => setReceiptDialogOpen(true)}>Create receipt <span>→</span></button> : <div className="resource-actions"><button onClick={() => { setEditingResource(item); setResourceDialogOpen(true); }} aria-label={`Edit ${item.title}`}><Pencil size={13} /> Edit</button><button className="delete-action" onClick={() => deleteResource(item)} aria-label={`Delete ${item.title}`}><Trash2 size={13} /> Delete</button></div>}</div></div></article>; })}</div> : <div className="empty-state"><Search size={24} /><b>No matching resources</b><span>Try another search or choose a different collection.</span></div>}
          {receipts.length > 0 && <section className="receipt-history"><div className="history-heading"><div><div className="eyebrow">DELIVERY RECORDS</div><h3>Recent Ibtida acknowledgements</h3></div><span>{receipts.length} saved</span></div><div className="history-list">{receipts.slice(0, 5).map((receipt) => <button className="history-row" key={receipt.id} onClick={() => { if ((receipt.stage ?? 4) >= 4) setSelectedReceipt(receipt); else { setEditingReceipt(receipt); setReceiptDialogOpen(true); } }}><span><b>{receipt.recName || `${receipt.region} · Region shipment`}</b><small>{receipt.region}{receipt.localBoard ? ` · ${receipt.localBoard}` : ''}</small></span><span className="history-quantity">{(receipt.stage ?? 4) >= 4 ? `${receipt.forwardedQuantity} books · Complete` : `Continue · stage ${receipt.stage} of 4`}</span><span className="history-id">{receipt.id}</span></button>)}</div></section>}
          <div className="source-note"><span className="source-mark"><FolderOpen size={17} /></span><span><b>REC dropdown source</b><small>Region, local board, and REC names imported from master sheet.xlsx. OneDrive refresh is not connected yet.</small></span><button onClick={() => setNotice('The app currently uses the imported master sheet snapshot. OneDrive integration can keep it current later.')}>Source details <span>→</span></button></div>
        </section>
        <footer>ECD RESOURCE HUB <span>·</span> A home for early learning resources</footer>
      </div>
    </main>
    {resourceDialogOpen && <ResourceDialog initial={editingResource} onClose={() => { setResourceDialogOpen(false); setEditingResource(null); }} onSave={saveResource} />}
    {receiptDialogOpen && <ReceiptDialog initial={editingReceipt} onClose={() => { setReceiptDialogOpen(false); setEditingReceipt(null); }} onSave={saveReceipt} />}
    {selectedReceipt && <ReceiptPreview receipt={selectedReceipt} onClose={() => setSelectedReceipt(null)} />}
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

function ReceiptDialog({ initial, onClose, onSave }) {
  const today = new Date().toISOString().slice(0, 10);
  const [stage, setStage] = useState(initial ? (initial.stage ?? 4) : 0);
  const [form, setForm] = useState(() => ({
    dispatchReference: '', headOfficeDispatchDate: today, headOfficeDispatchQuantity: '', headOfficeDispatchedBy: '', headOfficeNotifyEmail: '',
    region: '', regionReceivedDate: '', regionReceivedQuantity: '', regionReceivedBy: '', regionNotifyEmail: '',
    localBoard: '', recName: '', recDispatchDate: '', forwardedQuantity: '', regionDispatchedBy: '', recNotifyEmail: '',
    recReceivedDate: '', recReceivedQuantity: '', recReceivedBy: '', finalNotifyEmail: '', notes: '', timeline: [],
    ...initial,
  }));
  const boardOptions = useMemo(() => [...new Set(recDirectory.filter((row) => row.region === form.region).map((row) => row.localBoard))].sort(), [form.region]);
  const recOptions = useMemo(() => recDirectory.filter((row) => row.region === form.region && row.localBoard === form.localBoard), [form.region, form.localBoard]);
  const stepNames = ['Head Office dispatch', 'Region receipt', 'Region dispatch to REC', 'REC receipt'];
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
    const timelineNames = ['Head Office dispatched guidebooks to the region', 'Region confirmed receipt from Head Office', 'Region dispatched guidebooks to the REC', 'REC confirmed receipt from the region'];
    const notifyEmails = [form.headOfficeNotifyEmail, form.regionNotifyEmail, form.recNotifyEmail, form.finalNotifyEmail];
    const timeline = [...(form.timeline || []), { stage: stage + 1, event: timelineNames[stage], email: notifyEmails[stage], completedAt: new Date().toISOString() }];
    onSave({ ...next, timeline, stage: stage + 1 }, initial?.id);
  }

  return <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="resource-dialog receipt-dialog" role="dialog" aria-modal="true" aria-labelledby="receipt-dialog-title">
      <div className="dialog-heading"><div><div className="eyebrow">CURRICULUM · IBTIDA GUIDEBOOK</div><h2 id="receipt-dialog-title">{initial ? 'Continue acknowledgement' : 'New acknowledgement'}</h2><p className="dialog-subtitle">Complete each handoff when it happens. Save a stage now and continue later.</p></div><button className="dialog-close" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
      <form onSubmit={submit}>
        <div className="receipt-stepper">{stepNames.map((name, index) => <div key={name} className={`receipt-step ${index === stage ? 'current' : index < stage ? 'done' : ''}`}><span>{index < stage ? '✓' : `0${index + 1}`}</span><small>{name}</small></div>)}</div>
        <div className="receipt-email-info"><b>Email recipient and activity timeline</b><span>Add the contact email for each handoff. Completed stages are timestamped below and on the printable receipt. Automatic email delivery will begin once a secure sender account is connected.</span></div>
        {form.timeline?.length > 0 && <section className="receipt-timeline form-timeline"><h3>Completed handoffs</h3>{form.timeline.map((event, index) => <div className="timeline-event" key={`${event.stage}-${event.completedAt || index}`}><span className="timeline-marker">{index + 1}</span><div><b>{event.event}</b><small>{event.email ? `${event.email} · ` : ''}{new Date(event.completedAt).toLocaleString()}</small></div></div>)}</section>}
        <div className="receipt-section-title"><span>0{stage + 1}</span><div><b>{stepNames[stage]}</b><small>{['Record the shipment sent from Head Office.', 'Confirm what the regional office received.', 'Select an REC and record the regional shipment.', 'Confirm what the REC received.'][stage]}</small></div></div>
        {stage === 0 && <>
          <div className="form-row"><label className="form-field">Dispatch reference<input maxLength={80} value={form.dispatchReference} onChange={(event) => update('dispatchReference', event.target.value)} placeholder="Optional reference number" /></label><label className="form-field">Dispatch date<input type="date" required value={form.headOfficeDispatchDate} onChange={(event) => update('headOfficeDispatchDate', event.target.value)} /></label></div>
          <label className="form-field">Destination region<select required value={form.region} onChange={(event) => setForm((current) => ({ ...current, region: event.target.value, localBoard: '', recName: '' }))}><option value="">Select a region</option>{regions.map((region) => <option key={region}>{region}</option>)}</select></label>
          <div className="form-row"><label className="form-field">Guidebooks dispatched<input type="number" required min="1" step="1" value={form.headOfficeDispatchQuantity} onChange={(event) => update('headOfficeDispatchQuantity', event.target.value)} placeholder="Quantity" /></label><label className="form-field">Dispatched by<input required maxLength={100} value={form.headOfficeDispatchedBy} onChange={(event) => update('headOfficeDispatchedBy', event.target.value)} placeholder="Name and designation" /></label></div>
          <label className="form-field">Regional contact email<input type="email" required value={form.headOfficeNotifyEmail} onChange={(event) => update('headOfficeNotifyEmail', event.target.value)} placeholder="region@example.org" /></label>
        </>}
        {stage === 1 && <>
          <label className="form-field">Region<input readOnly value={form.region} /></label>
          <div className="form-row"><label className="form-field">Date received at region<input type="date" required value={form.regionReceivedDate} onChange={(event) => update('regionReceivedDate', event.target.value)} /></label><label className="form-field">Guidebooks received<input type="number" required min="1" step="1" max={form.headOfficeDispatchQuantity || undefined} value={form.regionReceivedQuantity} onChange={(event) => update('regionReceivedQuantity', event.target.value)} placeholder="Quantity" /></label></div>
          <div className="form-row"><label className="form-field">Received by at regional office<input required maxLength={100} value={form.regionReceivedBy} onChange={(event) => update('regionReceivedBy', event.target.value)} placeholder="Name and designation" /></label><label className="form-field">Head Office contact email<input type="email" required value={form.regionNotifyEmail} onChange={(event) => update('regionNotifyEmail', event.target.value)} placeholder="headoffice@example.org" /></label></div>
        </>}
        {stage === 2 && <>
          <label className="form-field">Local Board<select required value={form.localBoard} onChange={(event) => setForm((current) => ({ ...current, localBoard: event.target.value, recName: '' }))}><option value="">Select a local board</option>{boardOptions.map((board) => <option key={board}>{board}</option>)}</select></label>
          <label className="form-field">REC<select required disabled={!form.localBoard} value={form.recName} onChange={(event) => update('recName', event.target.value)}><option value="">{form.localBoard ? 'Select an REC' : 'Select a local board first'}</option>{recOptions.map((row) => <option key={row.recName}>{row.recName}</option>)}</select></label>
          <div className="form-row"><label className="form-field">Dispatch date to REC<input type="date" required value={form.recDispatchDate} onChange={(event) => update('recDispatchDate', event.target.value)} /></label><label className="form-field">Guidebooks dispatched<input type="number" required min="1" step="1" max={form.regionReceivedQuantity || undefined} value={form.forwardedQuantity} onChange={(event) => update('forwardedQuantity', event.target.value)} placeholder="Quantity" /></label></div>
          <div className="form-row"><label className="form-field">Dispatched by at regional office<input required maxLength={100} value={form.regionDispatchedBy} onChange={(event) => update('regionDispatchedBy', event.target.value)} placeholder="Name and designation" /></label><label className="form-field">REC contact email<input type="email" required value={form.recNotifyEmail} onChange={(event) => update('recNotifyEmail', event.target.value)} placeholder="rec@example.org" /></label></div>
        </>}
        {stage === 3 && <>
          <div className="form-row"><label className="form-field">Region<input readOnly value={form.region} /></label><label className="form-field">REC<input readOnly value={form.recName} /></label></div>
          <div className="form-row"><label className="form-field">Date received at REC<input type="date" required value={form.recReceivedDate} onChange={(event) => update('recReceivedDate', event.target.value)} /></label><label className="form-field">Guidebooks received<input type="number" required min="1" step="1" max={form.forwardedQuantity || undefined} value={form.recReceivedQuantity} onChange={(event) => update('recReceivedQuantity', event.target.value)} placeholder="Quantity" /></label></div>
          <div className="form-row"><label className="form-field">Received by at REC<input required maxLength={100} value={form.recReceivedBy} onChange={(event) => update('recReceivedBy', event.target.value)} placeholder="Name and designation" /></label><label className="form-field">Regional contact email<input type="email" required value={form.finalNotifyEmail} onChange={(event) => update('finalNotifyEmail', event.target.value)} placeholder="region@example.org" /></label></div>
          <label className="form-field">Notes<textarea rows="2" maxLength="300" value={form.notes} onChange={(event) => update('notes', event.target.value)} placeholder="Optional delivery notes or condition" /></label>
        </>}
        {quantityError && <p className="form-error">{quantityError}</p>}
        <div className="dialog-actions"><button type="button" className="cancel-button" onClick={onClose}>Close</button><button type="submit" className="add-resource-button" disabled={Boolean(quantityError)}><FileText size={15} />{stage === 3 ? 'Complete receipt' : `Save and continue to stage ${stage + 2}`}</button></div>
      </form>
    </section>
  </div>;
}

function ReceiptPreview({ receipt, onClose }) {
  return <div className="dialog-backdrop receipt-preview-backdrop">
    <section className="receipt-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="receipt-preview-title">
      <div className="preview-toolbar"><span>Receipt saved · {receipt.id}</span><div><button className="print-button" onClick={() => window.print()}><Printer size={15} /> Print / Save PDF</button><button className="dialog-close" onClick={onClose} aria-label="Close"><X size={18} /></button></div></div>
      <article className="print-sheet" id="receipt-print-sheet">
        <div className="receipt-org">ITREB PAKISTAN · ECED RE DEPARTMENT</div>
        <div className="receipt-document-kicker">CURRICULUM RESOURCE DISTRIBUTION</div>
        <h1 id="receipt-preview-title">Acknowledgement of Receipt</h1>
        <h2>Ibtida Guidebook</h2>
        <div className="receipt-number">Receipt No. <b>{receipt.id}</b></div>
        <p className="receipt-statement">This record documents the four handoffs for Ibtida Guidebooks from Head Office through the regional office to the REC listed below.</p>
        <table className="receipt-table"><tbody>
          <tr><th>Region</th><td>{receipt.region}</td><th>Dispatch reference</th><td>{receipt.dispatchReference || '—'}</td></tr>
          <tr><th>Head Office dispatch</th><td>{receipt.headOfficeDispatchDate}</td><th>Quantity sent</th><td>{receipt.headOfficeDispatchQuantity}</td></tr>
          <tr><th>Head Office dispatched by</th><td>{receipt.headOfficeDispatchedBy}</td><th>Region received date</th><td>{receipt.regionReceivedDate}</td></tr>
          <tr><th>Region quantity received</th><td>{receipt.regionReceivedQuantity}</td><th>Regional recipient</th><td>{receipt.regionReceivedBy}</td></tr>
          <tr><th>Local Board</th><td>{receipt.localBoard}</td><th>REC</th><td>{receipt.recName}</td></tr>
          <tr><th>Region dispatch date</th><td>{receipt.recDispatchDate}</td><th>Quantity sent to REC</th><td>{receipt.forwardedQuantity}</td></tr>
          <tr><th>Regional dispatcher</th><td>{receipt.regionDispatchedBy}</td><th>REC received date</th><td>{receipt.recReceivedDate}</td></tr>
          <tr><th>REC quantity received</th><td>{receipt.recReceivedQuantity}</td><th>REC recipient</th><td>{receipt.recReceivedBy}</td></tr>
          <tr><th>Regional contact email</th><td>{receipt.headOfficeNotifyEmail || '—'}</td><th>Head Office email</th><td>{receipt.regionNotifyEmail || '—'}</td></tr>
          <tr><th>REC contact email</th><td>{receipt.recNotifyEmail || '—'}</td><th>Regional contact email</th><td>{receipt.finalNotifyEmail || '—'}</td></tr>
          {receipt.notes && <tr><th>Notes</th><td colSpan="3">{receipt.notes}</td></tr>}
        </tbody></table>
        <section className="receipt-timeline"><h3>Delivery timeline</h3>{(receipt.timeline || []).map((event, index) => <div className="timeline-event" key={`${event.stage}-${event.completedAt || index}`}><span className="timeline-marker">{index + 1}</span><div><b>{event.event}</b><small>{event.email ? `Notification address: ${event.email} · ` : ''}{new Date(event.completedAt).toLocaleString()}</small></div></div>)}</section>
        <p className="receipt-confirmation">The named officers confirm dispatch and receipt quantities recorded for each handoff.</p>
        <div className="signature-grid"><div><span></span><b>Head Office dispatch officer</b><small>Name, signature, date</small></div><div><span></span><b>Regional receiving officer</b><small>Name, signature, date</small></div><div><span></span><b>Regional dispatch officer</b><small>Name, signature, date</small></div><div><span></span><b>REC receiving officer</b><small>Name, signature, date</small></div></div>
        <div className="receipt-footer">Generated in the ECD Resource Hub · {new Date(receipt.createdAt).toLocaleDateString()}</div>
      </article>
      <div className="preview-bottom"><button className="cancel-button" onClick={onClose}>Close</button><button className="add-resource-button" onClick={() => window.print()}><Printer size={15} />Print / Save PDF</button></div>
    </section>
  </div>;
}

export default App;

