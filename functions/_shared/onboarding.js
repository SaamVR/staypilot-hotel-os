export class OnboardingError extends Error {
  constructor(message, status = 400, code = "invalid_onboarding_request") {
    super(message);
    this.name = "OnboardingError";
    this.status = status;
    this.code = code;
  }
}

export function normalizeIdempotencyKey(value) {
  const key = String(value || "").trim();
  if (!/^[A-Za-z0-9._:-]{8,120}$/.test(key)) {
    throw new OnboardingError("invalid_idempotency_key", 400, "invalid_idempotency_key");
  }
  return key;
}

export function normalizeHotelSlug(value) {
  const slug = String(value || "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(slug)) {
    throw new OnboardingError("invalid_hotel_slug", 400, "invalid_hotel_slug");
  }
  return slug;
}

export function normalizeHotelName(value) {
  const name = String(value || "").replace(/\s+/g, " ").trim();
  if (name.length < 2 || name.length > 120 || /[\u0000-\u001f\u007f]/.test(name)) {
    throw new OnboardingError("invalid_hotel_name", 400, "invalid_hotel_name");
  }
  return name;
}

export function normalizeTimezone(value = "UTC") {
  const timezone = String(value || "UTC").trim();
  if (!timezone || timezone.length > 64) {
    throw new OnboardingError("invalid_timezone", 400, "invalid_timezone");
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone:timezone }).format(new Date(0));
  } catch {
    throw new OnboardingError("invalid_timezone", 400, "invalid_timezone");
  }
  return timezone;
}

export function normalizeCurrency(value = "USD") {
  const currency = String(value || "USD").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new OnboardingError("invalid_currency", 400, "invalid_currency");
  }
  try {
    new Intl.NumberFormat("en-US", { style:"currency", currency }).format(0);
  } catch {
    throw new OnboardingError("invalid_currency", 400, "invalid_currency");
  }
  return currency;
}

export function requireConfirmedAccount(user) {
  if (!user?.id) throw new OnboardingError("authentication_required", 401, "authentication_required");
  const confirmed = user.email_confirmed_at || user.phone_confirmed_at || user.confirmed_at;
  if (!confirmed) {
    throw new OnboardingError("account_verification_required", 403, "account_verification_required");
  }
  return user;
}

export function normalizeTenantBootstrapInput(input = {}, idempotencyKey) {
  return {
    idempotencyKey:normalizeIdempotencyKey(idempotencyKey),
    slug:normalizeHotelSlug(input.hotel_slug),
    name:normalizeHotelName(input.hotel_name),
    timezone:normalizeTimezone(input.timezone || "UTC"),
    currency:normalizeCurrency(input.currency || "USD"),
  };
}
