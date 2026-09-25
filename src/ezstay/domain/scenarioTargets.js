function first(list, predicate) {
  return Array.isArray(list) ? list.find(predicate) : undefined;
}

export function resolveScenarioTargets(snapshot = {}) {
  const checkout =
    first(snapshot.reservations, row => row.externalRef === "EZ-1047" && row.status === "Checked in") ||
    first(snapshot.reservations, row => row.status === "Checked in");

  const lowStock =
    first(snapshot.inventory, row => row.item === "Queen bed sheets" && Number(row.stock) < Number(row.par)) ||
    first(snapshot.inventory, row => Number(row.stock) < Number(row.par));

  const failedDelivery =
    first(snapshot.deliveries, row => row.status === "Dead-letter") ||
    first(snapshot.deliveries, row => row.status === "Failed");

  return {
    checkoutReservationId:checkout?.id || null,
    lowStockInventoryItemId:lowStock?.id || null,
    failedDeliveryId:failedDelivery?.id || null,
  };
}
