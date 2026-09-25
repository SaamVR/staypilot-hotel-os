import { assertDemoGeneration, stableToken, withIdempotency } from "./idempotency.js";

function effectiveNow(state) {
  return state?.meta?.demoNow || new Date().toISOString();
}

function eventId(key) {
  return `evt_${stableToken(key)}`;
}

function runId(key) {
  return `RUN-${stableToken(key).toUpperCase()}`;
}

function makeAudit(state, message) {
  const at = effectiveNow(state);
  return { at, effectiveAt:at, message };
}

function appendRun(state, run) {
  state.automationRuns = [...(state.automationRuns || []), run];
  return run;
}

function failedRun(state, key, ruleKey, summary, input, reason) {
  return appendRun(state, {
    id:runId(key),
    eventId:eventId(key),
    ruleKey,
    result:"Failed",
    summary,
    input,
    decision:{ autonomy:"Auto", reason },
    changes:[],
    delivery:[],
    audit:[makeAudit(state, reason)],
    linkedRecords:[],
  });
}

function activeReservationForRoom(state, roomId) {
  return (state.reservations || []).find(row =>
    row.roomId === roomId && !["Checked out","Cancelled"].includes(row.status)
  ) || null;
}

export function runGuestRequest(state, command) {
  assertDemoGeneration(state, command);
  return withIdempotency(state, command.idempotencyKey, (next, key) => {
    const room = next.rooms.find(row => row.number === String(command.roomNumber));
    if (!room) {
      const run = failedRun(next, key, "guest-request-router", "Guest request could not be routed.", { request:command.request, roomNumber:command.roomNumber }, "Room was not found.");
      return { state:next, run };
    }

    const reservation = activeReservationForRoom(next, room.id);
    if (!reservation) {
      const run = failedRun(next, key, "guest-request-router", "Guest request could not be routed.", { request:command.request, roomNumber:command.roomNumber }, "No active reservation is attached to the room.");
      return { state:next, run };
    }

    const token = stableToken(key);
    const event = eventId(key);
    const request = {
      id:`req_${token}`,
      hotelId:next.hotel.id,
      reservationId:reservation.id,
      roomId:room.id,
      request:String(command.request || "Guest service request").trim() || "Guest service request",
      category:"Housekeeping",
      urgency:"Normal",
      status:"Open",
      createdAt:effectiveNow(next),
      sourceEventId:event,
    };
    const task = {
      id:`task_${token}`,
      hotelId:next.hotel.id,
      reservationId:reservation.id,
      roomId:room.id,
      place:`Room ${room.number}`,
      title:request.request,
      team:"Housekeeping",
      dueAt:new Date(new Date(effectiveNow(next)).getTime() + 20 * 60_000).toISOString(),
      status:"New",
      automated:true,
      sourceEventId:event,
    };
    const delivery = {
      id:`DLV-${token}`,
      hotelId:next.hotel.id,
      runId:runId(key),
      channel:"Demo guest acknowledgement",
      status:"Delivered",
      attempts:1,
      lastError:null,
      createdAt:effectiveNow(next),
    };

    next.guestRequests.push(request);
    next.tasks.push(task);
    next.deliveries.push(delivery);

    const run = appendRun(next, {
      id:runId(key),
      eventId:event,
      ruleKey:"guest-request-router",
      result:"Success",
      summary:`${request.request} routed to Housekeeping.`,
      input:{ request:request.request, roomNumber:room.number, reservationId:reservation.id },
      decision:{ autonomy:"Auto", reason:"Routine in-stay service requests are within the automatic housekeeping policy." },
      changes:[
        { entityType:"guest_request", entityId:request.id, action:"created" },
        { entityType:"task", entityId:task.id, action:"created" },
      ],
      delivery:[{ id:delivery.id, status:delivery.status }],
      audit:[
        makeAudit(next, "Guest request normalized."),
        makeAudit(next, "Housekeeping task created."),
        makeAudit(next, "Demo acknowledgement delivered."),
      ],
      linkedRecords:[
        { type:"guest_request", id:request.id, label:request.request },
        { type:"task", id:task.id, label:`${task.place} · ${task.title}` },
        { type:"room", id:room.id, label:`Room ${room.number}` },
      ],
    });

    next.auditEvents.push({
      id:`audit_${token}`,
      hotelId:next.hotel.id,
      actorKind:"automation",
      category:"Automation",
      action:"Guest request routed",
      createdAt:effectiveNow(next),
      sourceEventId:event,
    });
    return { state:next, run };
  });
}

export function runCheckout(state, command) {
  assertDemoGeneration(state, command);
  return withIdempotency(state, command.idempotencyKey, (next, key) => {
    const reservation = next.reservations.find(row => row.id === command.reservationId);
    if (!reservation || reservation.status !== "Checked in") {
      const run = failedRun(next, key, "checkout-turnover", "Checkout could not be processed.", { reservationId:command.reservationId }, "Checked-in reservation was not found.");
      return { state:next, run };
    }
    const room = next.rooms.find(row => row.id === reservation.roomId);
    if (!room) {
      const run = failedRun(next, key, "checkout-turnover", "Checkout could not be processed.", { reservationId:command.reservationId }, "Assigned room was not found.");
      return { state:next, run };
    }

    const token = stableToken(key);
    const event = eventId(key);
    reservation.status = "Checked out";
    room.occupancy = "Vacant";
    room.housekeeping = "Dirty";

    const task = {
      id:`task_turnover_${token}`,
      hotelId:next.hotel.id,
      reservationId:reservation.id,
      roomId:room.id,
      place:`Room ${room.number}`,
      title:"Full turnover",
      team:"Housekeeping",
      dueAt:new Date(new Date(effectiveNow(next)).getTime() + 45 * 60_000).toISOString(),
      status:"New",
      automated:true,
      sourceEventId:event,
    };
    next.tasks.push(task);

    const run = appendRun(next, {
      id:runId(key),
      eventId:event,
      ruleKey:"checkout-turnover",
      result:"Success",
      summary:`Room ${room.number} moved to Vacant + Dirty and turnover work was created.`,
      input:{ reservationId:reservation.id, roomNumber:room.number },
      decision:{ autonomy:"Auto", reason:"Checkout turnover is a routine operational workflow." },
      changes:[
        { entityType:"reservation", entityId:reservation.id, action:"checked_out" },
        { entityType:"room", entityId:room.id, action:"vacant_dirty" },
        { entityType:"task", entityId:task.id, action:"created" },
      ],
      delivery:[],
      audit:[
        makeAudit(next, "Checkout normalized."),
        makeAudit(next, "Room marked Vacant + Dirty."),
        makeAudit(next, "Turnover task created."),
      ],
      linkedRecords:[
        { type:"reservation", id:reservation.id, label:reservation.externalRef },
        { type:"room", id:room.id, label:`Room ${room.number}` },
        { type:"task", id:task.id, label:`Room ${room.number} · Full turnover` },
      ],
    });
    return { state:next, run };
  });
}

export function runLowStock(state, command) {
  assertDemoGeneration(state, command);
  return withIdempotency(state, command.idempotencyKey, (next, key) => {
    const item = next.inventory.find(row => row.id === command.inventoryItemId);
    if (!item || item.stock >= item.par) {
      const run = failedRun(next, key, "low-stock-replenishment", "Replenishment was not requested.", { inventoryItemId:command.inventoryItemId }, item ? "Item is not below par." : "Inventory item was not found.");
      return { state:next, run };
    }

    const quantity = Math.max(1, Math.ceil(item.par * 1.5 - item.stock));
    let approval = next.approvals.find(row => row.inventoryItemId === item.id && row.status === "Pending");
    let action = "reused";
    if (!approval) {
      action = "created";
      approval = {
        id:`apr_${stableToken(key)}`,
        hotelId:next.hotel.id,
        type:"Purchase order",
        title:`${item.item} replenishment`,
        detail:`${quantity} ${item.unit} · ${item.supplier}`,
        amount:Number((quantity * item.unitCost).toFixed(2)),
        inventoryItemId:item.id,
        quantity,
        status:"Pending",
        requestedBy:"EZStay automation",
        createdAt:effectiveNow(next),
        sourceEventId:eventId(key),
      };
      next.approvals.push(approval);
    }

    const run = appendRun(next, {
      id:runId(key),
      eventId:eventId(key),
      ruleKey:"low-stock-replenishment",
      result:"Approval",
      summary:`${item.item} is below par; purchase approval is required.`,
      input:{ inventoryItemId:item.id, stock:item.stock, par:item.par },
      decision:{ autonomy:"Policy", reason:"The replenishment exceeds automatic purchase authority." },
      changes:[{ entityType:"approval", entityId:approval.id, action }],
      delivery:[],
      audit:[
        makeAudit(next, "Low-stock threshold evaluated."),
        makeAudit(next, `Approval ${action} for replenishment.`),
      ],
      linkedRecords:[
        { type:"inventory", id:item.id, label:item.item },
        { type:"approval", id:approval.id, label:approval.title },
      ],
    });
    return { state:next, run };
  });
}

export function resolveApproval(state, command) {
  assertDemoGeneration(state, command);
  return withIdempotency(state, command.idempotencyKey, (next, key) => {
    const approval = next.approvals.find(row => row.id === command.approvalId);
    if (!approval || approval.status !== "Pending") {
      const run = failedRun(next, key, "approval-executor", "Approval could not be resolved.", { approvalId:command.approvalId, decision:command.decision }, "Pending approval was not found.");
      return { state:next, run };
    }

    const approved = command.decision === "Approved";
    approval.status = approved ? "Approved" : "Rejected";
    approval.resolvedAt = effectiveNow(next);

    const changes = [{ entityType:"approval", entityId:approval.id, action:approval.status.toLowerCase() }];
    const links = [{ type:"approval", id:approval.id, label:approval.title }];

    if (approved && approval.inventoryItemId) {
      const purchase = {
        id:`po_${stableToken(key)}`,
        hotelId:next.hotel.id,
        approvalId:approval.id,
        inventoryItemId:approval.inventoryItemId,
        quantity:approval.quantity,
        amount:approval.amount,
        supplier:next.inventory.find(row => row.id === approval.inventoryItemId)?.supplier || "Supplier",
        status:"Draft",
        createdAt:effectiveNow(next),
      };
      next.purchaseRequests.push(purchase);
      changes.push({ entityType:"purchase_request", entityId:purchase.id, action:"created" });
      links.push({ type:"purchase_request", id:purchase.id, label:`Purchase draft · ${purchase.quantity} units` });
    }

    const run = appendRun(next, {
      id:runId(key),
      eventId:eventId(key),
      ruleKey:"approval-executor",
      result:"Success",
      summary:approved ? "Approval accepted and the authorized draft action was created." : "Approval rejected; no purchase draft was created.",
      input:{ approvalId:approval.id, decision:command.decision },
      decision:{ autonomy:"Auto", reason:"The human decision is authoritative for the pending approval." },
      changes,
      delivery:[],
      audit:[makeAudit(next, `Approval marked ${approval.status}.`)],
      linkedRecords:links,
    });
    return { state:next, run };
  });
}

export function retryDelivery(state, command) {
  assertDemoGeneration(state, command);
  return withIdempotency(state, command.idempotencyKey, (next, key) => {
    const delivery = next.deliveries.find(row => row.id === command.deliveryId);
    if (!delivery || !["Failed","Dead-letter"].includes(delivery.status)) {
      const run = failedRun(next, key, "delivery-recovery", "Delivery could not be retried.", { deliveryId:command.deliveryId }, "Retryable failed delivery was not found.");
      return { state:next, run };
    }

    delivery.status = "Delivered";
    delivery.attempts = Number(delivery.attempts || 0) + 1;
    delivery.lastError = null;
    delivery.deliveredAt = effectiveNow(next);

    const run = appendRun(next, {
      id:runId(key),
      eventId:eventId(key),
      ruleKey:"delivery-recovery",
      result:"Success",
      summary:"Delivery recovered without replaying the original hotel action.",
      input:{ deliveryId:delivery.id },
      decision:{ autonomy:"Auto", reason:"Only the exhausted delivery is eligible for redrive." },
      changes:[{ entityType:"delivery", entityId:delivery.id, action:"delivered" }],
      delivery:[{ id:delivery.id, status:"Delivered" }],
      audit:[makeAudit(next, "Delivery-only retry succeeded; source business mutation was not replayed.")],
      linkedRecords:[{ type:"delivery", id:delivery.id, label:delivery.channel }],
    });
    return { state:next, run };
  });
}

export function advanceDemoClock(state, command) {
  assertDemoGeneration(state, command);
  return withIdempotency(state, command.idempotencyKey, (next, key) => {
    const minutes = Math.max(1, Math.min(240, Number(command.minutes) || 30));
    const oldNow = new Date(next.meta.demoNow);
    const newNow = new Date(oldNow.getTime() + minutes * 60_000);
    next.meta.demoNow = newNow.toISOString();

    const newlyEscalated = [];
    for (const task of next.tasks) {
      if (
        task.status !== "Done" &&
        task.dueAt &&
        new Date(task.dueAt).getTime() <= newNow.getTime() &&
        !task.escalatedAt
      ) {
        task.escalatedAt = newNow.toISOString();
        newlyEscalated.push(task);
        appendRun(next, {
          id:`RUN-ESC-${task.id}`,
          eventId:`evt_overdue_${task.id}`,
          ruleKey:"overdue-task-escalation",
          result:"Success",
          summary:`${task.place} · ${task.title} escalated after SLA expiry.`,
          input:{ taskId:task.id, dueAt:task.dueAt },
          decision:{ autonomy:"Auto", reason:"Task crossed its configured SLA deadline." },
          changes:[{ entityType:"task", entityId:task.id, action:"escalated" }],
          delivery:[{ id:`DLV-ESC-${task.id}`, status:"Delivered" }],
          audit:[makeAudit(next, "Overdue task escalated once.")],
          linkedRecords:[{ type:"task", id:task.id, label:`${task.place} · ${task.title}` }],
        });
      }
    }

    const run = appendRun(next, {
      id:runId(key),
      eventId:eventId(key),
      ruleKey:"demo-clock",
      result:"Success",
      summary:`Demo clock advanced by ${minutes} minutes.`,
      input:{ minutes, from:oldNow.toISOString(), to:newNow.toISOString() },
      decision:{ autonomy:"Auto", reason:"Demo Control requested deterministic time advancement." },
      changes:newlyEscalated.map(task => ({ entityType:"task", entityId:task.id, action:"escalated" })),
      delivery:[],
      audit:[makeAudit(next, `Demo clock advanced by ${minutes} minutes.`)],
      linkedRecords:newlyEscalated.map(task => ({ type:"task", id:task.id, label:`${task.place} · ${task.title}` })),
    });
    return { state:next, run };
  });
}
