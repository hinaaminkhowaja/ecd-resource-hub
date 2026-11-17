import React, { useMemo, useState } from 'react';
import {
  Archive, ArrowDownToLine, BookOpen, Boxes, ChevronDown, CircleHelp,
  FileText, FolderOpen, LayoutDashboard, LibraryBig, Search, Settings2,
  Shapes, Sofa, Sparkles, UsersRound,
} from 'lucide-react';

const resources = [
  { title: 'Early Years Curriculum Framework', type: 'Curriculum', detail: 'Teaching and learning guide', format: 'PDF', age: 'Ages 3–5', color: 'mint', icon: BookOpen },
  { title: 'My Learning Activity Book · Book 1', type: 'Activity books', detail: 'Early literacy and numeracy', format: 'PDF', age: 'Ages 3–4', color: 'peach', icon: FileText },
  { title: 'My Learning Activity Book · Book 2', type: 'Activity books', detail: 'Exploration and creative play', format: 'PDF', age: 'Ages 4–5', color: 'lavender', icon: FileText },
  { title: 'ECD Classroom Learning Kit', type: 'Kits', detail: 'Materials for guided activities', format: 'Guide', age: 'Classroom', color: 'yellow', icon: Boxes },
  { title: 'Pretend Play Corner', type: 'Furniture', detail: 'Learning space setup guide', format: 'Guide', age: 'Classroom', color: 'blue', icon: Sofa },
  { title: 'Block and Construction Set', type: 'Kits', detail: 'Build, sort, and explore', format: 'Inventory', age: 'Ages 3–5', color: 'pink', icon: Shapes },
  { title: 'Reading Nook Furniture Set', type: 'Furniture', detail: 'Layout and safety notes', format: 'Guide', age: 'Classroom', color: 'mint', icon: Sofa },
  { title: 'Learning Through Play', type: 'Curriculum', detail: 'Activity planning resource', format: 'PDF', age: 'Ages 3–5', color: 'peach', icon: BookOpen },
];

const categories = [
  { name: 'All resources', icon: LibraryBig },
  { name: 'Curriculum', icon: BookOpen },
  { name: 'Activity books', icon: FileText },
  { name: 'Kits', icon: Boxes },
  { name: 'Furniture', icon: Sofa },
];

function App() {
  const [active, setActive] = useState('All resources');
  const [query, setQuery] = useState('');
  const [format, setFormat] = useState('All formats');
  const [notice, setNotice] = useState('');
  const filtered = useMemo(() => resources.filter((item) => {
    const matchesCategory = active === 'All resources' || item.type === active;
    const matchesSearch = `${item.title} ${item.detail} ${item.type}`.toLowerCase().includes(query.toLowerCase());
    const matchesFormat = format === 'All formats' || item.format === format;
    return matchesCategory && matchesSearch && matchesFormat;
  }), [active, query, format]);

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
      <button className="nav-item" onClick={() => setNotice('Saved resources will appear here when you bookmark an item.')}><Archive size={18} /><span>Saved resources</span></button>
      <div className="sidebar-bottom">
        <div className="sync-card"><span className="sync-icon"><FolderOpen size={17} /></span><div><b>Connect your library</b><p>Link OneDrive to browse your RECS files.</p><button onClick={() => setNotice('OneDrive connection is planned. Add Microsoft sign-in and file permissions to enable it.')}>Set up connection <span>→</span></button></div></div>
        <button className="nav-item muted" onClick={() => setNotice('Help and support will be added to the resource hub.')}><CircleHelp size={18} /><span>Help & support</span></button>
        <button className="nav-item muted" onClick={() => setNotice('Settings will be available as the hub grows.')}><Settings2 size={18} /><span>Settings</span></button>
        <div className="profile"><div className="profile-avatar">H</div><div><b>RECS team</b><small>ECD programme</small></div><ChevronDown size={16} /></div>
      </div>
    </aside>

    <main className="main-area">
      <header className="topbar"><div className="breadcrumb">RECS collection <span>/</span> <b>{active}</b></div><div className="top-actions"><span className="online-dot"></span><span className="connection-text">Library workspace</span><button className="help-button" onClick={() => setNotice('This dashboard is ready to connect to your organisation’s OneDrive library.')}>?</button></div></header>
      <div className="content">
        <section className="welcome-row"><div><div className="eyebrow">EARLY CHILDHOOD DEVELOPMENT</div><h1>Resources for every <em>little learner.</em></h1><p className="intro">Your RECS collection of ECD materials, teaching guides, and classroom essentials.</p></div><div className="welcome-art" aria-hidden="true"><span className="sun"></span><span className="arch"><i></i><b></b><small></small></span><span className="plant">✳</span><span className="book-stack"><i></i><b></b><small></small></span></div></section>
        <section className="stats-row"><div className="stat-card"><span className="stat-icon mint-icon"><LibraryBig size={19} /></span><div><b>{resources.length}</b><small>resources in library</small></div></div><div className="stat-card"><span className="stat-icon peach-icon"><UsersRound size={19} /></span><div><b>4</b><small>resource collections</small></div></div><div className="stat-note"><span className="note-star">✳</span><span><b>Made for curious minds</b><small>Find what you need to make learning playful.</small></span></div></section>
        <section className="library-section">
          <div className="section-heading"><div><div className="eyebrow">EXPLORE THE COLLECTION</div><h2>{active}</h2></div><button className="view-button" onClick={() => setNotice('Your resource library is ready to connect to OneDrive.')}>Browse library <ArrowDownToLine size={15} /></button></div>
          <div className="toolbar"><label className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search resources, topics, or materials…" /></label><label className="format-select"><span>Type</span><select value={format} onChange={(event) => setFormat(event.target.value)}><option>All formats</option><option>PDF</option><option>Guide</option><option>Inventory</option></select><ChevronDown size={14} /></label></div>
          <div className="results-line"><span>{filtered.length} resources</span><span>RECS collection <span className="tiny-dot">•</span> Sample content</span></div>
          {filtered.length ? <div className="resource-grid">{filtered.map((item) => { const Icon = item.icon; return <article className="resource-card" key={item.title}><div className={`card-art ${item.color}`}><div className="resource-symbol"><Icon size={27} strokeWidth={1.5} /></div><span className="age-pill">{item.age}</span><button aria-label={`Save ${item.title}`} className="save-button" onClick={() => setNotice(`${item.title} added to your saved resources.`)}>＋</button></div><div className="card-body"><div className="card-type">{item.type}</div><h3>{item.title}</h3><p>{item.detail}</p><div className="card-footer"><span><FileText size={14} />{item.format}</span><button onClick={() => setNotice(`${item.title} will open here once the RECS files are connected.`)}>View resource <span>↗</span></button></div></div></article> })}</div> : <div className="empty-state"><Search size={24} /><b>No resources found</b><span>Try another search or choose a different collection.</span></div>}
          <div className="source-note"><span className="source-mark"><FolderOpen size={17} /></span><span><b>Bring your RECS library together</b><small>Connect OneDrive to make your actual curriculum, activity books, kits, and furniture files searchable here.</small></span><button onClick={() => setNotice('OneDrive connection is planned for the next build step.')}>Learn about setup <span>→</span></button></div>
        </section>
        <footer>ECD RESOURCE HUB <span>·</span> A home for early learning resources</footer>
      </div>
    </main>
    {notice && <div className="toast" role="status"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss">×</button></div>}
  </div>;
}

export default App;
