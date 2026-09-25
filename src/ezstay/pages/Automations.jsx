import StatusBadge from "../components/StatusBadge.jsx";
import { formatHotelClock } from "../ui/format.js";

const core = new Set(["guest-request-router","checkout-turnover","low-stock-replenishment","approval-executor"]);

export default function Automations({ snapshot }) {
  const runs = [...snapshot.automationRuns].reverse();
  return <div className="page-stack">
    <div className="page-header"><span className="eyebrow">Automation control</span><h1>Automations</h1><p>Twelve operational rules share the same hotel state. Each rule declares its trigger, authority boundary, and most recent execution in this workspace.</p></div>
    <div className="automation-rule-grid">{snapshot.automationRules.map(rule => {
      const lastRun = runs.find(run => run.ruleKey === rule.key);
      const lastAudit = lastRun?.audit?.slice(-1)[0];
      const lastAt = lastAudit?.effectiveAt || lastAudit?.at;
      return <article className={`automation-rule ${core.has(rule.key) ? "spotlight" : ""}`} key={rule.id}>
        <div className="rule-head"><StatusBadge tone={rule.status === "Active" ? "success" : "neutral"}>{rule.status}</StatusBadge><StatusBadge tone={rule.autonomy === "Approval" ? "warning" : "blue"}>{rule.autonomy}</StatusBadge></div>
        <span className="eyebrow">{rule.eventType}</span><h3>{rule.name}</h3>
        <div className="rule-detail-grid">
          <div><small>Authority</small><b>{rule.autonomy}</b></div>
          <div><small>Last run</small><b>{lastRun ? lastRun.result : "No run"}</b></div>
          <div><small>Observed</small><b>{lastAt ? formatHotelClock(lastAt, snapshot.hotel.timezone) : "Waiting for event"}</b></div>
        </div>
        {core.has(rule.key) && <small className="core-workflow-tag">Core workflow</small>}
      </article>;
    })}</div>
  </div>;
}
