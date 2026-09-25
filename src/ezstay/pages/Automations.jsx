import StatusBadge from "../components/StatusBadge.jsx";

const spotlight = new Set(["guest-request-router","checkout-turnover","low-stock-replenishment","approval-executor"]);

export default function Automations({ snapshot }) {
  return <div className="page-stack">
    <div className="page-header"><span className="eyebrow">Automation control</span><h1>Automations</h1><p>Twelve operational rules share one hotel context. The four highlighted workflows are the interactive portfolio proof.</p></div>
    <div className="automation-rule-grid">{snapshot.automationRules.map(rule => <article className={`automation-rule ${spotlight.has(rule.key) ? "spotlight" : ""}`} key={rule.id}>
      <div className="rule-head"><StatusBadge tone={rule.status === "Active" ? "success" : "neutral"}>{rule.status}</StatusBadge><StatusBadge tone={rule.autonomy === "Approval" ? "warning" : "blue"}>{rule.autonomy}</StatusBadge></div>
      <span className="eyebrow">{rule.eventType}</span><h3>{rule.name}</h3>
      <div className="rule-flow"><span>Trigger</span><i>→</i><span>Decision</span><i>→</i><span>Action</span></div>
      {spotlight.has(rule.key) && <small className="showcase-tag">Showcase workflow</small>}
    </article>)}</div>
  </div>;
}
