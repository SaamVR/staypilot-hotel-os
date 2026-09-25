import { useEffect } from "react";
import { Clock3, Info, RotateCcw, ShieldAlert, X } from "lucide-react";
import { describeDemoMode } from "../domain/demoControl.js";
import { formatHotelMoment } from "../ui/format.js";
import ScenarioLauncher from "./ScenarioLauncher.jsx";

export default function DemoControl({
  open,
  session,
  snapshot,
  busy,
  onClose,
  onAdvanceClock,
  onReset,
  onShowFailure,
  onRunScenario,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = event => { if (event.key === "Escape") onClose(); };
    globalThis.addEventListener?.("keydown", onKeyDown);
    return () => globalThis.removeEventListener?.("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  const failed = snapshot?.deliveries?.find(item => ["Failed","Dead-letter"].includes(item.status));
  const timeZone = snapshot?.hotel?.timezone || "UTC";

  const runScenario = key => {
    onClose();
    onRunScenario?.(key);
  };

  const advanceClock = () => {
    onClose();
    onAdvanceClock?.();
  };

  return <div className="drawer-backdrop demo-control-backdrop" onMouseDown={onClose}>
    <aside className="demo-control-drawer" role="dialog" aria-modal="true" aria-labelledby="sandbox-environment-title" onMouseDown={event => event.stopPropagation()}>
      <header className="run-head">
        <div><span className="eyebrow">Environment</span><h2 id="sandbox-environment-title">Northstar sandbox</h2><small className="run-rule-label">Sample data · simulated external providers</small></div>
        <button autoFocus className="icon-button" onClick={onClose} aria-label="Close environment"><X size={18}/></button>
      </header>

      <section className="demo-status-grid">
        <div><span>Hotel time</span><b>{formatHotelMoment(snapshot?.meta?.demoNow || session?.demoNow, timeZone)}</b></div>
        <div><span>Runtime</span><b>{describeDemoMode(session?.mode)}</b></div>
        <div><span>Seed</span><b>{session?.seedVersion}</b></div>
        <div><span>Generation</span><b>#{session?.resetGeneration ?? 0}</b></div>
      </section>

      <ScenarioLauncher onRun={runScenario} busy={busy}/>

      <section className="demo-control-actions">
        <div className="sandbox-section-heading"><span className="eyebrow">Environment controls</span><h3>Time, recovery & reset</h3></div>
        <button disabled={busy} onClick={advanceClock}>
          <Clock3 size={18}/><div><b>Advance +30 min</b><span>Trigger time-based SLA evaluation immediately.</span></div>
        </button>
        <button disabled={busy || !failed} onClick={onShowFailure}>
          <ShieldAlert size={18}/><div><b>{failed ? "View seeded delivery exception" : "Seeded exception recovered"}</b><span>{failed ? "Open the exhausted delivery in Activity." : "Reset the workspace to restore the seeded exception."}</span></div>
        </button>
        <button disabled={busy} onClick={onReset} className="danger-control">
          <RotateCcw size={18}/><div><b>Reset workspace</b><span>Create a fresh Northstar generation from the canonical fixture.</span></div>
        </button>
      </section>

      <section className="technical-details-card">
        <div className="technical-details-head"><Info size={17}/><div><b>Environment details</b><span>Runtime and safety boundaries</span></div></div>
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
