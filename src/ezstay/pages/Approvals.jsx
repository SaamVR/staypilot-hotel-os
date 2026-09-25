import { Check, X } from "lucide-react";
import StatusBadge from "../components/StatusBadge.jsx";
import { formatCurrency, formatHotelMoment, minutesBetween, shortReference } from "../ui/format.js";

function contextFor(item, snapshot) {
  const inventory = snapshot.inventory.find(row => row.id === item.inventoryItemId);
  if (inventory) {
    return [
      ["Stock / par", `${inventory.stock} / ${inventory.par} ${inventory.unit}`],
      ["Requested", `${item.quantity} ${inventory.unit}`],
      ["Supplier", inventory.supplier],
    ];
  }

  const roomNumber = item.title?.match(/Room\s+(\d{3})/i)?.[1];
  const room = roomNumber ? snapshot.rooms.find(row => row.number === roomNumber) : null;
  const vendor = item.detail?.split(" · ")[0] || "—";
  return [
    ["Operational impact", room ? `Room ${room.number} · ${room.maintenance}` : "Manual review"],
    ["Vendor", vendor],
    ["Decision type", item.type],
  ];
}

export default function Approvals({ snapshot, onResolve, busy }) {
  const pending = snapshot.approvals.filter(item => item.status === "Pending");
  const pendingValue = pending.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const oldestMinutes = pending.length
    ? Math.max(...pending.map(item => minutesBetween(snapshot.meta.demoNow, item.createdAt)))
    : 0;

  return <div className="page-stack">
    <div className="page-header"><span className="eyebrow">Human authority</span><h1>Approvals</h1><p>Policy-bound work pauses here. Every decision is recorded as part of the automation run instead of disappearing into a generic confirmation dialog.</p></div>

    <section className="approval-summary-strip" aria-label="Approval queue summary">
      <div><small>Waiting decisions</small><b>{pending.length}</b><span>policy gates requiring a person</span></div>
      <div><small>Pending value</small><b>{formatCurrency(pendingValue, snapshot.hotel.currency)}</b><span>across current approval requests</span></div>
      <div><small>Oldest waiting</small><b>{oldestMinutes} min</b><span>against the deterministic demo clock</span></div>
    </section>

    <section className="approval-grid">{snapshot.approvals.map(item => {
      const context = contextFor(item, snapshot);
      return <article className="approval-card" key={item.id}>
        <div className="approval-top"><StatusBadge tone={item.status === "Pending" ? "warning" : item.status === "Approved" ? "success" : "neutral"}>{item.status}</StatusBadge><small>{item.type}</small></div>
        <h2>{item.title}</h2><p>{item.detail}</p>
        <div className="approval-context-grid">{context.map(([label, value]) => <div key={label}><small>{label}</small><b>{value}</b></div>)}</div>
        <div className="approval-meta"><span>Requested by <b>{item.requestedBy || item.requestedByActor}</b><small>{formatHotelMoment(item.createdAt, snapshot.hotel.timezone)}</small></span>{item.amount != null && <strong>{formatCurrency(item.amount, snapshot.hotel.currency)}</strong>}</div>
        {item.status === "Pending" && <div className="approval-actions"><button disabled={busy} className="approve" onClick={() => onResolve(item.id, "Approved")}><Check size={15}/> Approve</button><button disabled={busy} onClick={() => onResolve(item.id, "Rejected")}><X size={15}/> Reject</button></div>}
      </article>;
    })}</section>

    {snapshot.purchaseRequests.length > 0 && <section className="panel purchase-panel">
      <div className="panel-heading"><div><span className="eyebrow">Authorized output</span><h2>Purchase drafts</h2></div><small>Inventory changes only after a separate receipt event.</small></div>
      <div className="list-table">{snapshot.purchaseRequests.map(po => {
        const inventory = snapshot.inventory.find(row => row.id === po.inventoryItemId);
        return <div className="list-row purchase-draft-row" key={po.id}>
          <div className="purchase-main"><b>{inventory?.item || "Purchase request"}</b><span>{po.supplier} · {po.quantity} {inventory?.unit || "units"}</span></div>
          <div className="purchase-meta"><span><small>Amount</small><b>{formatCurrency(po.amount, snapshot.hotel.currency)}</b></span><span><small>Source approval</small><b title={po.approvalId}>{shortReference(po.approvalId, 10, 4)}</b></span><span><small>Created</small><b>{formatHotelMoment(po.createdAt, snapshot.hotel.timezone)}</b></span></div>
          <StatusBadge tone="blue">{po.status}</StatusBadge>
        </div>;
      })}</div>
    </section>}
  </div>;
}
