import { CreditCard, Hotel, MessageCircle, RefreshCw, Webhook } from "lucide-react";
import StatusBadge from "../components/StatusBadge.jsx";

const integrations = [
  { icon:Hotel, name:"Existing PMS", detail:"Reservations, rooms, folio events", state:"Simulated" },
  { icon:RefreshCw, name:"OTA channels", detail:"Booking.com, Expedia, Agoda", state:"Simulated" },
  { icon:CreditCard, name:"Payments", detail:"Payment and refund events", state:"Simulated" },
  { icon:MessageCircle, name:"Guest messaging", detail:"WhatsApp / email delivery", state:"Demo delivery" },
  { icon:Webhook, name:"Webhooks & REST", detail:"Signed outbound automation events", state:"Demo delivery" },
];

export default function Integrations() {
  return <div className="page-stack">
    <div className="page-header"><span className="eyebrow">Connection layer</span><h1>Integrations</h1><p>EZStay is the automation layer between hotel systems. This public portfolio uses safe simulations—no visitor is asked for real credentials.</p></div>
    <div className="integration-grid">{integrations.map(({icon:Icon,...item}) => <article className="integration-card" key={item.name}><span className="integration-icon"><Icon size={21}/></span><div><h2>{item.name}</h2><p>{item.detail}</p></div><StatusBadge tone="neutral">{item.state}</StatusBadge></article>)}</div>
    <section className="technical-note"><b>Implementation boundary</b><p>Internal state changes are real inside the demo sandbox. External provider effects remain simulated until a provider is explicitly connected.</p></section>
  </div>;
}
