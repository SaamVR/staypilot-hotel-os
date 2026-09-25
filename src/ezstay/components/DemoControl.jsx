import { Clock3, Info, RotateCcw, ShieldAlert, X } from "lucide-react";
import { describeDemoMode } from "../domain/demoControl.js";

function formatDemoTime(value) {
  if (!value) return "Unavailable";
  try {
    return new Intl.DateTimeFormat("en", {
      month:"short", day:"numeric", hour:"numeric", minute:"2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function DemoControl({
  open,
  session,
  snapshot,
  busy,
  onClose,
  onAdvanceClock,
  onReset,
  onShowFailure,
}) {
  if (!open) return null;
  const failed = snapshot?.deliveries?.find(item => ["Failed","Dead-letter"].includes(item.status));

  return <div className="drawer-backdrop demo-control-backdrop" onMouseDown={onClose}>
    <aside className="demo-control-drawer" onMouseDown={event => event.stopPropagation()} aria-label="Demo control">
      <header className="run-head">
        <div><span className="eyebrow">Demo control</span><h2>Northstar sandbox</h2></div>
        <button className="icon-button" onClick={onClose} aria-label="Close Demo Control"><X size={18}/></button>
      </header>

      <section className="demo-status-grid">
        <div><span>Demo time</span><b>{formatDemoTime(snapshot?.meta?.demoNow || session?.demoNow)}</b></div>
        <div><span>Runtime</span><b>{describeDemoMode(session?.mode)}</b></div>
        <div><span>Seed</span><b>{session?.seedVersion}</b></div>
        <div><span>Generation</span><b>#{session?.resetGeneration ?? 0}</b></div>
      </section>

      <section className="demo-control-actions">
        <button disabled={busy} onClick={onAdvanceClock}>
          <Clock3 size={18}/><div><b>Advance +30 min</b><span>Trigger time-based SLA evaluation immediately.</span></div>
        </button>
        <button disabled={busy || !failed} onClick={onShowFailure}>
          <ShieldAlert size={18}/><div><b>{failed ? "View sample failure" : "Sample failure recovered"}</b><span>{failed ? "Open the exhausted delivery in Activity." : "Reset the workspace to restore the seeded failed delivery."}</span></div>
        </button>
        <button disabled={busy} onClick={onReset} className="danger-control">
          <RotateCcw size={18}/><div><b>Reset workspace</b><span>Create a fresh Northstar generation from the canonical fixture.</span></div>
        </button>
      </section>

      <section className="technical-details-card">
        <div className="technical-details-head"><Info size={17}/><div><b>Technical details</b><span>What this public demo is proving</span></div></div>
        <dl>
          <div><dt>Backend contract</dt><dd>{session?.backendContractVersion}</dd></div>
          <div><dt>Idempotency</dt><dd>Command key + Event ID</dd></div>
          <div><dt>External providers</dt><dd>Simulated / demo delivery</dd></div>
          <div><dt>Persistence</dt><dd>{session?.mode === "backend-sandbox" ? "Isolated backend sandbox" : "This browser only"}</dd></div>
        </dl>
      </section>
    </aside>
  </div>;
}
