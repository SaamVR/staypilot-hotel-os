import { CreditCard, Hotel, MessageCircle, RefreshCw, Webhook } from "lucide-react";
import StatusBadge from "../components/StatusBadge.jsx";

const integrations = [
  { icon:Hotel, name:"PMS / booking engine", detail:"Reservations, rooms, folio events", direction:"Inbound hotel events", mode:"Sandbox adapter", status:"Not connected", transport:"Webhook + REST", eventScope:"reservation.*, room.*, checkout.*", credentials:"Required for production" },
  { icon:RefreshCw, name:"OTA channels", detail:"Booking.com, Expedia, Agoda", direction:"Inbound reservation events", mode:"Sandbox adapter", status:"Not connected", transport:"Provider API / webhook", eventScope:"reservation.created, reservation.cancelled", credentials:"Provider account required" },
  { icon:CreditCard, name:"Payments", detail:"Payment and refund events", direction:"Inbound financial events", mode:"Sandbox adapter", status:"Not connected", transport:"Signed webhook", eventScope:"payment.failed, refund.completed", credentials:"Secret key required" },
  { icon:MessageCircle, name:"Guest messaging", detail:"WhatsApp / email delivery", direction:"Outbound delivery", mode:"Demo delivery", status:"Demo path active", transport:"Outbox adapter", eventScope:"guest acknowledgement, pre-arrival", credentials:"No live provider credential" },
  { icon:Webhook, name:"Webhooks & REST", detail:"Signed outbound automation events", direction:"Outbound delivery", mode:"Demo delivery", status:"Demo path active", transport:"HTTPS + HMAC", eventScope:"automation.run, delivery.recovery", credentials:"No live endpoint credential" },
];

export default function Integrations() {
  const activeDemoPaths = integrations.filter(item => item.status === "Demo path active").length;
  return <div className="page-stack">
    <div className="page-header"><span className="eyebrow">Connection layer</span><h1>Integrations</h1><p>Adapters connect EZStay to systems of record. This environment exposes the same connection contracts without implying provider credentials that are not configured.</p></div>
    <section className="integration-summary-strip">
      <div><small>Adapters defined</small><b>{integrations.length}</b><span>hotel-facing connection points</span></div>
      <div><small>Live credentials</small><b>0</b><span>no production provider secrets loaded</span></div>
      <div><small>Demo delivery paths</small><b>{activeDemoPaths}</b><span>observable through the sandbox outbox</span></div>
    </section>
    <div className="integration-grid">{integrations.map(({icon:Icon,...item}) => <details className="integration-card integration-contract" key={item.name}>
      <summary>
        <span className="integration-icon"><Icon size={21}/></span>
        <div className="integration-card-copy"><h2>{item.name}</h2><p>{item.detail}</p><div className="integration-detail"><span><small>Direction</small><b>{item.direction}</b></span><span><small>Mode</small><b>{item.mode}</b></span></div></div>
        <div className="integration-card-status"><StatusBadge tone={item.status === "Demo path active" ? "blue" : "neutral"}>{item.status}</StatusBadge><small>Inspect adapter</small></div>
      </summary>
      <div className="adapter-contract-grid">
        <div><small>Transport</small><b>{item.transport}</b></div>
        <div><small>Event scope</small><b>{item.eventScope}</b></div>
        <div><small>Credentials</small><b>{item.credentials}</b></div>
      </div>
    </details>)}</div>
    <section className="technical-note"><b>Implementation boundary</b><p>Internal state changes are authoritative inside the sandbox. Provider-facing delivery is simulated until a credentialed adapter is explicitly connected, so a demo event is never presented as a production integration.</p></section>
  </div>;
}
