import { CreditCard, Hotel, MessageCircle, RefreshCw, Webhook } from "lucide-react";
import StatusBadge from "../components/StatusBadge.jsx";

const integrations = [
  { icon:Hotel, name:"PMS / booking engine", detail:"Reservations, rooms, folio events", direction:"Inbound hotel events", mode:"Sandbox adapter" },
  { icon:RefreshCw, name:"OTA channels", detail:"Booking.com, Expedia, Agoda", direction:"Inbound reservation events", mode:"Sandbox adapter" },
  { icon:CreditCard, name:"Payments", detail:"Payment and refund events", direction:"Inbound financial events", mode:"Sandbox adapter" },
  { icon:MessageCircle, name:"Guest messaging", detail:"WhatsApp / email delivery", direction:"Outbound delivery", mode:"Demo delivery" },
  { icon:Webhook, name:"Webhooks & REST", detail:"Signed outbound automation events", direction:"Outbound delivery", mode:"Demo delivery" },
];

export default function Integrations() {
  return <div className="page-stack">
    <div className="page-header"><span className="eyebrow">Connection layer</span><h1>Integrations</h1><p>Adapters connect EZStay to systems of record. In this environment every provider boundary is explicit: no third-party credential is implied when none is configured.</p></div>
    <section className="integration-summary-strip">
      <div><small>Adapters defined</small><b>{integrations.length}</b><span>hotel-facing connection points</span></div>
      <div><small>Live credentials</small><b>0</b><span>public demo remains sandboxed</span></div>
      <div><small>Demo delivery paths</small><b>{integrations.filter(item => item.mode === "Demo delivery").length}</b><span>observable without external accounts</span></div>
    </section>
    <div className="integration-grid">{integrations.map(({icon:Icon,...item}) => <article className="integration-card" key={item.name}>
      <span className="integration-icon"><Icon size={21}/></span>
      <div><h2>{item.name}</h2><p>{item.detail}</p><div className="integration-detail"><span><small>Direction</small><b>{item.direction}</b></span><span><small>Mode</small><b>{item.mode}</b></span></div></div>
      <StatusBadge tone={item.mode === "Demo delivery" ? "blue" : "neutral"}>{item.mode}</StatusBadge>
    </article>)}</div>
    <section className="technical-note"><b>Implementation boundary</b><p>Internal state changes are real inside the sandbox. Provider-facing delivery is simulated until a credentialed adapter is explicitly connected, so the UI never confuses a demo event with a production integration.</p></section>
  </div>;
}
