import { Building2, CircleHelp, Settings2 } from "lucide-react";
import PrimaryNav from "./PrimaryNav.jsx";

export default function AppShell({ active, onNavigate, session, children, onDemoControl }) {
  return <div className="ez-shell">
    <aside className="sidebar">
      <div className="brand-lockup"><span className="brand-mark">EZ</span><div><b>EZStay</b><small>Operations Automation</small></div></div>
      <div className="property-chip"><Building2 size={16}/><div><b>Northstar Grand</b><span>Demo property · 24 rooms</span></div></div>
      <PrimaryNav active={active} onChange={onNavigate}/>
      <div className="sidebar-foot">
        <button><CircleHelp size={17}/> About this demo</button>
        <button onClick={onDemoControl}><Settings2 size={17}/> Demo control</button>
      </div>
    </aside>
    <div className="workspace">
      <header className="workspace-topbar">
        <div className="demo-banner"><i/><span>Interactive demo · Sample data</span><small>{session?.mode === "backend-sandbox" ? "Backend sandbox" : "Local preview sandbox"}</small></div>
        <button className="control-button" onClick={onDemoControl}>Demo control</button>
      </header>
      <main className="workspace-main">{children}</main>
    </div>
  </div>;
}
