"use client";
import { useEffect, useState } from "react";
import Icon from "./Icon";
import { Modal } from "./ui";
import { useToast } from "./Toast";
import { api, uploadImage } from "@/lib/api";
import { downloadInvoice, invoiceFile } from "@/lib/invoice";
import { PAYMENT_MODES, fmtDate, formatINR, fullName, plural, waGuest } from "@/lib/format";

const longDate = (d) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "—";

// Everything about the booking as a message the guest can read on WhatsApp or email
function bookingMessage(b, settings, location, invoiceUrl) {
  const policy = (label) => (settings.policies || []).find((p) => p.label.toLowerCase() === label)?.value;
  const mode = PAYMENT_MODES.find((p) => p.id === b.paymentMode)?.label;
  const stayTax = (b.taxAmount || 0) - (b.addonTaxAmount || 0);
  const lines = [
    `Hello ${b.name.split(" ")[0]},`,
    "",
    "Thank you for booking with CasaSaga! Here are your booking details:",
    "",
    `Booking ref: ${b.ref}`,
    b.invoiceNo && `Invoice no: ${b.invoiceNo}`,
    `Status: ${b.status === "checked-in" ? "Checked in" : b.status[0].toUpperCase() + b.status.slice(1)}`,
    "",
    `Suite: ${fullName(b.suiteName || b.suite)}`,
    location && `Location: ${location.name}`,
    location?.address?.length && `Address: ${location.address.join(", ")}`,
    `Check-in: ${longDate(b.checkIn)}${policy("check-in") ? ` (${policy("check-in")})` : ""}`,
    `Check-out: ${longDate(b.checkOut)}${policy("check-out") ? ` (${policy("check-out")})` : ""}`,
    `Nights: ${b.nights} · Guests: ${b.guests}`,
    b.occasion && `Occasion: ${b.occasion}`,
    b.addonItems?.length && `Add-ons: ${b.addonItems.map((a) => `${a.title} (${a.price == null ? "price on request" : formatINR(a.price)})`).join(", ")}`,
    "",
    "Bill",
    `Base fee (${plural(b.nights || 0, "night")} × ${formatINR(b.rate)}): ${formatINR(b.roomTotal)}`,
    b.extraGuestTotal > 0 && `Extra guest${b.extraGuests > 1 ? `s (${b.extraGuests})` : ""} (${plural(b.nights || 0, "night")} × ${formatINR(b.extraGuestRate)}): ${formatINR(b.extraGuestTotal)}`,
    b.addonTotal > 0 && `Add-ons: ${formatINR(b.addonTotal)}`,
    b.discount > 0 && `Discount${b.discountNote ? ` (${b.discountNote})` : ""}: − ${formatINR(b.discount)}`,
    stayTax > 0 && `GST on stay (${b.taxRate}%): ${formatINR(stayTax)}`,
    b.addonTaxAmount > 0 && `GST on add-ons: ${formatINR(b.addonTaxAmount)}`,
    b.convenienceFee > 0 && `Convenience fee: ${formatINR(b.convenienceFee)}`,
    `Total: ${formatINR(b.total)}`,
    `Paid: ${formatINR(b.amountPaid)}${b.paymentMode && mode ? ` (${mode})` : ""}`,
    `Balance due: ${formatINR(b.balance)}`,
    "",
    invoiceUrl && `Invoice (PDF): ${invoiceUrl}`,
    location?.mapUrl && `Directions: ${location.mapUrl}`,
    b.notes && `Your requests: ${b.notes}`,
    "",
    "We look forward to hosting you!",
    `— CasaSaga${settings.contact?.phone ? ` · ${settings.contact.phone}` : ""}`,
  ];
  // drop the blanks left by optional lines, but keep the paragraph breaks
  return lines.filter((l) => l !== false && l !== undefined && l !== null && l !== 0).join("\n").replace(/\n{3,}/g, "\n\n");
}

/**
 * Share a booking with the guest: makes the invoice PDF, saves it online so the message can
 * link to it, and offers WhatsApp, email, the device share sheet (with the PDF attached), copy
 * and download.
 */
export default function ShareBooking({ booking, suites, onClose, onChanged }) {
  const toast = useToast();
  const [state, setState] = useState({ step: "preparing", error: "" });
  const [data, setData] = useState(null); // { booking, settings, location, file, url }
  const [text, setText] = useState("");

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        // Numbers the invoice (once) and returns the latest booking + settings
        const { booking: b, settings } = await api(`/api/bookings/${booking.id}/invoice`, { method: "POST", body: {} });
        const locId = suites.find((s) => s.id === b.suite)?.location;
        const location = (settings.locations || []).find((l) => l.id === locId);
        const file = await invoiceFile(b, settings, locId);
        const url = await uploadImage(file);
        const saved = await api(`/api/bookings/${b.id}`, { method: "PUT", body: { invoiceUrl: url } });
        if (!live) return;
        onChanged(saved);
        setData({ booking: saved, settings, location, file, url, locId });
        setText(bookingMessage(saved, settings, location, url));
        setState({ step: "ready", error: "" });
      } catch (e) {
        if (live) setState({ step: "error", error: e.message });
      }
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const b = data?.booking || booking;
  const subject = `Your CasaSaga booking ${b.ref}${b.invoiceNo ? ` — invoice ${b.invoiceNo}` : ""}`;
  const canShareFile = typeof navigator !== "undefined" && data?.file && navigator.canShare?.({ files: [data.file] });

  const shareSheet = async () => {
    try {
      if (canShareFile) await navigator.share({ title: subject, text, files: [data.file] });
      else await navigator.share({ title: subject, text });
    } catch (e) {
      if (e.name !== "AbortError") toast("Sharing isn't available here — use WhatsApp, email or copy.", "error");
    }
  };
  // The CasaSaga confirmation email, sent from the booking Gmail by the server
  const [mailing, setMailing] = useState(false);
  const sendConfirmation = async () => {
    setMailing(true);
    try {
      const saved = await api(`/api/bookings/${b.id}/email`, { method: "POST", body: {} });
      setData((d) => ({ ...d, booking: saved }));
      onChanged(saved);
      toast(`Confirmation emailed to ${b.email}.`);
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setMailing(false);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast("Message copied.");
    } catch {
      toast("Couldn't copy — select the text and copy it.", "error");
    }
  };

  return (
    <Modal wide title={`Share booking ${b.ref}`} onClose={onClose}>
      {state.step === "preparing" && (
        <div className="share-wait">
          <span className="spinner" />
          <p className="muted">Preparing the invoice PDF and message…</p>
        </div>
      )}
      {state.step === "error" && <p className="error-text">{state.error}</p>}
      {state.step === "ready" && (
        <>
          <div className="share-actions">
            <a className="btn btn-gold" href={waGuest(b.phone, text)} target="_blank" rel="noopener noreferrer">
              <Icon name="chat" size={16} /> WhatsApp {b.phone}
            </a>
            {b.email && (
              <button className="btn btn-ghost" onClick={sendConfirmation} disabled={mailing}>
                <Icon name="mail" size={16} /> {mailing ? "Sending…" : `Send confirmation email${b.confirmationEmailAt ? " again" : ""}`}
              </button>
            )}
            {b.email && (
              <a className="btn btn-ghost" href={`mailto:${b.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`}>
                <Icon name="mail" size={16} /> Email this message
              </a>
            )}
            {typeof navigator !== "undefined" && navigator.share && (
              <button className="btn btn-ghost" onClick={shareSheet}>
                <Icon name="external" size={16} /> Share…{canShareFile ? " (with PDF)" : ""}
              </button>
            )}
            <button className="btn btn-ghost" onClick={copy}>
              <Icon name="edit" size={16} /> Copy message
            </button>
            <button className="btn btn-ghost" onClick={() => downloadInvoice(data.booking, data.settings, data.locId)}>
              <Icon name="download" size={16} /> Download PDF
            </button>
          </div>
          <p className="muted small share-note">
            The message includes a link to invoice <strong>{b.invoiceNo}</strong> (PDF). Edit it below before sending if you like.
            {canShareFile ? " “Share…” attaches the PDF file itself." : ""}
          </p>
          <textarea className="share-text" rows={18} value={text} onChange={(e) => setText(e.target.value)} />
          <p className="small">
            <a className="link" href={data.url} target="_blank" rel="noopener noreferrer">Open the invoice PDF</a>
            <span className="muted"> · {fmtDate(b.checkIn)} → {fmtDate(b.checkOut)}</span>
          </p>
        </>
      )}
    </Modal>
  );
}
