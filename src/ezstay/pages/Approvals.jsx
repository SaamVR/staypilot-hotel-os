import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import StatusBadge from "../components/StatusBadge.jsx";
import { formatCurrency, formatHotelMoment, minutesBetween, shortReference } from "../ui/format.js";
import { scrollRecordIntoView } from "../ui/recordFocus.js";

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
  const room = item.roomId
    ? snapshot.rooms.find(row => row.id === item.roomId)
    : roomNumber ? snapshot.rooms.find(row => row.number === roomNumber) : null;
  const linkedTask = item.taskId
    ? snapshot.tasks.find(row => row.id === item.taskId)
    : snapshot.tasks.find(row => row.team === "Maintenance" && row.roomId === room?.id && row.status !== "Done");
  const vendor = item.detail?.split(" · ")[0] || "—";
  return [
    ["Operational impact", room ? `Room ${room.number} · ${room.maintenance}` : "Manual review"],
    ["Vendor", vendor],
    ["Linked work", linkedTask ? `${linkedTask.title} · ${linkedTask.status}` : "Maintenance follow-up"],
  ];
}

export default function Approvals({ snapshot, onResolve, busy, focusRecord }) {
  const [approvalView, setApprovalView] = useState("Pending decisions");
  const pending = snapshot.approvals.filter(item => item.status === "Pending");
  const history = snapshot.approvals.filter(item => item.status !== "Pending");
  const visibleApprovals = approvalView === "Pending decisions" ? pending : history;
  const pendingValue = pending.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const oldestMinutes = pending.length
    ? Math.max(...pending.map(item => minutesBetween(snapshot.meta.demoNow, item.createdAt)))
    : 0;

  useEffect(() => {
    if (focusRecord?.type !== "approval") return;
    const item = snapshot.approvals.find(row => row.id === focusRecord.id);
    if (item) setApprovalView(item.status === "Pending" ? "Pending decisions" : "Decision history");
  }, [focusRecord, snapshot.approvals]);

  useEffect(() => scrollRecordIntoView(focusRecord?.id), [focusRecord, approvalView, snapshot]);

  return <div className="page-stack">
    <div className="page-header"><span className="eyebrow">Human authority</span><h1>Approvals</h1><p>Policy-bound work pauses here for an authorized decision. Context, outcome, and downstream effects remain traceable in the same execution history.</p></div>

    <section className="approval-summary-strip" aria-label="Approval queue summary">
      <div><small>Waiting decisions</small><b>{pending.length}</b><span>policy gates requiring a person</span></div>
      <div><small>Pending value</small><b>{formatCurrency(pendingValue, snapshot.hotel.currency)}</b><span>across current approval requests</span></div>
      <div><small>Oldest waiting</small><b>{oldestMinutes} min</b><span>against the deterministic demo clock</span></div>
    </section>

    <div className="operator-filter-bar approval-view-filter" aria-label="Approval views">
      <button className={approvalView === "Pending decisions" ? "active" : ""} onClick={() => setApprovalView("Pending decisions")}>Pending decisions<span>{pending.length}</span></button>
      <button className={approvalView === "Decision history" ? "active" : ""} onClick={() => setApprovalView("Decision history")}>Decision history<span>{history.length}</span></button>
    </div>

    <section className="approval-grid">{visibleApprovals.map(item => {
      const context = contextFor(item, snapshot);
      return <article className={`approval-card ${focusRecord?.id === item.id ? "record-focus" : ""}`} data-record-id={item.id} key={item.id}>
        <div className="approval-top"><StatusBadge tone={item.status === "Pending" ? "warning" : item.status === "Approved" ? "success" : "neutral"}>{item.status}</StatusBadge><small>{item.type}</small></div>
        <h2>{item.title}</h2><p>{item.detail}</p>
        <div className="approval-context-grid">{context.map(([label, value]) => <div key={label}><small>{label}</small><b>{value}</b></div>)}</div>
        <div className="approval-meta"><span>Requested by <b>{item.requestedBy || item.requestedByActor}</b><small>{formatHotelMoment(item.createdAt, snapshot.hotel.timezone)}</small></span>{item.amount != null && <strong>{formatCurrency(item.amount, snapshot.hotel.currency)}</strong>}</div>
        {item.status === "Pending" && <div className="approval-actions"><button disabled={busy} className="approve" onClick={() => onResolve(item.id, "Approved")}><Check size={15}/> Approve</button><button disabled={busy} onClick={() => onResolve(item.id, "Rejected")}><X size={15}/> Reject</button></div>}
      </article>;
    })}</section>
    {!visibleApprovals.length && <div className="filtered-empty">{approvalView === "Pending decisions" ? "No decisions are waiting for human authority." : "No approval decisions have been recorded in this workspace yet."}</div>}

    {snapshot.purchaseRequests.length > 0 && <section className="panel purchase-panel">
      <div className="panel-heading"><div><span className="eyebrow">Authorized output</span><h2>Purchase drafts</h2></div><small>Inventory changes only after a separate receipt event.</small></div>
      <div className="list-table">{snapshot.purchaseRequests.map(po => {
        const inventory = snapshot.inventory.find(row => row.id === po.inventoryItemId);
        return <div className={`list-row purchase-draft-row ${focusRecord?.id === po.id ? "record-focus" : ""}`} data-record-id={po.id} key={po.id}>
          <div className="purchase-main"><b>{inventory?.item || "Purchase request"}</b><span>{po.supplier} · {po.quantity} {inventory?.unit || "units"}</span></div>
          <div className="purchase-meta"><span><small>Amount</small><b>{formatCurrency(po.amount, snapshot.hotel.currency)}</b></span><span><small>Source approval</small><b title={po.approvalId}>{shortReference(po.approvalId, 10, 4)}</b></span><span><small>Created</small><b>{formatHotelMoment(po.createdAt, snapshot.hotel.timezone)}</b></span></div>
          <StatusBadge tone="blue">{po.status}</StatusBadge>
        </div>;
      })}</div>
    </section>}
  </div>;
}
