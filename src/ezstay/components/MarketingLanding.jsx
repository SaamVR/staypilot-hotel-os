import {
  ArrowRight,
  BadgeCheck,
  BellRing,
  Boxes,
  Braces,
  CheckCircle2,
  CircleGauge,
  Clock3,
  Database,
  Hotel,
  MessageSquareText,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";
import { EZSTAY_ENTRY_CTA, EZSTAY_ENTRY_DISCLOSURE } from "../domain/entry.js";

const proofs = [
  {
    number:"01",
    kicker:"Guest operations",
    title:"A request becomes assigned work.",
    text:"A guest asks for extra pillows. EZStay resolves the room and stay, applies the routing policy, creates the housekeeping task, and records the acknowledgement.",
    signal:"guest.request_received",
    result:"Task + delivery + trace",
    icon:MessageSquareText,
  },
  {
    number:"02",
    kicker:"Room turnover",
    title:"Checkout changes what the hotel can sell.",
    text:"Checkout closes the stay, moves the room to Vacant + Dirty, creates turnover work, then housekeeping completion recalculates whether the room is actually sellable.",
    signal:"guest.checked_out",
    result:"Dirty → turnover → Clean / ready",
    icon:Hotel,
  },
  {
    number:"03",
    kicker:"Human authority",
    title:"Automation knows when to stop.",
    text:"Low stock crosses a policy boundary. EZStay prepares the decision, waits for approval, then creates a purchase draft without pretending inventory has already arrived.",
    signal:"inventory.low_stock",
    result:"Approval → purchase draft",
    icon:ShieldCheck,
  },
  {
    number:"04",
    kicker:"Safe recovery",
    title:"Retry the delivery, not the business action.",
    text:"If an external delivery fails after the hotel action succeeds, the failure remains visible. Recovery retries only the delivery, preserving idempotency.",
    signal:"delivery.dead_letter",
    result:"Delivery-only retry",
    icon:RefreshCcw,
  },
];

const mechanics = [
  ["Event", "Business signal arrives", BellRing],
  ["Context", "Resolve hotel state", Database],
  ["Policy", "Auto / Policy / Approval", CircleGauge],
  ["Action", "Mutate operating state", Workflow],
  ["Evidence", "Trace every decision", Braces],
];

export default function MarketingLanding({ onExplore, entryBusy = false }) {
  return <div className="ez-presentation">
    <header className="presentation-nav">
      <a className="presentation-brand" href="#top" aria-label="EZStay home">
        <span>EZ</span>
        <div><b>EZStay</b><small>Hotel operations automation</small></div>
      </a>
      <nav aria-label="Presentation navigation">
        <a href="#automation">Automation</a>
        <a href="#proof">Workflows</a>
        <a href="#architecture">Controls</a>
      </nav>
      <button onClick={onExplore} disabled={entryBusy}>{entryBusy ? "Preparing demo…" : EZSTAY_ENTRY_CTA}<ArrowRight size={15}/></button>
    </header>

    <main>
      <section className="presentation-hero" id="top">
        <div className="presentation-hero-copy">
          <span className="presentation-kicker"><i/> Hotel operations automation · sandbox workspace</span>
          <h1>Hotel operations that <em>move themselves forward.</em></h1>
          <p className="presentation-lede">
            EZStay turns hotel events into policy-aware workflows: state changes, approvals,
            safe delivery, recovery, and an execution trail you can inspect instead of trust blindly.
          </p>
          <div className="presentation-actions">
            <button className="presentation-primary" onClick={onExplore} disabled={entryBusy}>
              {entryBusy ? "Preparing demo…" : EZSTAY_ENTRY_CTA}<ArrowRight size={17}/>
            </button>
            <a href="#automation">See how automation works</a>
          </div>
          <p className="presentation-disclosure">{EZSTAY_ENTRY_DISCLOSURE}</p>
        </div>

        <div className="automation-stage" aria-label="Example EZStay automation flow">
          <div className="stage-top">
            <span>RUN-2818</span>
            <b><i/> executed</b>
          </div>
          <div className="stage-event">
            <small>Inbound event</small>
            <strong>Guest request · Room 108</strong>
            <span>“Extra pillows requested”</span>
          </div>
          <div className="stage-line"><i/><i/><i/></div>
          <div className="stage-decision">
            <div><small>01 · Context</small><b>Active stay resolved</b></div>
            <div><small>02 · Policy</small><b>Auto · Housekeeping</b></div>
            <div><small>03 · Action</small><b>Task created</b></div>
          </div>
          <div className="stage-result">
            <CheckCircle2 size={17}/>
            <div><b>Room 108 · Extra pillows</b><span>Assigned to Housekeeping · due in 20 min</span></div>
            <span className="stage-trace">View trace →</span>
          </div>
        </div>
      </section>

      <section className="presentation-strip">
        <span>One hotel state</span><i/>
        <span>12 automation rules</span><i/>
        <span>4 autonomy modes</span><i/>
        <span>Idempotent execution</span><i/>
        <span>Auditable recovery</span>
      </section>

      <section className="automation-story" id="automation">
        <div className="presentation-section-head">
          <div><span className="presentation-kicker">Event-driven operations</span><h2>Every run follows a visible chain of cause and effect.</h2></div>
          <p>EZStay keeps the operating event, policy decision, resulting state change, and delivery evidence together so teams can see exactly what the system did.</p>
        </div>
        <div className="mechanics-grid">
          {mechanics.map(([label,text,Icon],index)=><article key={label}>
            <div className="mechanic-number">{String(index+1).padStart(2,"0")}</div>
            <span className="mechanic-icon"><Icon size={19}/></span>
            <b>{label}</b><p>{text}</p>
            {index < mechanics.length-1 && <ArrowRight className="mechanic-arrow" size={16}/>}
          </article>)}
        </div>
      </section>

      <section className="proof-section" id="proof">
        <div className="presentation-section-head">
          <div><span className="presentation-kicker">Core workflows</span><h2>Keep routine operations moving without losing control of exceptions.</h2></div>
          <button className="text-cta" onClick={onExplore}>Explore workflow controls <ArrowRight size={15}/></button>
        </div>
        <div className="proof-grid">
          {proofs.map(({number,kicker,title,text,signal,result,icon:Icon})=><article key={number}>
            <div className="proof-top"><span>{number}</span><Icon size={21}/></div>
            <small>{kicker}</small><h3>{title}</h3><p>{text}</p>
            <div className="proof-contract"><span>{signal}</span><b>{result}</b></div>
          </article>)}
        </div>
      </section>

      <section className="trust-section" id="architecture">
        <div className="trust-copy">
          <span className="presentation-kicker">Built to be inspectable</span>
          <h2>Automation earns trust by making boundaries obvious.</h2>
          <p>Routine work can run automatically. Spending and exception paths can require policy or approval. Every execution keeps the trigger, decision, changes, delivery state, audit timestamps, and linked records together.</p>
          <div className="trust-list">
            <span><BadgeCheck size={16}/> Event-ID duplicate suppression</span>
            <span><BadgeCheck size={16}/> Delivery separated from business mutation</span>
            <span><BadgeCheck size={16}/> Auto · Policy · Approval · Suggest</span>
            <span><BadgeCheck size={16}/> Deterministic reset + demo business clock</span>
          </div>
        </div>
        <div className="trust-stack">
          <article><span><ShieldCheck size={19}/> Policy boundary</span><b>Low stock needs approval</b><p>No purchase draft until a human authorizes it.</p></article>
          <article><span><RefreshCcw size={19}/> Recovery boundary</span><b>Retry only what failed</b><p>A dead-letter message does not replay a completed hotel action.</p></article>
          <article><span><Clock3 size={19}/> Time boundary</span><b>Advance demo time</b><p>Trigger overdue escalation without arbitrary fake waiting.</p></article>
        </div>
      </section>

      <section className="integration-boundary">
        <div><span className="presentation-kicker">Integration-ready</span><h2>Connect the systems you already use without giving up operational control.</h2></div>
        <div className="integration-rail">
          <span><Hotel size={17}/> PMS / booking</span>
          <span><MessageSquareText size={17}/> Messaging</span>
          <span><Boxes size={17}/> Suppliers</span>
          <span><Sparkles size={17}/> Future intelligence</span>
        </div>
        <p>This public sandbox uses simulated external booking, payment, messaging, and supplier adapters unless explicitly connected. Internal automation state changes remain real within the Northstar workspace.</p>
      </section>

      <section className="presentation-final">
        <span className="presentation-kicker">Explore the workspace</span>
        <h2>Run Northstar Grand.<br/>Inspect every automation behind it.</h2>
        <button className="presentation-primary" onClick={onExplore} disabled={entryBusy}>{entryBusy ? "Preparing demo…" : EZSTAY_ENTRY_CTA}<ArrowRight size={17}/></button>
      </section>
    </main>

    <footer className="presentation-footer">
      <div className="presentation-brand"><span>EZ</span><div><b>EZStay</b><small>Hotel operations automation</small></div></div>
      <p>Northstar sandbox · sample data · simulated external providers</p>
    </footer>
  </div>;
}
