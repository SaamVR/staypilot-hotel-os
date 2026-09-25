import { Activity, BedDouble, CheckCircle2, ShieldCheck } from "lucide-react";
import { deriveHotelMetrics } from "../domain/derive.js";
import AttentionQueue from "../components/AttentionQueue.jsx";
import AutomationFeed from "../components/AutomationFeed.jsx";
import ScenarioLauncher from "../components/ScenarioLauncher.jsx";

export default function CommandCenter({ snapshot, onNavigate, onRunScenario, onOpenRun, busy }) {
  const metrics = deriveHotelMetrics(snapshot);
  return <>
    <section className="command-hero">
      <div className="hero-copy">
        <span className="eyebrow">Northstar Grand · Operations command</span>
        <h1>Automate the routine.<br/><em>Surface the exception.</em></h1>
        <p>Every event below can trigger a real state change inside this demo workspace. Inspect the run to see the trigger, policy decision, mutation, delivery, and audit evidence.</p>
      </div>
      <div className="hero-proof">
        <span><i className="pulse-dot"/> Automation operating</span>
        <b>{snapshot.automationRules.filter(rule => rule.status === "Active").length} active rules</b>
        <small>Policy boundaries + idempotent execution</small>
      </div>
    </section>

    <section className="attention-section">
      <div className="section-heading compact"><div><span className="eyebrow">Attention now</span><h2>Only what needs a human.</h2></div></div>
      <AttentionQueue snapshot={snapshot} onNavigate={onNavigate}/>
    </section>

    <section className="metric-strip">
      <div><span className="metric-icon"><BedDouble size={17}/></span><small>Sellable now</small><b>{metrics.cleanVacantRooms}</b><em>of {metrics.totalRooms} rooms</em></div>
      <div><span className="metric-icon"><Activity size={17}/></span><small>Open work</small><b>{metrics.openTasks}</b><em>tasks across teams</em></div>
      <div><span className="metric-icon"><ShieldCheck size={17}/></span><small>Human gates</small><b>{metrics.pendingApprovals}</b><em>pending decisions</em></div>
      <div><span className="metric-icon"><CheckCircle2 size={17}/></span><small>Delivery health</small><b>{snapshot.deliveries.length - metrics.failedDeliveries}/{snapshot.deliveries.length}</b><em>successful / total</em></div>
    </section>

    <ScenarioLauncher onRun={onRunScenario} busy={busy}/>
    <AutomationFeed runs={snapshot.automationRuns} onOpenRun={onOpenRun}/>
  </>;
}
