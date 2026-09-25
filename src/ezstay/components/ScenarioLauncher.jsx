import { BedDouble, Box, MessageSquareText, RotateCcw } from "lucide-react";

const scenarios = [
  { key:"guest", icon:MessageSquareText, step:"01", title:"Guest request → assigned task", text:"Route an in-stay request into Housekeeping with linked work and acknowledgement." },
  { key:"checkout", icon:BedDouble, step:"02", title:"Checkout → room ready", text:"Close the stay, create turnover work, then release the room only after readiness rules pass." },
  { key:"stock", icon:Box, step:"03", title:"Low stock → approval", text:"Evaluate par level, stop at policy, then authorize the downstream purchase draft." },
  { key:"recovery", icon:RotateCcw, step:"04", title:"Failure → safe recovery", text:"Retry an exhausted delivery without replaying the completed hotel action." },
];

export default function ScenarioLauncher({ onRun, busy }) {
  return <section className="sandbox-workflows">
    <div className="sandbox-workflow-heading">
      <span className="eyebrow">Test automations</span>
      <h3>Controlled workflow tests</h3>
      <p>Each test uses the current sandbox state and opens the resulting execution trace.</p>
    </div>
    <div className="sandbox-scenario-list">
      {scenarios.map(({ key, icon:Icon, step, title, text }) => <button className="sandbox-scenario-row" key={key} disabled={busy} onClick={() => onRun(key)}>
        <span className="sandbox-scenario-icon"><Icon size={17}/></span>
        <span className="sandbox-scenario-copy"><small>{step}</small><b>{title}</b><em>{text}</em></span>
        <strong>{busy ? "Running…" : "Run"}</strong>
      </button>)}
    </div>
  </section>;
}
