import { ArrowRight, CheckCircle2, CircleAlert, Clock3, ShieldCheck } from "lucide-react";
import StatusBadge from "./StatusBadge.jsx";
import { formatHotelClock, shortReference } from "../ui/format.js";

const toneFor = result => result === "Success" ? "success" : result === "Approval" ? "warning" : result === "Failed" ? "danger" : "neutral";

export default function AutomationFeed({ runs, onOpenRun, timeZone = "UTC" }) {
  const rows = [...runs].slice(-6).reverse();
  return <section className="panel automation-feed">
    <div className="panel-heading">
      <div><span className="eyebrow">Execution history</span><h2>Recent automation runs</h2></div>
      <span className="live-chip"><i/> current workspace</span>
    </div>
    <div className="feed-list">
      {rows.length ? rows.map(run => {
        const audit = (run.audit || []).slice(-1)[0];
        const at = audit?.effectiveAt || audit?.at;
        return <button className="feed-row" key={run.id} onClick={() => onOpenRun(run)}>
          <span className={`feed-icon feed-${toneFor(run.result)}`}>{run.result === "Success" ? <CheckCircle2 size={17}/> : run.result === "Approval" ? <ShieldCheck size={17}/> : <CircleAlert size={17}/>}</span>
          <div className="feed-copy"><b>{run.summary}</b><span>{at ? formatHotelClock(at, timeZone) : "—"} · {run.ruleKey} · <span title={run.id}>{shortReference(run.id, 10, 4)}</span></span></div>
          <StatusBadge tone={toneFor(run.result)}>{run.result}</StatusBadge>
          <ArrowRight size={15}/>
        </button>;
      }) : <div className="empty-state"><Clock3 size={20}/><p>No automation run has been recorded in this workspace yet.</p></div>}
    </div>
  </section>;
}
