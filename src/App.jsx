import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownToLine, BookOpen, Boxes, ChevronDown, CircleHelp,
  FileText, FolderOpen, LibraryBig, Pencil, Plus, Search, Settings2,
  Shapes, Sofa, Sparkles, Trash2, UsersRound, X,
} from 'lucide-react';
import './management.css';

const STORAGE_KEY = 'ecd-resource-hub.resources';

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

function readResources() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function App() {
  const [resources, setResources] = useState(readResources);
  const [active, setActive] = useState('All resources');
  const [query, setQuery] = useState('');
  const [format, setFormat] = useState('All formats');
  const [notice, setNotice] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingResource, setEditingResource] = useState(null);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(resources));
  }, [resources]);

  const filtered = useMemo(() => resources.filter((item) => {
    const matchesCategory = active === 'All resources' || item.type === active;
    const matchesSearch = `${item.title} ${item.description} ${item.type}`.toLowerCase().includes(query.toLowerCase());
    const matchesFormat = format === 'All formats' || item.format === format;
    return matchesCategory && matchesSearch && matchesFormat;
  }), [active, query, format, resources]);

  function openAddDialog() {
    setEditingResource(null);
    setDialogOpen(true);
  }

  function openEditDialog(resource) {
    setEditingResource(resource);
    setDialogOpen(true);
  }

  function saveResource(form) {
    if (editingResource) {
      setResources((current) => current.map((item) => item.id === editingResource.id ? { ...form, id: item.id } : item));
      setNotice('Resource updated.');
    } else {
      setResources((current) => [...current, { ...form, id: crypto.randomUUID() }]);
      setNotice('Resource added.');
    }
    setDialogOpen(false);
    setEditingResource(null);
  }

  function deleteResource(resource) {
    if (!window.confirm(`Delete “${resource.title}” from this library?`)) return;
    setResources((current) => current.filter((item) => item.id !== resource.id));
    setNotice('Resource deleted.');
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
      <nav>{categories.map(({ name, icon: Icon }) => <button key={name} onClick={() => setActive(name)} className={`nav-item ${active === name ? 'selected' : ''}`}><Icon size={18} /><span>{name}</span>{name === 'All resources' && <span className="nav-count">{resources.length}</span>}</button>)}</nav>
      <div className="nav-heading tools-heading">YOUR SPACE</div>
      <button className="nav-item" onClick={() => { setActive('All resources'); openAddDialog(); }}><Plus size={18} /><span>Add a resource</span></button>
      <div className="sidebar-bottom">
        <div className="sync-card"><span className="sync-icon"><FolderOpen size={17} /></span><div><b>Connect your library</b><p>Link OneDrive to browse your RECS files.</p><button onClick={() => setNotice('OneDrive connection is planned. Add Microsoft sign-in and file permissions to enable it.')}>Set up connection <span>→</span></button></div></div>
        <button className="nav-item muted" onClick={() => setNotice('Help and support will be added to the resource hub.')}><CircleHelp size={18} /><span>Help & support</span></button>
        <button className="nav-item muted" onClick={() => setNotice('Settings will be available as the hub grows.')}><Settings2 size={18} /><span>Settings</span></button>
        <div className="profile"><div className="profile-avatar">H</div><div><b>RECS team</b><small>ECD programme</small></div><ChevronDown size={16} /></div>
      </div>
    </aside>

    <main className="main-area">
      <header className="topbar"><div className="breadcrumb">RECS collection <span>/</span> <b>{active}</b></div><div className="top-actions"><span className="online-dot"></span><span className="connection-text">Library workspace</span><button className="help-button" onClick={() => setNotice('Add resources manually for now. OneDrive connection is planned for a later step.')}>?</button></div></header>
      <div className="content">
        <section className="welcome-row"><div><div className="eyebrow">EARLY CHILDHOOD DEVELOPMENT</div><h1>Resources for every <em>little learner.</em></h1><p className="intro">Your RECS collection of ECD materials, teaching guides, and classroom essentials.</p></div><div className="welcome-art" aria-hidden="true"><span className="sun"></span><span className="arch"><i></i><b></b><small></small></span><span className="plant">✳</span><span className="book-stack"><i></i><b></b><small></small></span></div></section>
        <section className="stats-row"><div className="stat-card"><span className="stat-icon mint-icon"><LibraryBig size={19} /></span><div><b>{resources.length}</b><small>resources in library</small></div></div><div className="stat-card"><span className="stat-icon peach-icon"><UsersRound size={19} /></span><div><b>{categories.length - 1}</b><small>resource collections</small></div></div><div className="stat-note"><span className="note-star">✳</span><span><b>Made for curious minds</b><small>Add and manage your ECD learning materials.</small></span></div></section>
        <section className="library-section">
          <div className="section-heading"><div><div className="eyebrow">EXPLORE THE COLLECTION</div><h2>{active}</h2></div><button className="add-resource-button" onClick={openAddDialog}><Plus size={16} /> Add resource</button></div>
          <div className="toolbar"><label className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search resources, topics, or materials…" /></label><label className="format-select"><span>Type</span><select value={format} onChange={(event) => setFormat(event.target.value)}><option>All formats</option><option>PDF</option><option>Guide</option><option>Inventory</option><option>Other</option></select><ChevronDown size={14} /></label></div>
          <div className="results-line"><span>{filtered.length} resources</span><span>RECS collection <span className="tiny-dot">•</span> Your library</span></div>
          {filtered.length ? <div className="resource-grid">{filtered.map((item, index) => { const Icon = resourceIcons[item.type] || Shapes; return <article className="resource-card" key={item.id}><div className={`card-art ${item.color || colors[index % colors.length]}`}><div className="resource-symbol"><Icon size={27} strokeWidth={1.5} /></div><span className="age-pill">{item.age || 'ECD'}</span></div><div className="card-body"><div className="card-type">{item.type}</div><h3>{item.title}</h3><p>{item.description || 'No description added'}</p><div className="card-footer"><span><FileText size={14} />{item.format}</span><div className="resource-actions"><button onClick={() => openEditDialog(item)} aria-label={`Edit ${item.title}`}><Pencil size={13} /> Edit</button><button className="delete-action" onClick={() => deleteResource(item)} aria-label={`Delete ${item.title}`}><Trash2 size={13} /> Delete</button></div></div></div></article>; })}</div> : <div className="empty-state"><LibraryBig size={25} /><b>{resources.length ? 'No matching resources' : 'Your resource library is empty'}</b><span>{resources.length ? 'Try another search or choose a different collection.' : 'Add curriculum, activity books, kits, or furniture to get started.'}</span>{!resources.length && <button className="add-resource-button" onClick={openAddDialog}><Plus size={16} /> Add your first resource</button>}</div>}
          <div className="source-note"><span className="source-mark"><FolderOpen size={17} /></span><span><b>Bring your RECS library together</b><small>Connect OneDrive to make your actual curriculum, activity books, kits, and furniture files searchable here.</small></span><button onClick={() => setNotice('OneDrive connection is planned for the next build step.')}>Learn about setup <span>→</span></button></div>
        </section>
        <footer>ECD RESOURCE HUB <span>·</span> A home for early learning resources</footer>
      </div>
    </main>
    {dialogOpen && <ResourceDialog initial={editingResource} onClose={() => { setDialogOpen(false); setEditingResource(null); }} onSave={saveResource} />}
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

export default App;
