import { useEffect, useMemo, useState } from "react";
import MarketingLanding from "./components/MarketingLanding.jsx";
import BackendEntryGate from "./components/BackendEntryGate.jsx";
import { resolveEzstayView, workspaceHash } from "./domain/entry.js";
import { resolveScenarioTargets } from "./domain/scenarioTargets.js";
import AppShell from "./components/AppShell.jsx";
import RunInspector from "./components/RunInspector.jsx";
import DemoControl from "./components/DemoControl.jsx";
import CommandCenter from "./pages/CommandCenter.jsx";
import Operations from "./pages/Operations.jsx";
import Automations from "./pages/Automations.jsx";
import Approvals from "./pages/Approvals.jsx";
import ActivityPage from "./pages/Activity.jsx";
import Integrations from "./pages/Integrations.jsx";
import { createRuntime } from "./runtime/index.js";
import {
  createBackendSandboxRuntime,
  fetchEzstayBackendHealth,
  fetchEzstayPublicConfig,
  selectEzstayRuntimeMode,
} from "./runtime/bootstrap.js";

function commandKey(prefix) {
  const token = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
  return `${prefix}_${token}`;
}

function setWorkspaceHash() {
  if (globalThis.location) globalThis.location.hash = workspaceHash();
}

export default function EZStayApp() {
  const localRuntime = useMemo(() => createRuntime({ mode:"local-preview" }), []);
  const [runtime, setRuntime] = useState(localRuntime);
  const [view, setView] = useState(() => resolveEzstayView(globalThis.location?.hash || ""));
  const [active, setActive] = useState("command");
  const [session, setSession] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [selectedRun, setSelectedRun] = useState(null);
  const [demoControlOpen, setDemoControlOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [entryGate, setEntryGate] = useState({
    phase:"idle",
    config:null,
    error:null,
    challengeKey:0,
  });

  const entryBusy = ["checking","verifying"].includes(entryGate.phase);

  useEffect(() => {
    const onHashChange = () => setView(resolveEzstayView(globalThis.location?.hash || ""));
    globalThis.addEventListener?.("hashchange", onHashChange);
    return () => globalThis.removeEventListener?.("hashchange", onHashChange);
  }, []);

  function applyWorkspace(result, selectedRuntime) {
    setRuntime(selectedRuntime);
    setSession(result.session);
    setSnapshot(result.snapshot);
    setSelectedRun(null);
    setEntryGate({ phase:"idle", config:null, error:null, challengeKey:0 });
    setWorkspaceHash();
    setView("workspace");
  }

  useEffect(() => {
    if (view !== "workspace" || (session && snapshot)) return undefined;
    let live = true;

    (async () => {
      const health = await fetchEzstayBackendHealth();
      const mode = selectEzstayRuntimeMode(health);
      if (!live) return;

      if (mode === "local-preview") {
        const result = await localRuntime.getSession();
        if (live) applyWorkspace(result, localRuntime);
        return;
      }

      const config = await fetchEzstayPublicConfig();
      if (!live) return;
      if (config?.mode !== "configured") throw new Error("backend_not_configured");

      try {
        const backend = await createBackendSandboxRuntime({ config });
        const result = await backend.runtime.startDemo({ idempotencyKey:commandKey("cmd_start_resume") });
        if (live) applyWorkspace(result, backend.runtime);
      } catch (error) {
        if (!live) return;
        if (error?.message === "captcha_token_required") {
          if (globalThis.location) globalThis.location.hash = "#top";
          setView("presentation");
          setEntryGate({
            phase:"challenge",
            config,
            error:null,
            challengeKey:Date.now(),
          });
          return;
        }
        throw error;
      }
    })().catch(error => {
      if (!live) return;
      if (globalThis.location) globalThis.location.hash = "#top";
      setView("presentation");
      setEntryGate(previous => ({
        ...previous,
        phase:"idle",
        error:error?.message || "Backend demo is unavailable.",
      }));
    });

    return () => { live = false; };
  }, [localRuntime, session, snapshot, view]);

  async function enterWorkspace() {
    if (entryBusy) return;
    setEntryGate({ phase:"checking", config:null, error:null, challengeKey:entryGate.challengeKey });
    try {
      const health = await fetchEzstayBackendHealth();
      const mode = selectEzstayRuntimeMode(health);
      if (mode === "local-preview") {
        const result = await localRuntime.getSession();
        applyWorkspace(result, localRuntime);
        return;
      }

      const config = await fetchEzstayPublicConfig();
      if (config?.mode !== "configured" || !config.turnstileSiteKey) {
        throw new Error("backend_not_configured");
      }

      setEntryGate({
        phase:"challenge",
        config,
        error:null,
        challengeKey:entryGate.challengeKey + 1,
      });
    } catch (error) {
      setEntryGate(previous => ({
        ...previous,
        phase:"idle",
        error:error?.message || "Demo entry could not be prepared.",
      }));
    }
  }

  async function completeBackendEntry(captchaToken) {
    if (entryGate.phase !== "challenge" || !entryGate.config) return;
    setEntryGate(previous => ({ ...previous, phase:"verifying", error:null }));
    try {
      const backend = await createBackendSandboxRuntime({
        config:entryGate.config,
        captchaToken,
      });
      const result = await backend.runtime.startDemo({ idempotencyKey:commandKey("cmd_start") });
      applyWorkspace(result, backend.runtime);
    } catch (error) {
      setEntryGate(previous => ({
        ...previous,
        phase:"challenge",
        error:error?.message || "Demo verification failed.",
        challengeKey:previous.challengeKey + 1,
      }));
    }
  }

  async function execute(work, successMessage) {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const result = await work();
      if (result.snapshot) {
        setSnapshot(result.snapshot);
        setSession(previous => previous ? {
          ...previous,
          demoNow:result.snapshot.meta?.demoNow ?? previous.demoNow,
          resetGeneration:result.snapshot.meta?.resetGeneration ?? previous.resetGeneration,
        } : previous);
      }
      if (result.run) setSelectedRun(result.run);
      if (successMessage) setNotice(successMessage);
    } catch (error) {
      setNotice(error.message || "Command failed");
    } finally {
      setBusy(false);
    }
  }

  const runScenario = key => {
    const targets = resolveScenarioTargets(snapshot);
    if (key === "guest") return execute(
      () => runtime.runGuestRequest({ idempotencyKey:commandKey("cmd_guest"), request:"Extra pillows requested", roomNumber:"108" }),
      "Guest request routed to Housekeeping."
    );
    if (key === "checkout") return execute(
      () => {
        if (!targets.checkoutReservationId) throw new Error("checkout_target_unavailable");
        return runtime.runCheckout({ idempotencyKey:commandKey("cmd_checkout"), reservationId:targets.checkoutReservationId });
      },
      "Checkout recorded. Complete the turnover in Operations to release the room."
    );
    if (key === "stock") return execute(
      () => {
        if (!targets.lowStockInventoryItemId) throw new Error("low_stock_target_unavailable");
        return runtime.runLowStock({ idempotencyKey:commandKey("cmd_stock"), inventoryItemId:targets.lowStockInventoryItemId });
      },
      "Low-stock policy stopped for approval."
    );
    if (key === "recovery") return execute(
      () => {
        if (!targets.failedDeliveryId) throw new Error("failed_delivery_unavailable");
        return runtime.retryDelivery({ idempotencyKey:commandKey("cmd_retry"), deliveryId:targets.failedDeliveryId });
      },
      "Delivery recovered without replaying the source action."
    );
  };

  const completeTurnover = taskId => execute(
    () => runtime.completeHousekeeping({ idempotencyKey:commandKey("cmd_housekeeping"), taskId }),
    "Housekeeping completed and room readiness recalculated."
  );

  const resolveApproval = (approvalId, decision) => execute(
    () => runtime.resolveApproval({ idempotencyKey:commandKey("cmd_approval"), approvalId, decision }),
    decision === "Approved" ? "Approval executed and purchase draft created." : "Approval rejected."
  );

  const retryDelivery = deliveryId => execute(
    () => runtime.retryDelivery({ idempotencyKey:commandKey("cmd_retry"), deliveryId }),
    "Delivery retry completed."
  );

  const advanceClock = () => execute(
    () => runtime.advanceClock({ idempotencyKey:commandKey("cmd_clock"), minutes:30 }),
    "Hotel time advanced by 30 minutes. SLA rules were evaluated."
  );

  const resetWorkspace = async () => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const result = await runtime.resetDemo({ idempotencyKey:commandKey("cmd_reset") });
      setSession(result.session);
      setSnapshot(result.snapshot);
      setSelectedRun(null);
      setActive("command");
      setDemoControlOpen(false);
      setNotice("Northstar workspace reset to the canonical sandbox state.");
    } catch (error) {
      setNotice(error.message || "Workspace reset failed");
    } finally {
      setBusy(false);
    }
  };

  const showSampleFailure = () => {
    const failed = snapshot.deliveries.find(item => ["Failed","Dead-letter"].includes(item.status));
    if (!failed) {
      setNotice("The seeded delivery exception has already been recovered. Reset the workspace to restore it.");
      return;
    }
    setActive("activity");
    setDemoControlOpen(false);
    setNotice(`Seeded delivery exception ${failed.id} is ready for delivery-only recovery.`);
  };

  if (view === "presentation") {
    return <>
      <MarketingLanding onExplore={enterWorkspace} entryBusy={entryBusy}/>
      <BackendEntryGate
        key={entryGate.challengeKey}
        open={["challenge","verifying"].includes(entryGate.phase)}
        siteKey={entryGate.config?.turnstileSiteKey}
        busy={entryGate.phase === "verifying"}
        error={entryGate.error}
        onToken={completeBackendEntry}
        onError={message => setEntryGate(previous => ({ ...previous, error:message }))}
        onCancel={() => setEntryGate(previous => ({ ...previous, phase:"idle", config:null, error:null }))}
      />
      {entryGate.phase === "idle" && entryGate.error && <div className="presentation-entry-error" role="alert">{entryGate.error}</div>}
    </>;
  }

  if (!session || !snapshot) return <div className="app-loading"><span>EZ</span><p>Preparing Northstar workspace…</p></div>;

  let page = <CommandCenter snapshot={snapshot} onNavigate={setActive} onOpenRun={setSelectedRun}/>;
  if (active === "operations") page = <Operations snapshot={snapshot} onCompleteHousekeeping={completeTurnover} busy={busy}/>;
  if (active === "automations") page = <Automations snapshot={snapshot}/>;
  if (active === "approvals") page = <Approvals snapshot={snapshot} onResolve={resolveApproval} busy={busy}/>;
  if (active === "activity") page = <ActivityPage snapshot={snapshot} onOpenRun={setSelectedRun} onRetry={retryDelivery} busy={busy}/>;
  if (active === "integrations") page = <Integrations/>;

  return <AppShell active={active} onNavigate={setActive} hotel={snapshot.hotel} roomCount={snapshot.rooms.length} demoNow={snapshot.meta.demoNow} onDemoControl={() => setDemoControlOpen(true)}>
    {notice && <div className="toast-note" role="status">{notice}<button onClick={() => setNotice(null)}>×</button></div>}
    {page}
    <DemoControl
      open={demoControlOpen}
      session={session}
      snapshot={snapshot}
      busy={busy}
      onClose={() => setDemoControlOpen(false)}
      onAdvanceClock={advanceClock}
      onReset={resetWorkspace}
      onShowFailure={showSampleFailure}
      onRunScenario={runScenario}
    />
    <RunInspector run={selectedRun} timeZone={snapshot.hotel.timezone} onClose={() => setSelectedRun(null)} onLinkedRecord={record => {
      const map = { task:"operations", room:"operations", guest_request:"operations", reservation:"operations", approval:"approvals", purchase_request:"approvals", inventory:"operations", delivery:"activity" };
      setActive(map[record.type] || "activity");
      setSelectedRun(null);
    }}/>
  </AppShell>;
}
