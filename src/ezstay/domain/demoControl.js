export const DEMO_CONTROL_ACTIONS = [
  { key:"advance-clock", label:"Advance +30 min" },
  { key:"sample-failure", label:"View sample failure" },
  { key:"reset-workspace", label:"Reset workspace" },
  { key:"technical-details", label:"Technical details" },
];

export function describeDemoMode(mode) {
  if (mode === "local-preview") return "Local preview sandbox";
  if (mode === "backend-sandbox") return "Backend sandbox";
  return "Demo unavailable";
}
