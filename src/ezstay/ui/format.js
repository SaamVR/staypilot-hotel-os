export function shortReference(value, head = 12, tail = 6) {
  const text = String(value || "").trim();
  if (!text) return "—";
  if (text.length <= head + tail + 1) return text;
  return `${text.slice(0, head)}…${text.slice(-tail)}`;
}

export function formatHotelClock(value, timeZone = "UTC") {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-GB", {
    hour:"2-digit",
    minute:"2-digit",
    hourCycle:"h23",
    timeZone,
  }).format(date);
}

export function formatHotelMoment(value, timeZone = "UTC") {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const day = new Intl.DateTimeFormat("en-GB", {
    day:"2-digit",
    month:"short",
    year:"numeric",
    timeZone,
  }).format(date);
  return `${day} · ${formatHotelClock(value, timeZone)}`;
}

export function minutesBetween(later, earlier) {
  const end = new Date(later).getTime();
  const start = new Date(earlier).getTime();
  if (!Number.isFinite(end) || !Number.isFinite(start)) return 0;
  return Math.max(0, Math.round((end - start) / 60_000));
}

export function formatCurrency(value, currency = "USD") {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("en-US", {
    style:"currency",
    currency,
    maximumFractionDigits:Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}
