import { BedDouble, Box, ChevronDown, MessageSquareText, RotateCcw } from "lucide-react";

const scenarios = [
  { key:"guest", icon:MessageSquareText, step:"01", title:"Guest request → assigned task", text:"Route a real in-stay request into housekeeping with a linked task and acknowledgement." },
  { key:"checkout", icon:BedDouble, step:"02", title:"Checkout → room ready", text:"Close the stay, create turnover work, then complete housekeeping to release the room only when readiness rules allow it." },
  { key:"stock", icon:Box, step:"03", title:"Low stock → approval", text:"Evaluate par level, stop at policy, then let a human authorize the purchase draft." },
  { key:"recovery", icon:RotateCcw, step:"04", title:"Failure → safe recovery", text:"Retry an exhausted delivery without replaying the hotel action that already succeeded." },
];

export default function ScenarioLauncher({ onRun, busy }) {
  return <section className="scenario-section scenario-section-compact">
    <details className="workflow-lab">
      <summary>
        <div className="workflow-lab-summary">
          <span className="eyebrow">Controlled workflows</span>
          <h2>Workflow Lab</h2>
          <p>4 isolated scenarios · deterministic state · inspectable execution traces</p>
        </div>
        <span className="workflow-lab-action">Open lab <ChevronDown size={16}/></span>
      </summary>
      <div className="workflow-lab-body">
        <div className="section-heading">
          <div><span className="eyebrow">Sandbox controls</span><h2>Run a workflow in this sandbox.</h2></div>
          <p>Each scenario deliberately changes workspace state and opens the exact execution record behind the result.</p>
        </div>
        <div className="scenario-grid">
          {scenarios.map(({ key, icon:Icon, step, title, text }) => <article className="scenario-card" key={key}>
            <div className="scenario-top"><span>{step}</span><Icon size={20}/></div>
            <h3>{title}</h3>
            <p>{text}</p>
            <button disabled={busy} onClick={() => onRun(key)}>{busy ? "Running…" : "Run scenario"} <span>→</span></button>
          </article>)}
        </div>
      </div>
    </details>
  </section>;
}
