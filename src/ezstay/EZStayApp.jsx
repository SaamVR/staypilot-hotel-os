import { useEffect, useMemo, useState } from "react";
import MarketingLanding from "./components/MarketingLanding.jsx";
import { resolveEzstayView, workspaceHash } from "./domain/entry.js";
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

function commandKey(prefix) {
  const token = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
  return `${prefix}_${token}`;
}

export default function EZStayApp() {
  const runtime = useMemo(() => createRuntime({ mode:"local-preview" }), []);
  const [view, setView] = useState(() => resolveEzstayView(globalThis.location?.hash || ""));
  const [active, setActive] = useState("command");
  const [session, setSession] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [selectedRun, setSelectedRun] = useState(null);
  const [demoControlOpen, setDemoControlOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    const onHashChange = () => setView(resolveEzstayView(globalThis.location?.hash || ""));
    globalThis.addEventListener?.("hashchange", onHashChange);
    return () => globalThis.removeEventListener?.("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    if (view !== "workspace") return undefined;
    let live = true;
    runtime.getSession().then(result => {
      if (!live) return;
      setSession(result.session);
      setSnapshot(result.snapshot);
    }).catch(error => {
      if (live) setNotice(error.message);
    });
    return () => { live = false; };
  }, [runtime, view]);

  const enterWorkspace = () => {
    if (globalThis.location) globalThis.location.hash = workspaceHash();
    setView("workspace");
  };

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
      setNotice(error.message || "Demo command failed");
    } finally {
      setBusy(false);
    }
  }

  const runScenario = key => {
    if (key === "guest") return execute(
      () => runtime.runGuestRequest({ idempotencyKey:commandKey("cmd_guest"), request:"Extra pillows requested", roomNumber:"108" }),
      "Guest request routed to Housekeeping."
    );
    if (key === "checkout") return execute(
      () => runtime.runCheckout({ idempotencyKey:commandKey("cmd_checkout"), reservationId:"res_1047" }),
      "Checkout recorded. Complete the turnover in Operations to release the room."
    );
    if (key === "stock") return execute(
      () => runtime.runLowStock({ idempotencyKey:commandKey("cmd_stock"), inventoryItemId:"inv_queen_sheets" }),
      "Low-stock policy stopped for approval."
    );
    if (key === "recovery") return execute(
      () => runtime.retryDelivery({ idempotencyKey:commandKey("cmd_retry"), deliveryId:"DLV-400" }),
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
    "Demo time advanced by 30 minutes. SLA rules were evaluated."
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
      setNotice("Workspace reset to a fresh Northstar demo generation.");
    } catch (error) {
      setNotice(error.message || "Workspace reset failed");
    } finally {
      setBusy(false);
    }
  };

  const showSampleFailure = () => {
    const failed = snapshot.deliveries.find(item => ["Failed","Dead-letter"].includes(item.status));
    if (!failed) {
      setNotice("The seeded failure has already been recovered. Reset the workspace to restore it.");
      return;
    }
    setActive("activity");
    setDemoControlOpen(false);
    setNotice(`Sample failure ${failed.id} is ready for delivery-only recovery.`);
  };

  if (view === "presentation") return <MarketingLanding onExplore={enterWorkspace}/>;

  if (!session || !snapshot) return <div className="app-loading"><span>EZ</span><p>Preparing Northstar demo workspace…</p></div>;

  let page = <CommandCenter snapshot={snapshot} onNavigate={setActive} onRunScenario={runScenario} onOpenRun={setSelectedRun} busy={busy}/>;
  if (active === "operations") page = <Operations snapshot={snapshot} onCompleteHousekeeping={completeTurnover} busy={busy}/>;
  if (active === "automations") page = <Automations snapshot={snapshot}/>;
  if (active === "approvals") page = <Approvals snapshot={snapshot} onResolve={resolveApproval} busy={busy}/>;
  if (active === "activity") page = <ActivityPage snapshot={snapshot} onOpenRun={setSelectedRun} onRetry={retryDelivery} busy={busy}/>;
  if (active === "integrations") page = <Integrations/>;

  return <AppShell active={active} onNavigate={setActive} session={session} onDemoControl={() => setDemoControlOpen(true)}>
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
    />
    <RunInspector run={selectedRun} onClose={() => setSelectedRun(null)} onLinkedRecord={record => {
      const map = { task:"operations", room:"operations", guest_request:"operations", reservation:"operations", approval:"approvals", purchase_request:"approvals", inventory:"operations", delivery:"activity" };
      setActive(map[record.type] || "activity");
      setSelectedRun(null);
    }}/>
  </AppShell>;
}
