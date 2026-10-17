// Shared form checks. Each returns an error message, or "" when the value is fine.
// (The website has the same rules in casasagawebsite/components/validate.js.)

const digits = (v) => String(v || "").replace(/[\s()-]/g, "");

/** A person's name: 2–80 characters, letters with spaces, dots, apostrophes or hyphens. */
export function checkName(v, label = "name") {
  const s = String(v || "").trim();
  if (!s) return `Enter the ${label}.`;
  if (s.length < 2) return `The ${label} is too short.`;
  if (s.length > 80) return `Keep the ${label} under 80 characters.`;
  if (!/^[\p{L}][\p{L}\p{M} .'-]*$/u.test(s)) return `Use letters only in the ${label}.`;
  return "";
}

/** An Indian mobile number: 10 digits starting 6–9, optionally with +91 / 91 / 0 in front. */
export function checkPhone(v, { required = true } = {}) {
  const s = digits(v);
  if (!s) return required ? "Enter a phone number." : "";
  if (!/^(\+?91|0)?[6-9]\d{9}$/.test(s)) return "Enter a valid 10-digit mobile number.";
  return "";
}

/** An email address. */
export function checkEmail(v, { required = false } = {}) {
  const s = String(v || "").trim();
  if (!s) return required ? "Enter an email address." : "";
  if (s.length > 160 || !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(s)) return "Enter a valid email address.";
  return "";
}

/** A web link (https://…). `host` (a regex) can require a site, e.g. /instagram\.com/. */
export function checkUrl(v, { required = false, host, label = "link" } = {}) {
  const s = String(v || "").trim();
  if (!s) return required ? `Enter the ${label}.` : "";
  let url;
  try {
    url = new URL(s);
  } catch {
    return `Enter a full ${label} starting with https://`;
  }
  if (!/^https?:$/.test(url.protocol)) return `Enter a full ${label} starting with https://`;
  if (host && !host.test(url.hostname)) return `That doesn't look like the right ${label}.`;
  return "";
}

/** A number in a range. Empty is allowed when `optional`. */
export function checkNumber(v, { min = 0, max = Infinity, integer = false, optional = false, label = "value" } = {}) {
  if (v === "" || v === null || v === undefined) return optional ? "" : `Enter the ${label}.`;
  const n = Number(v);
  if (!Number.isFinite(n)) return `Enter a number for the ${label}.`;
  if (integer && !Number.isInteger(n)) return `Use a whole number for the ${label}.`;
  if (n < min) return `The ${label} can't be less than ${min}.`;
  if (n > max) return `The ${label} can't be more than ${max}.`;
  return "";
}

/** Text with a length limit. */
export function checkText(v, { required = false, max = 500, label = "text" } = {}) {
  const s = String(v || "").trim();
  if (!s) return required ? `Enter the ${label}.` : "";
  if (s.length > max) return `Keep the ${label} under ${max} characters.`;
  return "";
}

/** A GSTIN: 15 characters, e.g. 29ABCDE1234F1Z5. */
export function checkGstin(v) {
  const s = String(v || "").trim().toUpperCase();
  if (!s) return "";
  return /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(s) ? "" : "Enter a valid 15-character GSTIN (e.g. 29ABCDE1234F1Z5).";
}

/** Keeps only the messages that are set: { name: "…" } — empty when all is fine. */
export const collect = (checks) => Object.fromEntries(Object.entries(checks).filter(([, m]) => m));
