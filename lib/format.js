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
export const BOOKING_SOURCES = ["website", "instagram", "facebook", "google", "whatsapp", "phone", "walk-in", "referral", "other"];
// Where a booking came from — label and colour for each
export const SOURCE_INFO = {
  website: { label: "Website", color: "#8f6a1f" },
  instagram: { label: "Instagram", color: "#c13584" },
  facebook: { label: "Facebook", color: "#1877f2" },
  google: { label: "Google", color: "#1a8f4a" },
  whatsapp: { label: "WhatsApp", color: "#128c4b" },
  phone: { label: "Phone call", color: "#4a1826" },
  "walk-in": { label: "Walk-in", color: "#6b5a52" },
  referral: { label: "Referral", color: "#7a4fd1" },
  other: { label: "Other", color: "#7d6a63" },
};
export const sourceLabel = (s) => SOURCE_INFO[s]?.label || (s ? s[0].toUpperCase() + s.slice(1) : "—");
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
export const statusLabel = (list, id) => list.find((s) => s.id === id)?.label || id;

// Bookings that count towards revenue
export const EARNING = ["confirmed", "checked-in", "completed"];

export const byOrder = (a, b) => (a.order || 0) - (b.order || 0);

export const STATUS_TONE = {
  pending: "warn", confirmed: "ok", "checked-in": "info", completed: "neutral", cancelled: "bad",
};

// Media: uploaded/linked videos (.mp4 .webm .mov) and YouTube links
export const youtubeId = (src) => /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/.exec(src || "")?.[1] || null;
export const isVideo = (src) => /\.(mp4|webm|mov)(\?|#|$)/i.test(src || "") || !!youtubeId(src);
export const videoThumb = (src) => (youtubeId(src) ? `https://img.youtube.com/vi/${youtubeId(src)}/hqdefault.jpg` : null);
