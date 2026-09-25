import { useEffect, useMemo, useState } from "react";
import AppShell from "./components/AppShell.jsx";
import RunInspector from "./components/RunInspector.jsx";
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
  const [active, setActive] = useState("command");
  const [session, setSession] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [selectedRun, setSelectedRun] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    let live = true;
    runtime.getSession().then(result => {
      if (!live) return;
      setSession(result.session);
      setSnapshot(result.snapshot);
    }).catch(error => {
      if (live) setNotice(error.message);
    });
    return () => { live = false; };
  }, [runtime]);

  async function execute(work, successMessage) {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const result = await work();
      if (result.snapshot) setSnapshot(result.snapshot);
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
      "Checkout turnover created."
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

  const resolveApproval = (approvalId, decision) => execute(
    () => runtime.resolveApproval({ idempotencyKey:commandKey("cmd_approval"), approvalId, decision }),
    decision === "Approved" ? "Approval executed and purchase draft created." : "Approval rejected."
  );

  const retryDelivery = deliveryId => execute(
    () => runtime.retryDelivery({ idempotencyKey:commandKey("cmd_retry"), deliveryId }),
    "Delivery retry completed."
  );

  if (!session || !snapshot) return <div className="app-loading"><span>EZ</span><p>Preparing Northstar demo workspace…</p></div>;

  let page = <CommandCenter snapshot={snapshot} onNavigate={setActive} onRunScenario={runScenario} onOpenRun={setSelectedRun} busy={busy}/>;
  if (active === "operations") page = <Operations snapshot={snapshot}/>;
  if (active === "automations") page = <Automations snapshot={snapshot}/>;
  if (active === "approvals") page = <Approvals snapshot={snapshot} onResolve={resolveApproval} busy={busy}/>;
  if (active === "activity") page = <ActivityPage snapshot={snapshot} onOpenRun={setSelectedRun} onRetry={retryDelivery} busy={busy}/>;
  if (active === "integrations") page = <Integrations/>;

  return <AppShell active={active} onNavigate={setActive} session={session} onDemoControl={() => setNotice("Demo controls are being prepared in the next V2 checkpoint.")}>
    {notice && <div className="toast-note" role="status">{notice}<button onClick={() => setNotice(null)}>×</button></div>}
    {page}
    <RunInspector run={selectedRun} onClose={() => setSelectedRun(null)} onLinkedRecord={record => {
      const map = { task:"operations", room:"operations", guest_request:"operations", reservation:"operations", approval:"approvals", purchase_request:"approvals", inventory:"operations", delivery:"activity" };
      setActive(map[record.type] || "activity");
      setSelectedRun(null);
    }}/>
  </AppShell>;
}
