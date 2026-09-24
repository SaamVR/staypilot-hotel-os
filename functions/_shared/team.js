import { sha256Hex } from "./webhook.js";

export class TeamOnboardingError extends Error {
  constructor(message, status = 400, code = "invalid_team_request") {
    super(message);
    this.name = "TeamOnboardingError";
    this.status = status;
    this.code = code;
  }
}

export function normalizeHotelId(value) {
  const id = String(value || "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new TeamOnboardingError("invalid_hotel_id", 400, "invalid_hotel_id");
  }
  return id;
}

export function normalizeInviteId(value) {
  const id = String(value || "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new TeamOnboardingError("invalid_invite_id", 400, "invalid_invite_id");
  }
  return id;
}

export function normalizeInviteEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (
    email.length < 3 ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    /[\u0000-\u001f\u007f]/.test(email)
  ) {
    throw new TeamOnboardingError("invalid_invite_email", 400, "invalid_invite_email");
  }
  return email;
}

export function normalizeInviteRole(value) {
  const role = String(value || "").trim().toLowerCase();
  if (!["manager","staff"].includes(role)) {
    throw new TeamOnboardingError("invalid_invite_role", 400, "invalid_invite_role");
  }
  return role;
}

export function normalizeInviteLifetimeHours(value = 72) {
  const hours = Number(value ?? 72);
  if (!Number.isInteger(hours) || hours < 1 || hours > 168) {
    throw new TeamOnboardingError("invalid_invite_lifetime", 400, "invalid_invite_lifetime");
  }
  return hours;
}

export function normalizeInviteToken(value) {
  const token = String(value || "").trim();
  if (!/^[A-Za-z0-9_-]{32,100}$/.test(token)) {
    throw new TeamOnboardingError("invalid_invite_token", 400, "invalid_invite_token");
  }
  return token;
}

export function generateInviteToken(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function hashInviteToken(token) {
  return sha256Hex(normalizeInviteToken(token));
}

export function requireConfirmedEmailAccount(user) {
  if (!user?.id) {
    throw new TeamOnboardingError("authentication_required", 401, "authentication_required");
  }
  if (!user?.email || !user?.email_confirmed_at) {
    throw new TeamOnboardingError("confirmed_email_required", 403, "confirmed_email_required");
  }
  return user;
}
