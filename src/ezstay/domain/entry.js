export const EZSTAY_ENTRY_CTA = "Explore interactive demo";
export const EZSTAY_ENTRY_DISCLOSURE =
  "Interactive prototype with sample hotel data. External booking, payment, and messaging services are simulated unless explicitly connected.";

export function workspaceHash() {
  return "#demo";
}

export function resolveEzstayView(hash = "") {
  const normalized = String(hash || "").toLowerCase();
  return normalized === "#demo" || normalized.startsWith("#demo/")
    ? "workspace"
    : "presentation";
}
