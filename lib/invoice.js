"use client";
import { PAYMENT_MODES, cap } from "./format";

// jsPDF's built-in fonts have no ₹ glyph, so amounts are printed as "Rs."
const rs = (n) => `Rs. ${(Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (d) =>
  d ? new Date(String(d).length === 10 ? d + "T00:00:00" : d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "-";

const WINE = [74, 24, 38];
const GOLD = [184, 137, 47];
const INK = [43, 26, 31];
const MUTED = [125, 106, 99];
const LINE = [228, 218, 206];

// Draws the invoice PDF for a booking. Lazy-loads jsPDF.
async function buildInvoice(booking, settings, suiteLocation) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 16;
  const inv = settings.invoice || {};
  const contact = settings.contact || {};
  let y = 0;

  const text = (t, x, yy, { size = 9.5, color = INK, style = "normal", font = "helvetica", align = "left" } = {}) => {
    doc.setFont(font, style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(String(t ?? ""), x, yy, { align });
  };
  const rule = (yy, color = LINE) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(0.3);
    doc.line(M, yy, W - M, yy);
  };

  // Header band
  doc.setFillColor(...WINE);
  doc.rect(0, 0, W, 34, "F");
  text(inv.businessName || "CasaSaga", M, 17, { size: 22, color: [255, 255, 255], font: "times" });
  text("Boutique romantic retreat · Bangalore", M, 24, { size: 9, color: [240, 217, 164] });
  text("INVOICE", W - M, 17, { size: 18, color: [255, 255, 255], style: "bold", align: "right" });
  text(booking.invoiceNo || "", W - M, 24, { size: 10, color: [240, 217, 164], align: "right" });

  // From / invoice meta
  y = 46;
  text("FROM", M, y, { size: 7.5, color: GOLD, style: "bold" });
  text("INVOICE DETAILS", W / 2 + 10, y, { size: 7.5, color: GOLD, style: "bold" });
  y += 6;
  // The property the stay is at; falls back to the main contact address
  const place = (settings.locations || []).find((l) => l.id === suiteLocation);
  const from = [inv.businessName || "CasaSaga", ...(place?.address?.length ? place.address : contact.address || []), contact.phone ? `Phone: ${contact.phone}` : "", inv.gstin ? `GSTIN: ${inv.gstin}` : ""].filter(Boolean);
  from.forEach((l, i) => text(l, M, y + i * 5, { style: i === 0 ? "bold" : "normal" }));
  const meta = [
    ["Invoice no.", booking.invoiceNo],
    ["Invoice date", day(booking.invoiceDate || new Date())],
    ["Booking ref.", booking.ref],
    ["Status", cap((booking.status || "").replace("-", " "))],
  ];
  meta.forEach(([k, v], i) => {
    text(k, W / 2 + 10, y + i * 5, { color: MUTED });
    text(v, W - M, y + i * 5, { align: "right", style: "bold" });
  });
  y += Math.max(from.length, meta.length) * 5 + 6;
  rule(y);

  // Guest / stay
  y += 8;
  text("BILLED TO", M, y, { size: 7.5, color: GOLD, style: "bold" });
  text("STAY", W / 2 + 10, y, { size: 7.5, color: GOLD, style: "bold" });
  y += 6;
  const guest = [booking.name, booking.phone, booking.email].filter(Boolean);
  guest.forEach((l, i) => text(l, M, y + i * 5, { style: i === 0 ? "bold" : "normal" }));
  const stay = [
    ["Suite", `${booking.suiteName || booking.suite} Suite`],
    ["Check-in", day(booking.checkIn)],
    ["Check-out", day(booking.checkOut)],
    ["Nights · Guests", `${booking.nights} · ${booking.guests}`],
  ];
  if (booking.occasion) stay.push(["Occasion", booking.occasion]);
  stay.forEach(([k, v], i) => {
    text(k, W / 2 + 10, y + i * 5, { color: MUTED });
    text(v, W - M, y + i * 5, { align: "right" });
  });
  y += Math.max(guest.length, stay.length) * 5 + 8;

  // Line items
  const cols = { desc: M + 3, qty: W - M - 70, rate: W - M - 38, amt: W - M - 3 };
  doc.setFillColor(248, 242, 234);
  doc.rect(M, y - 5, W - 2 * M, 9, "F");
  text("DESCRIPTION", cols.desc, y + 0.5, { size: 7.5, color: MUTED, style: "bold" });
  text("QTY", cols.qty, y + 0.5, { size: 7.5, color: MUTED, style: "bold", align: "right" });
  text("RATE", cols.rate, y + 0.5, { size: 7.5, color: MUTED, style: "bold", align: "right" });
  text("AMOUNT", cols.amt, y + 0.5, { size: 7.5, color: MUTED, style: "bold", align: "right" });
  y += 10;

  const row = (desc, qty, rate, amount, sub) => {
    text(desc, cols.desc, y);
    if (sub) text(sub, cols.desc, y + 4.5, { size: 8, color: MUTED });
    text(qty, cols.qty, y, { align: "right" });
    text(rate, cols.rate, y, { align: "right" });
    text(amount, cols.amt, y, { align: "right" });
    y += sub ? 11 : 8;
    rule(y - 4);
  };
  row(`${booking.suiteName || booking.suite} Suite (base fee)`, `${booking.nights} night${booking.nights === 1 ? "" : "s"}`, rs(booking.rate), rs(booking.roomTotal), `${day(booking.checkIn)} to ${day(booking.checkOut)}`);
  (booking.addonItems || []).forEach((a) => row(a.title, "1", a.price == null ? "On request" : rs(a.price), rs(a.price || 0), `In-house decoration${a.taxRate ? ` · GST ${a.taxRate}%` : ""}`));

  // Totals
  y += 2;
  const totals = [["Subtotal", rs((booking.roomTotal || 0) + (booking.addonTotal || 0))]];
  if (booking.discount) totals.push(["Discount", `- ${rs(booking.discount)}`]);
  const stayTax = (booking.taxAmount || 0) - (booking.addonTaxAmount || 0);
  if (stayTax > 0) totals.push([`GST on stay (${booking.taxRate}%)`, rs(stayTax)]);
  if (booking.addonTaxAmount) totals.push(["GST on add-ons", rs(booking.addonTaxAmount)]);
  // Online bookings: added after GST, not taxed
  if (booking.convenienceFee) totals.push(["Convenience fee", rs(booking.convenienceFee)]);
  const tx = W - M - 70;
  totals.forEach(([k, v]) => {
    text(k, tx, y, { color: MUTED });
    text(v, cols.amt, y, { align: "right" });
    y += 6;
  });
  doc.setFillColor(...WINE);
  doc.rect(tx - 4, y - 4.5, W - M - tx + 4, 10, "F");
  text("Total", tx, y + 2, { color: [255, 255, 255], style: "bold", size: 10.5 });
  text(rs(booking.total), cols.amt, y + 2, { color: [255, 255, 255], style: "bold", size: 10.5, align: "right" });
  y += 13;
  const mode = PAYMENT_MODES.find((p) => p.id === booking.paymentMode)?.label;
  text(`Paid${booking.paymentMode ? ` (${mode})` : ""}`, tx, y, { color: MUTED });
  text(rs(booking.amountPaid), cols.amt, y, { align: "right" });
  y += 6;
  text("Balance due", tx, y, { style: "bold" });
  text(rs(booking.balance), cols.amt, y, { align: "right", style: "bold", color: booking.balance > 0 ? WINE : INK });
  if (!booking.taxAmount) {
    y += 7;
    text("Taxes as applicable.", cols.amt, y, { size: 8, color: MUTED, align: "right" });
  }

  // Footer
  const H = doc.internal.pageSize.getHeight();
  rule(H - 30, GOLD);
  if (inv.note) text(inv.note, W / 2, H - 22, { font: "times", style: "italic", size: 11, color: WINE, align: "center" });
  text([contact.phone, contact.whatsapp ? `WhatsApp +${contact.whatsapp}` : ""].filter(Boolean).join("   ·   "), W / 2, H - 15, { size: 8, color: MUTED, align: "center" });
  text("This is a computer-generated invoice.", W / 2, H - 10, { size: 7, color: MUTED, align: "center" });

  return doc;
}

export const invoiceFileName = (booking) => `${booking.invoiceNo || booking.ref}-${booking.name.replace(/[^a-z0-9]+/gi, "-")}.pdf`;

/** Builds the invoice PDF and downloads it. */
export async function downloadInvoice(booking, settings, suiteLocation) {
  const doc = await buildInvoice(booking, settings, suiteLocation);
  doc.save(invoiceFileName(booking));
}

/** The invoice PDF as a File — for sharing or uploading. */
export async function invoiceFile(booking, settings, suiteLocation) {
  const doc = await buildInvoice(booking, settings, suiteLocation);
  return new File([doc.output("blob")], invoiceFileName(booking), { type: "application/pdf" });
}
