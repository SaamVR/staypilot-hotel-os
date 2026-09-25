import { AlertTriangle, ShieldCheck, TimerReset, Wrench } from "lucide-react";

export default function AttentionQueue({ snapshot, onNavigate }) {
  const failed = snapshot.deliveries.filter(row => ["Failed","Dead-letter"].includes(row.status));
  const overdue = snapshot.tasks.filter(row => row.escalatedAt && row.status !== "Done");
  const pending = snapshot.approvals.filter(row => row.status === "Pending");
  const blocked = snapshot.rooms.filter(row => row.maintenance !== "Clear");
  const items = [
    { icon:AlertTriangle, value:failed.length, label:"Failed delivery", detail:"Retry safely", tone:"danger", target:"activity" },
    { icon:TimerReset, value:overdue.length, label:"Overdue task", detail:"Escalation active", tone:"warning", target:"operations" },
    { icon:ShieldCheck, value:pending.length, label:"Approval waiting", detail:"Human decision", tone:"blue", target:"approvals" },
    { icon:Wrench, value:blocked.length, label:"Blocked room", detail:"Maintenance", tone:"neutral", target:"operations" },
  ];
  return <div className="attention-grid">
    {items.map(({ icon:Icon, ...item }) => <button key={item.label} className={`attention-card attention-${item.tone}`} onClick={() => onNavigate(item.target)}>
      <span className="attention-icon"><Icon size={18}/></span>
      <strong>{item.value}</strong>
      <div><b>{item.label}</b><small>{item.detail}</small></div>
    </button>)}
  </div>;
}
