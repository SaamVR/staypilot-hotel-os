export class TeamInvitationError extends Error {
  constructor(message, status = 400, code = "invalid_team_invitation") {
    super(message);
    this.name = "TeamInvitationError";
    this.status = status;
    this.code = code;
  }
}

export function normalizeInviteEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (
    email.length < 3 ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new TeamInvitationError("invalid_invite_email", 400, "invalid_invite_email");
  }
  return email;
}

export function normalizeInviteRole(value) {
  const role = String(value || "").trim().toLowerCase();
  if (!["manager","staff"].includes(role)) {
    throw new TeamInvitationError("invalid_invite_role", 400, "invalid_invite_role");
  }
  return role;
}

export function normalizeInviteToken(value) {
  const token = String(value || "").trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(token)) {
    throw new TeamInvitationError("invalid_invite_token", 400, "invalid_invite_token");
  }
  return token;
}

export function generateInviteToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

export function normalizeUuid(value, code = "invalid_identifier") {
  const uuid = String(value || "").trim().toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(uuid)) {
    throw new TeamInvitationError(code, 400, code);
  }
  return uuid;
}
