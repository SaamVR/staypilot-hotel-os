import { Building2, Settings2 } from "lucide-react";
import PrimaryNav from "./PrimaryNav.jsx";
import { formatHotelClock } from "../ui/format.js";

export default function AppShell({ active, onNavigate, hotel, roomCount, demoNow, children, onDemoControl }) {
  const timeZone = hotel?.timezone || "UTC";
  return <div className="ez-shell">
    <aside className="sidebar">
      <div className="brand-lockup"><span className="brand-mark">EZ</span><div><b>EZStay</b><small>Operations Automation</small></div></div>
      <div className="property-chip"><Building2 size={16}/><div><b>{hotel?.name || "Northstar Grand"}</b><span>{roomCount || 0} rooms · {timeZone}</span></div></div>
      <PrimaryNav active={active} onChange={onNavigate}/>
    </aside>
    <div className="workspace">
      <header className="workspace-topbar">
        <div className="workspace-context">
          <b>{hotel?.name || "Northstar Grand"}</b>
          <span>{formatHotelClock(demoNow, timeZone)} hotel time</span>
        </div>
        <button className="sandbox-button" aria-label="Sandbox environment" onClick={onDemoControl}>
          <i/><span>Sandbox</span><Settings2 size={14}/>
        </button>
      </header>
      <main className="workspace-main">{children}</main>
    </div>
  </div>;
}
