import { ArrowRight, CheckCircle2, CircleAlert, Clock3, ShieldCheck } from "lucide-react";
import StatusBadge from "./StatusBadge.jsx";

const toneFor = result => result === "Success" ? "success" : result === "Approval" ? "warning" : result === "Failed" ? "danger" : "neutral";

export default function AutomationFeed({ runs, onOpenRun }) {
  const rows = [...runs].slice(-6).reverse();
  return <section className="panel automation-feed">
    <div className="panel-heading">
      <div><span className="eyebrow">Automation activity</span><h2>What the system changed</h2></div>
      <span className="live-chip"><i/> live demo state</span>
    </div>
    <div className="feed-list">
      {rows.length ? rows.map(run => <button className="feed-row" key={run.id} onClick={() => onOpenRun(run)}>
        <span className={`feed-icon feed-${toneFor(run.result)}`}>{run.result === "Success" ? <CheckCircle2 size={17}/> : run.result === "Approval" ? <ShieldCheck size={17}/> : <CircleAlert size={17}/>}</span>
        <div className="feed-copy"><b>{run.summary}</b><span>{run.ruleKey} · {run.eventId}</span></div>
        <StatusBadge tone={toneFor(run.result)}>{run.result}</StatusBadge>
        <ArrowRight size={15}/>
      </button>) : <div className="empty-state"><Clock3 size={20}/><p>Run a scenario to create a trace.</p></div>}
    </div>
  </section>;
}
