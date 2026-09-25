import test from "node:test";
import assert from "node:assert/strict";
import { createNorthstarSeed } from "../src/ezstay/domain/seed.js";
import { deriveHotelMetrics } from "../src/ezstay/domain/derive.js";

test("Northstar V2 fixture is relationally consistent", () => {
  const state = createNorthstarSeed();
  assert.equal(state.meta.seedVersion, "northstar-v2");
  assert.ok(state.rooms.length >= 12);
  assert.ok(state.reservations.every(reservation =>
    !reservation.roomId || state.rooms.some(room =>
      room.id === reservation.roomId && room.hotelId === reservation.hotelId
    )
  ));
  assert.ok(state.tasks.every(task =>
    !task.roomId || state.rooms.some(room =>
      room.id === task.roomId && room.hotelId === task.hotelId
    )
  ));
  assert.ok(state.inventory.every(item => item.stock >= 0 && item.par >= 0));
});

test("Olivia Martin room assignment and room type agree", () => {
  const state = createNorthstarSeed();
  const reservation = state.reservations.find(row => row.guestName === "Olivia Martin");
  assert.ok(reservation);
  const room = state.rooms.find(row => row.id === reservation.roomId);
  assert.ok(room);
  assert.equal(reservation.roomType, room.type);
});

test("dashboard metrics are derived from source records", () => {
  const state = createNorthstarSeed();
  const metrics = deriveHotelMetrics(state);
  assert.equal(metrics.totalRooms, state.rooms.length);
  assert.equal(metrics.openTasks, state.tasks.filter(task => task.status !== "Done").length);
  assert.equal(metrics.pendingApprovals, state.approvals.filter(approval => approval.status === "Pending").length);
  assert.equal(metrics.failedDeliveries, state.deliveries.filter(delivery => delivery.status === "Failed" || delivery.status === "Dead-letter").length);
});
