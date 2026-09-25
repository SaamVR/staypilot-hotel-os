import test from "node:test";
import assert from "node:assert/strict";
import { createNorthstarSeed } from "../src/ezstay/domain/seed.js";
import {
  runGuestRequest,
  runCheckout,
  completeHousekeeping,
  runLowStock,
  resolveApproval,
  retryDelivery,
  advanceDemoClock,
} from "../src/ezstay/domain/automation.js";

test("guest request is idempotent and creates one task", () => {
  const initial = createNorthstarSeed();
  const command = { idempotencyKey:"cmd_guest_001", request:"Extra pillows", roomNumber:"108", resetGeneration:0 };
  const first = runGuestRequest(initial, command);
  const second = runGuestRequest(first.state, command);
  assert.equal(first.run.result, "Success");
  assert.equal(second.duplicate, true);
  assert.equal(second.run.id, first.run.id);
  assert.equal(second.state.tasks.length, first.state.tasks.length);
  assert.equal(second.state.guestRequests.length, first.state.guestRequests.length);
});

test("guest request for unknown room fails without adding task", () => {
  const initial = createNorthstarSeed();
  const result = runGuestRequest(initial, { idempotencyKey:"cmd_guest_missing", request:"Water", roomNumber:"999", resetGeneration:0 });
  assert.equal(result.run.result, "Failed");
  assert.equal(result.state.tasks.length, initial.tasks.length);
  assert.equal(result.state.guestRequests.length, initial.guestRequests.length);
});

test("checkout changes room state and creates one turnover task", () => {
  const initial = createNorthstarSeed();
  const result = runCheckout(initial, { idempotencyKey:"cmd_checkout_1047", reservationId:"res_1047", resetGeneration:0 });
  const reservation = result.state.reservations.find(row => row.id === "res_1047");
  const room = result.state.rooms.find(row => row.id === "room_108");
  assert.equal(reservation.status, "Checked out");
  assert.equal(room.occupancy, "Vacant");
  assert.equal(room.housekeeping, "Dirty");
  assert.equal(result.state.tasks.filter(task => task.sourceEventId === result.run.eventId).length, 1);
});

test("housekeeping completion closes turnover work and releases a clear room", () => {
  const initial = createNorthstarSeed();
  const checkout = runCheckout(initial, { idempotencyKey:"cmd_checkout_ready", reservationId:"res_1047", resetGeneration:0 });
  const turnover = checkout.state.tasks.find(task => task.sourceEventId === checkout.run.eventId);
  const completed = completeHousekeeping(checkout.state, {
    idempotencyKey:"cmd_housekeeping_ready",
    taskId:turnover.id,
    resetGeneration:0,
  });
  const room = completed.state.rooms.find(row => row.id === "room_108");
  const task = completed.state.tasks.find(row => row.id === turnover.id);
  assert.equal(task.status, "Done");
  assert.equal(room.housekeeping, "Clean");
  assert.equal(room.maintenance, "Clear");
  assert.match(completed.run.summary, /sellable/i);
  assert.equal(completed.run.ruleKey, "room-ready-release");
});

test("housekeeping completion keeps a maintenance-blocked room unavailable", () => {
  const initial = createNorthstarSeed();
  const checkout = runCheckout(initial, { idempotencyKey:"cmd_checkout_blocked", reservationId:"res_1047", resetGeneration:0 });
  const turnover = checkout.state.tasks.find(task => task.sourceEventId === checkout.run.eventId);
  const room = checkout.state.rooms.find(row => row.id === "room_108");
  room.maintenance = "Out of order";
  const completed = completeHousekeeping(checkout.state, {
    idempotencyKey:"cmd_housekeeping_blocked",
    taskId:turnover.id,
    resetGeneration:0,
  });
  const resultRoom = completed.state.rooms.find(row => row.id === "room_108");
  assert.equal(resultRoom.housekeeping, "Clean");
  assert.equal(resultRoom.maintenance, "Out of order");
  assert.match(completed.run.summary, /maintenance/i);
});

test("low stock requires approval and approval creates one purchase draft without receiving stock", () => {
  const initial = createNorthstarSeed();
  const low = runLowStock(initial, { idempotencyKey:"cmd_stock_001", inventoryItemId:"inv_queen_sheets", resetGeneration:0 });
  assert.equal(low.run.result, "Approval");
  const approvalId = low.run.linkedRecords.find(row => row.type === "approval").id;
  const stockBefore = low.state.inventory.find(row => row.id === "inv_queen_sheets").stock;
  const approved = resolveApproval(low.state, { idempotencyKey:"cmd_approve_001", approvalId, decision:"Approved", resetGeneration:0 });
  assert.equal(approved.run.result, "Success");
  assert.equal(approved.state.purchaseRequests.length, 1);
  assert.equal(approved.state.inventory.find(row => row.id === "inv_queen_sheets").stock, stockBefore);
  const replay = resolveApproval(approved.state, { idempotencyKey:"cmd_approve_001", approvalId, decision:"Approved", resetGeneration:0 });
  assert.equal(replay.duplicate, true);
  assert.equal(replay.state.purchaseRequests.length, 1);
});

test("maintenance approval authorizes linked maintenance work without creating a purchase draft", () => {
  const initial = createNorthstarSeed();
  const result = resolveApproval(initial, {
    idempotencyKey:"cmd_approve_maintenance",
    approvalId:"apr_104",
    decision:"Approved",
    resetGeneration:0,
  });
  const task = result.state.tasks.find(row => row.id === "task_207_hvac");
  assert.equal(result.state.purchaseRequests.length, 0);
  assert.equal(task.status, "In progress");
  assert.equal(task.metadata?.authorization, "Approved");
  assert.match(result.run.summary, /maintenance|authorized/i);
  assert.ok(result.run.linkedRecords.some(row => row.type === "task" && row.id === task.id));
});

test("delivery retry does not replay business mutations", () => {
  const initial = createNorthstarSeed();
  const before = {
    tasks:initial.tasks.length,
    reservations:JSON.stringify(initial.reservations),
    requests:initial.guestRequests.length,
  };
  const result = retryDelivery(initial, { idempotencyKey:"cmd_retry_400", deliveryId:"DLV-400", resetGeneration:0 });
  assert.equal(result.state.deliveries.find(row => row.id === "DLV-400").status, "Delivered");
  assert.equal(result.state.tasks.length, before.tasks);
  assert.equal(JSON.stringify(result.state.reservations), before.reservations);
  assert.equal(result.state.guestRequests.length, before.requests);
});

test("advancing demo clock escalates an overdue task once", () => {
  const initial = createNorthstarSeed();
  const first = advanceDemoClock(initial, { idempotencyKey:"cmd_clock_001", minutes:30, resetGeneration:0 });
  const escalationsAfterFirst = first.state.automationRuns.filter(run => run.ruleKey === "overdue-task-escalation").length;
  const second = advanceDemoClock(first.state, { idempotencyKey:"cmd_clock_002", minutes:30, resetGeneration:0 });
  const escalationsAfterSecond = second.state.automationRuns.filter(run => run.ruleKey === "overdue-task-escalation").length;
  assert.ok(escalationsAfterFirst >= 1);
  assert.equal(escalationsAfterSecond, escalationsAfterFirst);
  const escalationRun = first.state.automationRuns.find(run => run.ruleKey === "overdue-task-escalation");
  const deliveryRef = escalationRun?.delivery?.[0];
  const outboxDelivery = first.state.deliveries.find(row => row.id === deliveryRef?.id);
  assert.ok(outboxDelivery, "escalation delivery must be present in the shared outbox");
  assert.equal(outboxDelivery.runId, escalationRun.id);
  assert.equal(outboxDelivery.status, "Delivered");
  assert.match(outboxDelivery.channel, /operations alert/i);
});

test("stale demo generation is rejected", () => {
  const initial = createNorthstarSeed();
  initial.meta.resetGeneration = 2;
  assert.throws(
    () => runGuestRequest(initial, { idempotencyKey:"cmd_stale", request:"Water", roomNumber:"108", resetGeneration:1 }),
    /stale_demo_generation/
  );
});

test("flagship local-preview workflows append operator-visible audit events", () => {
  const initial = createNorthstarSeed();
  const checkout = runCheckout(initial, { idempotencyKey:"cmd_audit_checkout", reservationId:"res_1047", resetGeneration:0 });
  assert.ok(checkout.state.auditEvents.some(row => row.action === "Checkout turnover completed"));

  const low = runLowStock(checkout.state, { idempotencyKey:"cmd_audit_stock", inventoryItemId:"inv_queen_sheets", resetGeneration:0 });
  assert.ok(low.state.auditEvents.some(row => row.action === "Low-stock approval requested"));

  const approvalId = low.run.linkedRecords.find(row => row.type === "approval").id;
  const approval = resolveApproval(low.state, { idempotencyKey:"cmd_audit_approval", approvalId, decision:"Approved", resetGeneration:0 });
  assert.ok(approval.state.auditEvents.some(row => row.action === "Approval decision executed"));

  const recovery = retryDelivery(approval.state, { idempotencyKey:"cmd_audit_retry", deliveryId:"DLV-400", resetGeneration:0 });
  assert.ok(recovery.state.auditEvents.some(row => row.action === "Delivery recovered"));

  const clock = advanceDemoClock(recovery.state, { idempotencyKey:"cmd_audit_clock", minutes:30, resetGeneration:0 });
  assert.ok(clock.state.auditEvents.some(row => row.action === "Demo clock advanced"));
  assert.ok(clock.state.auditEvents.some(row => row.action === "Overdue task escalated"));
});
