import StatusBadge from "../components/StatusBadge.jsx";
import { formatHotelClock, formatHotelMoment, shortReference } from "../ui/format.js";

function runTimestamp(run) {
  const audit = (run.audit || []).slice(-1)[0];
  return audit?.effectiveAt || audit?.at || null;
}

export default function ActivityPage({ snapshot, onOpenRun, onRetry, busy }) {
  const delivered = snapshot.deliveries.filter(row => row.status === "Delivered").length;
  const retries = snapshot.deliveries.reduce((sum, row) => sum + Math.max(0, Number(row.attempts || 0) - 1), 0);
  const newestRun = [...snapshot.automationRuns].slice(-1)[0];
  const lastChangedAt = newestRun ? runTimestamp(newestRun) : null;

  return <div className="page-stack">
    <div className="page-header"><span className="eyebrow">Execution & recovery</span><h1>Activity</h1><p>Business mutations and external delivery attempts remain separate records. Operators can inspect what happened, recover only what failed, and retain the original audit trail.</p></div>

    <section className="activity-summary-strip">
      <div><small>Automation runs</small><b>{snapshot.automationRuns.length}</b><span>current sandbox generation</span></div>
      <div><small>Delivery health</small><b>{delivered}/{snapshot.deliveries.length}</b><span>delivered / total</span></div>
      <div><small>Delivery retries</small><b>{retries}</b><span>additional attempts recorded</span></div>
      <div><small>Last change</small><b>{lastChangedAt ? formatHotelClock(lastChangedAt, snapshot.hotel.timezone) : "—"}</b><span>{lastChangedAt ? formatHotelMoment(lastChangedAt, snapshot.hotel.timezone) : "No activity yet"}</span></div>
    </section>

    <section className="split-grid">
      <article className="panel"><div className="panel-heading"><div><span className="eyebrow">Execution history</span><h2>Automation runs</h2></div><small>Newest first</small></div><div className="list-table">{[...snapshot.automationRuns].reverse().map(run => {
        const rule = snapshot.automationRules.find(item => item.key === run.ruleKey);
        const at = runTimestamp(run);
        return <button className="list-row clickable activity-row" key={run.id} onClick={() => onOpenRun(run)}>
          <div><b>{run.summary}</b><span>{at ? formatHotelClock(at, snapshot.hotel.timezone) : "—"} · {rule?.name || run.ruleKey} · <span title={run.id}>{shortReference(run.id, 12, 5)}</span></span></div>
          <StatusBadge tone={run.result === "Success" ? "success" : run.result === "Approval" ? "warning" : "danger"}>{run.result}</StatusBadge>
        </button>;
      })}</div></article>

      <article className="panel"><div className="panel-heading"><div><span className="eyebrow">Delivery outbox</span><h2>External effects</h2></div><small>Business action remains authoritative</small></div><div className="list-table">{[...snapshot.deliveries].reverse().map(delivery => <div className="list-row delivery-row" key={delivery.id}>
        <div><b>{delivery.channel}</b><span>{formatHotelMoment(delivery.createdAt, snapshot.hotel.timezone)} · {delivery.attempts} attempt{delivery.attempts === 1 ? "" : "s"} · <span title={delivery.id}>{shortReference(delivery.id, 10, 4)}</span></span>{delivery.lastError && <small className="delivery-error">Last error · {delivery.lastError}</small>}</div>
        <div className="row-actions"><StatusBadge tone={delivery.status === "Delivered" ? "success" : "danger"}>{delivery.status}</StatusBadge>{["Failed","Dead-letter"].includes(delivery.status) && <button disabled={busy} onClick={() => onRetry(delivery.id)}>Retry delivery</button>}</div>
      </div>)}</div></article>
    </section>
  </div>;
}
