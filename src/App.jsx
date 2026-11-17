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

  function saveReceipt(form) {
    const receipt = {
      ...form,
      id: `IBT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
      createdAt: new Date().toISOString(),
    };
    setReceipts((current) => [receipt, ...current]);
    setReceiptDialogOpen(false);
    setSelectedReceipt(receipt);
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
          {receipts.length > 0 && <section className="receipt-history"><div className="history-heading"><div><div className="eyebrow">DELIVERY RECORDS</div><h3>Recent Ibtida acknowledgements</h3></div><span>{receipts.length} saved</span></div><div className="history-list">{receipts.slice(0, 5).map((receipt) => <button className="history-row" key={receipt.id} onClick={() => setSelectedReceipt(receipt)}><span><b>{receipt.recName}</b><small>{receipt.region} · {receipt.localBoard}</small></span><span className="history-quantity">{receipt.forwardedQuantity} books</span><span className="history-id">{receipt.id}</span></button>)}</div></section>}
          <div className="source-note"><span className="source-mark"><FolderOpen size={17} /></span><span><b>REC dropdown source</b><small>Region, local board, and REC names imported from master sheet.xlsx. OneDrive refresh is not connected yet.</small></span><button onClick={() => setNotice('The app currently uses the imported master sheet snapshot. OneDrive integration can keep it current later.')}>Source details <span>→</span></button></div>
        </section>
        <footer>ECD RESOURCE HUB <span>·</span> A home for early learning resources</footer>
      </div>
    </main>
    {resourceDialogOpen && <ResourceDialog initial={editingResource} onClose={() => { setResourceDialogOpen(false); setEditingResource(null); }} onSave={saveResource} />}
    {receiptDialogOpen && <ReceiptDialog onClose={() => setReceiptDialogOpen(false)} onSave={saveReceipt} />}
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

function ReceiptDialog({ onClose, onSave }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    dispatchReference: '',
    headOfficeDispatchDate: today,
    region: '',
    localBoard: '',
    recName: '',
    regionReceivedDate: today,
    regionReceivedQuantity: '',
    regionReceivedBy: '',
    recDispatchDate: today,
    forwardedQuantity: '',
    recReceivedDate: today,
    recReceivedBy: '',
    notes: '',
  });
  const boardOptions = useMemo(() => [...new Set(recDirectory.filter((row) => row.region === form.region).map((row) => row.localBoard))].sort(), [form.region]);
  const recOptions = useMemo(() => recDirectory.filter((row) => row.region === form.region && row.localBoard === form.localBoard), [form.region, form.localBoard]);
  const forwardedTooMany = Number(form.forwardedQuantity) > Number(form.regionReceivedQuantity);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function submit(event) {
    event.preventDefault();
    if (forwardedTooMany) return;
    onSave({ ...form, regionReceivedQuantity: Number(form.regionReceivedQuantity), forwardedQuantity: Number(form.forwardedQuantity) });
  }

  return <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="resource-dialog receipt-dialog" role="dialog" aria-modal="true" aria-labelledby="receipt-dialog-title">
      <div className="dialog-heading"><div><div className="eyebrow">CURRICULUM · IBTIDA GUIDEBOOK</div><h2 id="receipt-dialog-title">Acknowledgement receipt</h2><p className="dialog-subtitle">Record receipt at the region and onward delivery to one REC.</p></div><button className="dialog-close" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
      <form onSubmit={submit}>
        <div className="receipt-section-title"><span>01</span><div><b>Head Office to region</b><small>Shipment and regional receipt details</small></div></div>
        <div className="form-row"><label className="form-field">Dispatch reference<input maxLength={80} value={form.dispatchReference} onChange={(event) => update('dispatchReference', event.target.value)} placeholder="Optional reference number" /></label><label className="form-field">Head Office dispatch date<input type="date" required value={form.headOfficeDispatchDate} onChange={(event) => update('headOfficeDispatchDate', event.target.value)} /></label></div>
        <label className="form-field">Region<select required value={form.region} onChange={(event) => setForm((current) => ({ ...current, region: event.target.value, localBoard: '', recName: '' }))}><option value="">Select a region</option>{regions.map((region) => <option key={region}>{region}</option>)}</select></label>
        <div className="form-row"><label className="form-field">Date received at region<input type="date" required value={form.regionReceivedDate} onChange={(event) => update('regionReceivedDate', event.target.value)} /></label><label className="form-field">Guidebooks received at region<input type="number" required min="1" step="1" value={form.regionReceivedQuantity} onChange={(event) => update('regionReceivedQuantity', event.target.value)} placeholder="Quantity" /></label></div>
        <label className="form-field">Received by at regional office<input required maxLength={100} value={form.regionReceivedBy} onChange={(event) => update('regionReceivedBy', event.target.value)} placeholder="Name and designation" /></label>

        <div className="receipt-section-title second-section"><span>02</span><div><b>Region to REC</b><small>Choose the destination and record REC receipt</small></div></div>
        <label className="form-field">Local Board<select required disabled={!form.region} value={form.localBoard} onChange={(event) => setForm((current) => ({ ...current, localBoard: event.target.value, recName: '' }))}><option value="">{form.region ? 'Select a local board' : 'Select a region first'}</option>{boardOptions.map((board) => <option key={board}>{board}</option>)}</select></label>
        <label className="form-field">REC<select required disabled={!form.localBoard} value={form.recName} onChange={(event) => update('recName', event.target.value)}><option value="">{form.localBoard ? 'Select an REC' : 'Select a local board first'}</option>{recOptions.map((row) => <option key={row.recName}>{row.recName}</option>)}</select></label>
        <div className="form-row"><label className="form-field">Date sent to REC<input type="date" required value={form.recDispatchDate} onChange={(event) => update('recDispatchDate', event.target.value)} /></label><label className="form-field">Guidebooks sent to REC<input type="number" required min="1" step="1" max={form.regionReceivedQuantity || undefined} value={form.forwardedQuantity} onChange={(event) => update('forwardedQuantity', event.target.value)} placeholder="Quantity" /></label></div>
        <div className="form-row"><label className="form-field">Date received at REC<input type="date" required value={form.recReceivedDate} onChange={(event) => update('recReceivedDate', event.target.value)} /></label><label className="form-field">Received by at REC<input required maxLength={100} value={form.recReceivedBy} onChange={(event) => update('recReceivedBy', event.target.value)} placeholder="Name and designation" /></label></div>
        {forwardedTooMany && <p className="form-error">The number sent to the REC cannot exceed the quantity received by the region.</p>}
        <label className="form-field">Notes<textarea rows="2" maxLength={300} value={form.notes} onChange={(event) => update('notes', event.target.value)} placeholder="Optional delivery notes or condition" /></label>
        <div className="dialog-actions"><button type="button" className="cancel-button" onClick={onClose}>Cancel</button><button type="submit" className="add-resource-button" disabled={forwardedTooMany}><FileText size={15} />Create acknowledgement</button></div>
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
        <p className="receipt-statement">This acknowledges that the regional office received Ibtida Guidebooks from Head Office and recorded onward delivery to the REC listed below.</p>
        <table className="receipt-table"><tbody>
          <tr><th>Region</th><td>{receipt.region}</td><th>Dispatch reference</th><td>{receipt.dispatchReference || '—'}</td></tr>
          <tr><th>Head Office dispatch date</th><td>{receipt.headOfficeDispatchDate}</td><th>Region received date</th><td>{receipt.regionReceivedDate}</td></tr>
          <tr><th>Quantity received by region</th><td>{receipt.regionReceivedQuantity}</td><th>Regional recipient</th><td>{receipt.regionReceivedBy}</td></tr>
          <tr><th>Local Board</th><td>{receipt.localBoard}</td><th>REC</th><td>{receipt.recName}</td></tr>
          <tr><th>REC dispatch date</th><td>{receipt.recDispatchDate}</td><th>REC received date</th><td>{receipt.recReceivedDate}</td></tr>
          <tr><th>Quantity sent to REC</th><td>{receipt.forwardedQuantity}</td><th>REC recipient</th><td>{receipt.recReceivedBy}</td></tr>
          {receipt.notes && <tr><th>Notes</th><td colSpan="3">{receipt.notes}</td></tr>}
        </tbody></table>
        <p className="receipt-confirmation">The recipients named above confirm that the quantities recorded were received.</p>
        <div className="signature-grid"><div><span></span><b>Regional receiving officer</b><small>Name, signature, date</small></div><div><span></span><b>REC receiving officer</b><small>Name, signature, date</small></div></div>
        <div className="receipt-footer">Generated in the ECD Resource Hub · {new Date(receipt.createdAt).toLocaleDateString()}</div>
      </article>
      <div className="preview-bottom"><button className="cancel-button" onClick={onClose}>Close</button><button className="add-resource-button" onClick={() => window.print()}><Printer size={15} />Print / Save PDF</button></div>
    </section>
  </div>;
}

export default App;
