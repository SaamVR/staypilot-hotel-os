import { useState } from "react";
import StatusBadge from "../components/StatusBadge.jsx";
import { formatHotelClock } from "../ui/format.js";

const core = new Set(["guest-request-router","checkout-turnover","low-stock-replenishment","approval-executor"]);
const authorityFilters = ["All rules","Auto","Policy","Approval"];

export default function Automations({ snapshot }) {
  const runs = [...snapshot.automationRuns].reverse();
  const [authority, setAuthority] = useState("All rules");
  const filteredRules = snapshot.automationRules.filter(rule => authority === "All rules" || rule.autonomy === authority);

  return <div className="page-stack">
    <div className="page-header"><span className="eyebrow">Automation control</span><h1>Automations</h1><p>Twelve operational rules share the same hotel state. Filter by authority to see what runs automatically, what is policy-bound, and what must stop for approval.</p></div>
    <div className="automation-filter-bar" aria-label="Automation authority filters">
      {authorityFilters.map(label => <button key={label} className={authority === label ? "active" : ""} onClick={() => setAuthority(label)}>{label}<span>{label === "All rules" ? snapshot.automationRules.length : snapshot.automationRules.filter(rule => rule.autonomy === label).length}</span></button>)}
      <small>{filteredRules.length} rules shown</small>
    </div>
    <div className="automation-rule-grid">{filteredRules.map(rule => {
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
