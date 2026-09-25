import { X, ArrowUpRight } from "lucide-react";
import StatusBadge from "./StatusBadge.jsx";
import { formatHotelMoment, shortReference } from "../ui/format.js";

function JsonBlock({ value }) {
  return <pre>{JSON.stringify(value, null, 2)}</pre>;
}

function humanize(value) {
  return String(value || "")
    .split("-")
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function RunInspector({ run, onClose, onLinkedRecord }) {
  if (!run) return null;
  const tone = run.result === "Success" ? "success" : run.result === "Approval" ? "warning" : run.result === "Failed" ? "danger" : "neutral";
  const audit = (run.audit || []).slice(-1)[0];
  const effectiveAt = audit?.effectiveAt || audit?.at;
  return <div className="drawer-backdrop" onMouseDown={onClose}>
    <aside className="run-drawer" onMouseDown={event => event.stopPropagation()} aria-label="Automation run inspector">
      <header className="run-head">
        <div><span className="eyebrow">Automation run</span><h2 title={run.id}>{shortReference(run.id, 13, 6)}</h2><small className="run-rule-label">{humanize(run.ruleKey)}</small></div>
        <button className="icon-button" onClick={onClose} aria-label="Close run inspector"><X size={18}/></button>
      </header>
      <div className="run-summary"><StatusBadge tone={tone}>{run.result}</StatusBadge><p>{run.summary}</p></div>
      <div className="run-facts">
        <div><small>Authority</small><b>{run.decision?.autonomy || "—"}</b></div>
        <div><small>State changes</small><b>{(run.changes || []).length}</b></div>
        <div><small>Deliveries</small><b>{(run.delivery || []).length}</b></div>
        <div><small>Effective</small><b>{effectiveAt ? formatHotelMoment(effectiveAt, "Asia/Dhaka") : "—"}</b></div>
      </div>
      <section><h3>Input</h3><JsonBlock value={run.input}/></section>
      <section><h3>Decision</h3><div className="decision-card"><b>{run.decision?.autonomy}</b><p>{run.decision?.reason}</p></div></section>
      <section><h3>Changes</h3><div className="trace-list">{(run.changes || []).map((item,index) => <div key={index}><i/><span><b>{item.action}</b><small>{item.entityType} · <span title={item.entityId}>{shortReference(item.entityId, 12, 5)}</span></small></span></div>)}</div></section>
      <section><h3>Delivery</h3>{(run.delivery || []).length ? <div className="trace-list">{run.delivery.map(item => <div key={item.id}><i/><span><b>{item.status}</b><small title={item.id}>{shortReference(item.id, 12, 5)}</small></span></div>)}</div> : <p className="muted">No external delivery was required.</p>}</section>
      <section><h3>Audit</h3><div className="trace-list">{(run.audit || []).map((item,index) => <div key={index}><i/><span><b>{item.message}</b><small>{item.effectiveAt || item.at}</small></span></div>)}</div></section>
      <section><h3>Linked records</h3><div className="linked-list">{(run.linkedRecords || []).map(item => <button key={item.type + item.id} onClick={() => onLinkedRecord(item)}><span>{item.label}</span><small>{item.type}</small><ArrowUpRight size={14}/></button>)}</div></section>
      <details className="trace-identifiers"><summary>Trace identifiers</summary><dl><div><dt>Run ID</dt><dd>{run.id}</dd></div><div><dt>Event ID</dt><dd>{run.eventId}</dd></div><div><dt>Rule key</dt><dd>{run.ruleKey}</dd></div></dl></details>
    </aside>
  </div>;
}
