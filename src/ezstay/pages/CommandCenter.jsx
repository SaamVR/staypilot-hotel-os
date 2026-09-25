import { Activity, BedDouble, CalendarCheck2, LogOut } from "lucide-react";
import { deriveHotelMetrics } from "../domain/derive.js";
import { formatHotelMoment } from "../ui/format.js";
import AttentionQueue from "../components/AttentionQueue.jsx";
import AutomationFeed from "../components/AutomationFeed.jsx";
import ScenarioLauncher from "../components/ScenarioLauncher.jsx";

function guestSummary(rows) {
  const names = rows.map(row => row.guestName?.split(" ")[0]).filter(Boolean);
  if (!names.length) return "No scheduled movement";
  if (names.length <= 2) return names.join(" · ");
  return `${names.slice(0, 2).join(" · ")} +${names.length - 2}`;
}

export default function CommandCenter({ snapshot, onNavigate, onRunScenario, onOpenRun, busy }) {
  const metrics = deriveHotelMetrics(snapshot);
  const today = String(snapshot.meta?.demoNow || "").slice(0, 10);
  const arrivals = snapshot.reservations.filter(row => row.checkIn === today && row.status !== "Cancelled");
  const departures = snapshot.reservations.filter(row => row.checkOut === today && row.status !== "Cancelled");
  const activeRules = snapshot.automationRules.filter(rule => rule.status === "Active").length;

  return <>
    <section className="command-hero command-hero-product">
      <div className="hero-copy">
        <span className="eyebrow">{snapshot.hotel.name} · Live operations</span>
        <h1>Command Center</h1>
        <p>{formatHotelMoment(snapshot.meta.demoNow, snapshot.hotel.timezone)} · {snapshot.hotel.timezone}. Exceptions, room readiness, and human decisions are surfaced here while routine work continues through automation.</p>
      </div>
      <div className="hero-proof">
        <span><i className="pulse-dot"/> Automation online</span>
        <b>{activeRules}/{snapshot.automationRules.length} rules active</b>
        <small>{metrics.failedDeliveries} delivery exception · {metrics.pendingApprovals} decisions waiting</small>
      </div>
    </section>

    <section className="shift-overview" aria-label="Today's hotel operations">
      <div className="shift-overview-head"><span className="eyebrow">Today at a glance</span><small>Derived from the current Northstar hotel state</small></div>
      <div className="shift-overview-grid">
        <article className="shift-card"><span className="shift-icon"><CalendarCheck2 size={18}/></span><div><small>Arrivals today</small><b>{arrivals.length}</b><em>{guestSummary(arrivals)}</em></div></article>
        <article className="shift-card"><span className="shift-icon"><LogOut size={18}/></span><div><small>Departures today</small><b>{departures.length}</b><em>{guestSummary(departures)}</em></div></article>
        <article className="shift-card"><span className="shift-icon"><BedDouble size={18}/></span><div><small>Rooms sellable now</small><b>{metrics.cleanVacantRooms}/{metrics.totalRooms}</b><em>{metrics.reservedRooms} reserved · {metrics.blockedRooms} blocked</em></div></article>
        <article className="shift-card"><span className="shift-icon"><Activity size={18}/></span><div><small>Open service work</small><b>{metrics.openTasks}</b><em>{snapshot.guestRequests.filter(row => row.status !== "Closed").length} guest request{snapshot.guestRequests.filter(row => row.status !== "Closed").length === 1 ? "" : "s"} open</em></div></article>
      </div>
    </section>

    <section className="attention-section">
      <div className="section-heading compact"><div><span className="eyebrow">Needs attention</span><h2>Exceptions and approvals only.</h2></div><p>Routine events stay out of the way unless policy, SLA, delivery, or room readiness needs a person.</p></div>
      <AttentionQueue snapshot={snapshot} onNavigate={onNavigate}/>
    </section>

    <AutomationFeed runs={snapshot.automationRuns} onOpenRun={onOpenRun} timeZone={snapshot.hotel.timezone}/>
    <ScenarioLauncher onRun={onRunScenario} busy={busy}/>
  </>;
}
