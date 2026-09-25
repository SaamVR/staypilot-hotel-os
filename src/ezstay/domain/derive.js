export function roomSellable(room) {
  return room.occupancy === "Vacant" && room.housekeeping === "Clean" && room.maintenance === "Clear";
}

export function deriveHotelMetrics(snapshot) {
  const rooms = snapshot.rooms || [];
  const tasks = snapshot.tasks || [];
  const approvals = snapshot.approvals || [];
  const deliveries = snapshot.deliveries || [];

  return {
    totalRooms:rooms.length,
    occupiedRooms:rooms.filter(room => room.occupancy === "Occupied").length,
    reservedRooms:rooms.filter(room => room.occupancy === "Reserved").length,
    cleanVacantRooms:rooms.filter(roomSellable).length,
    blockedRooms:rooms.filter(room => room.maintenance !== "Clear").length,
    openTasks:tasks.filter(task => task.status !== "Done").length,
    pendingApprovals:approvals.filter(approval => approval.status === "Pending").length,
    failedDeliveries:deliveries.filter(delivery => ["Failed","Dead-letter"].includes(delivery.status)).length,
  };
}

export function findRoom(snapshot, roomNumber) {
  return (snapshot.rooms || []).find(room => room.number === String(roomNumber)) || null;
}
