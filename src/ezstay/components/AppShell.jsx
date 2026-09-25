import { Building2, Settings2 } from "lucide-react";
import PrimaryNav from "./PrimaryNav.jsx";

export default function AppShell({ active, onNavigate, session, hotel, roomCount, children, onDemoControl }) {
  return <div className="ez-shell">
    <aside className="sidebar">
      <div className="brand-lockup"><span className="brand-mark">EZ</span><div><b>EZStay</b><small>Operations Automation</small></div></div>
      <div className="property-chip"><Building2 size={16}/><div><b>{hotel?.name || "Northstar Grand"}</b><span>{roomCount || 0} rooms · {hotel?.timezone || "UTC"}</span></div></div>
      <PrimaryNav active={active} onChange={onNavigate}/>
      <div className="sidebar-foot">
        <button onClick={onDemoControl} aria-label="Demo control"><Settings2 size={17}/> Environment</button>
      </div>
    </aside>
    <div className="workspace">
      <header className="workspace-topbar">
        <div className="demo-banner"><i/><span>Interactive demo · Sample data</span><small>{session?.mode === "backend-sandbox" ? "Backend sandbox" : "Local preview sandbox"}</small></div>
        <button className="control-button" aria-label="Demo control" onClick={onDemoControl}>Environment</button>
      </header>
      <main className="workspace-main">{children}</main>
    </div>
  </div>;
}
