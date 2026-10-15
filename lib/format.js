export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

// Website images are stored as "/images/x.jpg" — they live in the website's public folder
export const imgSrc = (p) => (!p ? "" : /^(https?:|data:|blob:)/.test(p) ? p : `${SITE_URL}${p.startsWith("/") ? "" : "/"}${p}`);

export const formatINR = (n) => `₹${(Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export const nightsBetween = (a, b) => (a && b && b > a ? Math.round((new Date(b) - new Date(a)) / 86400000) : 0);

export const fmtDate = (d) =>
  d ? new Date(d.length === 10 ? d + "T00:00:00" : d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

export const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "—";

export const todayISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

export const waGuest = (phone, text = "") => {
  let digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 10) digits = "91" + digits;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
};

export const BOOKING_STATUSES = [
  { id: "pending", label: "Pending" },
  { id: "confirmed", label: "Confirmed" },
  { id: "checked-in", label: "Checked in" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
];
export const BOOKING_SOURCES = ["website", "whatsapp", "phone", "walk-in", "other"];
export const PAYMENT_MODES = [
  { id: "", label: "—" },
  { id: "cash", label: "Cash" },
  { id: "upi", label: "UPI" },
  { id: "card", label: "Card" },
  { id: "bank-transfer", label: "Bank transfer" },
  { id: "other", label: "Other" },
];
// Bookings that take up a room (a suite is full once these fill its inventory)
export const HOLDING = ["pending", "confirmed", "checked-in"];
export const addDays = (d, n) => new Date(new Date(d + "T00:00:00Z").getTime() + n * 86400000).toISOString().slice(0, 10);
export const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : "");
export const ENQUIRY_STATUSES = [
  { id: "new", label: "New" },
  { id: "replied", label: "Replied" },
  { id: "closed", label: "Closed" },
];
export const statusLabel = (list, id) => list.find((s) => s.id === id)?.label || id;

// Bookings that count towards revenue
export const EARNING = ["confirmed", "checked-in", "completed"];

export const byOrder = (a, b) => (a.order || 0) - (b.order || 0);

export const STATUS_TONE = {
  pending: "warn", confirmed: "ok", "checked-in": "info", completed: "neutral", cancelled: "bad",
  new: "warn", replied: "ok", closed: "neutral",
};
