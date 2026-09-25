import { Check, X } from "lucide-react";
import StatusBadge from "../components/StatusBadge.jsx";

export default function Approvals({ snapshot, onResolve, busy }) {
  return <div className="page-stack">
    <div className="page-header"><span className="eyebrow">Human-in-the-loop</span><h1>Approvals</h1><p>Automations stop at explicit authority boundaries. A human decision becomes the next auditable event.</p></div>
    <section className="approval-grid">{snapshot.approvals.map(item => <article className="approval-card" key={item.id}>
      <div className="approval-top"><StatusBadge tone={item.status === "Pending" ? "warning" : item.status === "Approved" ? "success" : "neutral"}>{item.status}</StatusBadge><small>{item.type}</small></div>
      <h2>{item.title}</h2><p>{item.detail}</p>
      <div className="approval-meta"><span>Requested by <b>{item.requestedBy || item.requestedByActor}</b></span>{item.amount != null && <strong>${Number(item.amount).toFixed(2)}</strong>}</div>
      {item.status === "Pending" && item.inventoryItemId && <div className="approval-actions"><button disabled={busy} className="approve" onClick={() => onResolve(item.id, "Approved")}><Check size={15}/> Approve</button><button disabled={busy} onClick={() => onResolve(item.id, "Rejected")}><X size={15}/> Reject</button></div>}
    </article>)}</section>
    {snapshot.purchaseRequests.length > 0 && <section className="panel"><div className="panel-heading"><div><span className="eyebrow">Authorized output</span><h2>Purchase drafts</h2></div></div><div className="list-table">{snapshot.purchaseRequests.map(po => <div className="list-row" key={po.id}><div><b>{po.supplier}</b><span>{po.quantity} units · approval {po.approvalId}</span></div><StatusBadge tone="blue">{po.status}</StatusBadge></div>)}</div></section>}
  </div>;
}
