import StatusBadge from "../components/StatusBadge.jsx";

export default function ActivityPage({ snapshot, onOpenRun, onRetry, busy }) {
  return <div className="page-stack">
    <div className="page-header"><span className="eyebrow">Evidence & recovery</span><h1>Activity</h1><p>Business execution and delivery are separate records so a failed notification never erases a successful hotel action.</p></div>
    <section className="split-grid">
      <article className="panel"><div className="panel-heading"><div><span className="eyebrow">Execution history</span><h2>Automation runs</h2></div></div><div className="list-table">{[...snapshot.automationRuns].reverse().map(run => <button className="list-row clickable" key={run.id} onClick={() => onOpenRun(run)}><div><b>{run.summary}</b><span>{run.id} · {run.ruleKey}</span></div><StatusBadge tone={run.result === "Success" ? "success" : run.result === "Approval" ? "warning" : "danger"}>{run.result}</StatusBadge></button>)}</div></article>
      <article className="panel"><div className="panel-heading"><div><span className="eyebrow">Delivery outbox</span><h2>External effects</h2></div></div><div className="list-table">{snapshot.deliveries.map(delivery => <div className="list-row" key={delivery.id}><div><b>{delivery.channel}</b><span>{delivery.id} · {delivery.attempts} attempts</span></div><div className="row-actions"><StatusBadge tone={delivery.status === "Delivered" ? "success" : "danger"}>{delivery.status}</StatusBadge>{["Failed","Dead-letter"].includes(delivery.status) && <button disabled={busy} onClick={() => onRetry(delivery.id)}>Retry delivery</button>}</div></div>)}</div></article>
    </section>
  </div>;
}
