"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Icon from "@/components/Icon";
import { Badge, DeleteButton, Empty, Field, Loading, Modal, PageHeader } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { api, useCollection, useSettings } from "@/lib/api";
import { downloadInvoice } from "@/lib/invoice";
import {
  BOOKING_SOURCES, BOOKING_STATUSES, HOLDING, PAYMENT_MODES, STATUS_TONE, cap, fmtDate, fmtDateTime, formatINR, sourceLabel, SOURCE_INFO,
  nightsBetween, plural, statusLabel, todayISO, waGuest,
} from "@/lib/format";

const EMPTY = {
  name: "", phone: "", email: "", suite: "", checkIn: "", checkOut: "", guests: 2, addons: [], addonItems: [],
  occasion: "", notes: "", status: "confirmed", source: "phone", rate: "", discount: 0, taxRate: "", convenienceFee: "", amountPaid: 0, paymentMode: "",
};

const num = (v) => (v === "" || v === null || v === undefined ? 0 : Number(v) || 0);
const round = (n) => Math.round(n * 100) / 100;

// Same sums as the backend (services/booking.service.js), for the live preview.
// An empty GST or convenience fee box means "auto": the suite's GST %, the fee from Settings.
function bill(form, suite, pricing = {}) {
  const nights = nightsBetween(form.checkIn, form.checkOut);
  const roomTotal = round(nights * num(form.rate));
  const addonTotal = round(form.addonItems.reduce((t, a) => t + num(a.price), 0));
  const autoTax = suite?.taxRate ?? pricing.taxRate ?? 0;
  const taxRate = form.taxRate === "" ? autoTax : num(form.taxRate);
  // GST on the stay at the suite's rate; each add-on at its own rate
  const stayTaxable = Math.max(roomTotal - num(form.discount), 0);
  const stayTaxAmount = round((stayTaxable * taxRate) / 100);
  const addonTaxAmount = round(form.addonItems.reduce((t, a) => t + (num(a.price) * (a.taxRate ?? pricing.addonTaxRate ?? 0)) / 100, 0));
  const taxAmount = round(stayTaxAmount + addonTaxAmount);
  const subtotal = round(stayTaxable + addonTotal + taxAmount);
  // Convenience fee: only on online (website) bookings, a % of the total after GST; not taxed
  const autoFee = form.online
    ? round(pricing.convenienceFeeType === "percent" ? (subtotal * (pricing.convenienceFee || 0)) / 100 : pricing.convenienceFee || 0)
    : 0;
  const convenienceFee = form.convenienceFee === "" ? autoFee : num(form.convenienceFee);
  const total = round(subtotal + convenienceFee);
  return { nights, roomTotal, addonTotal, convenienceFee, taxRate, stayTaxAmount, addonTaxAmount, taxAmount, total, autoTax, autoFee, balance: Math.max(round(total - num(form.amountPaid)), 0) };
}

// Rooms free per suite for the chosen dates (this booking itself not counted)
function useAvailability(checkIn, checkOut, excludeId) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    if (!checkIn || !checkOut || checkOut <= checkIn) return setRows(null);
    let live = true;
    api(`/api/bookings/availability?checkIn=${checkIn}&checkOut=${checkOut}${excludeId ? `&exclude=${excludeId}` : ""}`)
      .then((r) => live && setRows(r))
      .catch(() => live && setRows(null));
    return () => {
      live = false;
    };
  }, [checkIn, checkOut, excludeId]);
  return rows;
}

// Coloured label for where a booking came from
function SourceTag({ source }) {
  const info = SOURCE_INFO[source || "website"] || SOURCE_INFO.other;
  return (
    <span className="source-tag" style={{ "--src": info.color }}>
      {sourceLabel(source || "website")}
    </span>
  );
}

/* ---------- Add / edit form ---------- */

function BookingForm({ initial, suites, addons, settings, onSave, onClose, onDelete }) {
  const isNew = !initial.id;
  const [form, setForm] = useState(() => ({
    ...EMPTY,
    ...initial,
    occasion: initial.occasion ?? "",
    rate: initial.rate ?? suites.find((s) => s.id === initial.suite)?.price ?? "",
    taxRate: initial.taxRate ?? "",
    convenienceFee: initial.convenienceFee ?? "",
    addonItems: initial.addonItems?.length
      ? initial.addonItems
      : (initial.addons || []).map((id) => {
          const a = addons.find((x) => x.id === id);
          return { id, title: a?.title || id, price: a?.price ?? null, taxRate: a?.taxRate ?? settings.invoice?.addonTaxRate ?? 0 };
        }),
  }));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const avail = useAvailability(form.checkIn, form.checkOut, initial.id);
  const b = bill(form, suites.find((s) => s.id === form.suite), settings.invoice);

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((er) => ({ ...er, [k]: undefined }));
  };
  // New dates bring the fee back to automatic
  const setDate = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value, convenienceFee: "" }));
    setErrors((er) => ({ ...er, [k]: undefined }));
  };
  const chooseSuite = (e) => {
    const s = suites.find((x) => x.id === e.target.value);
    // A different suite brings its own nightly price, GST % and fee
    setForm((f) => ({ ...f, suite: e.target.value, rate: s ? s.price : f.rate, taxRate: "", convenienceFee: "" }));
    setErrors((er) => ({ ...er, suite: undefined }));
  };
  const toggleAddon = (a) =>
    setForm((f) => {
      const on = f.addonItems.some((x) => x.id === a.id);
      const addonItems = on ? f.addonItems.filter((x) => x.id !== a.id) : [...f.addonItems, { id: a.id, title: a.title, price: a.price ?? null, taxRate: a.taxRate ?? settings.invoice?.addonTaxRate ?? 0 }];
      return { ...f, addonItems, addons: addonItems.map((x) => x.id) };
    });
  const setAddonPrice = (id, v) =>
    setForm((f) => ({ ...f, addonItems: f.addonItems.map((x) => (x.id === id ? { ...x, price: v === "" ? null : v } : x)) }));

  const suiteAvail = (id) => avail?.find((r) => r.id === id);
  const chosen = suiteAvail(form.suite);
  const full = chosen && !chosen.available && HOLDING.includes(form.status);

  const submit = async (e) => {
    e.preventDefault();
    const err = {};
    if (form.name.trim().length < 2) err.name = "Enter the guest's name.";
    if (!/^[+\d][\d\s-]{7,}$/.test(form.phone || "")) err.phone = "Enter a valid phone number.";
    if (!form.suite) err.suite = "Choose a suite.";
    else if (full) err.suite = "This suite is fully booked for these dates.";
    if (!form.checkIn) err.checkIn = "Choose a check-in date.";
    if (!form.checkOut || b.nights < 1) err.checkOut = "Check-out must be after check-in.";
    if (num(form.rate) <= 0) err.rate = "Enter the nightly rate.";
    setErrors(err);
    if (Object.keys(err).length) return;
    setBusy(true);
    try {
      await onSave({
        ...form,
        guests: Number(form.guests),
        rate: num(form.rate),
        discount: num(form.discount),
        // "" = let the server work it out
        taxRate: form.taxRate === "" ? "" : num(form.taxRate),
        convenienceFee: form.convenienceFee === "" ? "" : num(form.convenienceFee),
        amountPaid: num(form.amountPaid),
        addons: form.addonItems.map((x) => x.id),
        addonItems: form.addonItems.map((x) => ({ ...x, price: x.price === null || x.price === "" ? null : Number(x.price) })),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      wide
      title={isNew ? "New booking" : `Edit ${initial.ref}`}
      onClose={onClose}
      footer={
        <>
          {!isNew && <DeleteButton onConfirm={onDelete} />}
          <span className="spacer" />
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" form="booking-form" className="btn btn-gold" disabled={busy}>
            {busy ? "Saving…" : isNew ? "Create booking" : "Save changes"}
          </button>
        </>
      }
    >
      <form id="booking-form" onSubmit={submit}>
        <h3 className="form-section">Guest</h3>
        <div className="form-grid">
          <Field label="Guest name" error={errors.name}>
            <input value={form.name} onChange={set("name")} autoFocus={isNew} />
          </Field>
          <Field label="Phone" error={errors.phone}>
            <input value={form.phone} onChange={set("phone")} placeholder="+91 …" />
          </Field>
          <Field label="Email (optional)">
            <input type="email" value={form.email} onChange={set("email")} />
          </Field>
          <Field label="Occasion">
            <select value={form.occasion} onChange={set("occasion")}>
              <option value="">—</option>
              {(settings.occasions || []).map((o) => <option key={o}>{o}</option>)}
            </select>
          </Field>
        </div>

        <h3 className="form-section">Stay</h3>
        <div className="form-grid">
          <Field label="Check-in" error={errors.checkIn}>
            <input type="date" value={form.checkIn} onChange={setDate("checkIn")} />
          </Field>
          <Field label="Check-out" error={errors.checkOut}>
            <input type="date" value={form.checkOut} min={form.checkIn || undefined} onChange={setDate("checkOut")} />
          </Field>
          <Field label="Suite" error={errors.suite} hint={avail ? "Rooms free for these dates are shown" : "Pick dates to see what's free"}>
            <select value={form.suite} onChange={chooseSuite}>
              <option value="">Choose a suite</option>
              {suites.map((s) => {
                const a = suiteAvail(s.id);
                const label = a ? (a.available ? `${a.free} of ${a.inventory} free` : "fully booked") : "";
                return (
                  <option key={s.id} value={s.id} disabled={a && !a.available && HOLDING.includes(form.status) && s.id !== initial.suite}>
                    {s.name} — {formatINR(s.price)}/night{label ? ` · ${label}` : ""}
                  </option>
                );
              })}
            </select>
          </Field>
          <Field label="Guests">
            <select value={form.guests} onChange={set("guests")}>
              {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>
        </div>
        {full && <p className="warn-box">This suite has no room left on some of these nights. Choose other dates or another suite, or set the status to cancelled.</p>}

        <h3 className="form-section">Decoration add-ons</h3>
        <div className="checks">
          {addons.map((a) => {
            const on = form.addonItems.some((x) => x.id === a.id);
            return (
              <button type="button" key={a.id} className={`check ${on ? "on" : ""}`} onClick={() => toggleAddon(a)}>
                {a.title}
                <span className="muted small">{a.price ? formatINR(a.price) : "On request"}</span>
              </button>
            );
          })}
        </div>
        {form.addonItems.length > 0 && (
          <div className="addon-prices">
            {form.addonItems.map((x) => (
              <label key={x.id} className="addon-price-row">
                <span>{x.title}</span>
                <input type="number" min="0" placeholder="Price on request" value={x.price ?? ""} onChange={(e) => setAddonPrice(x.id, e.target.value)} />
              </label>
            ))}
          </div>
        )}

        <h3 className="form-section">Price &amp; payment</h3>
        <div className="form-grid form-grid-3">
          <Field label="Base fee per night (₹)" error={errors.rate}>
            <input type="number" min="0" value={form.rate} onChange={set("rate")} />
          </Field>
          <Field label="Convenience fee (₹)" hint={form.online ? "Online booking — leave empty for automatic" : "Online bookings only; leave empty for none"}>
            <input type="number" min="0" step="0.01" value={form.convenienceFee} onChange={set("convenienceFee")} placeholder={`Auto: ${formatINR(b.autoFee)}`} />
          </Field>
          <Field label="GST (%)" hint="Leave empty for the suite's rate">
            <input type="number" min="0" max="100" step="0.01" value={form.taxRate} onChange={set("taxRate")} placeholder={`Auto: ${b.autoTax}%`} />
          </Field>
          <Field label="Discount (₹)">
            <input type="number" min="0" value={form.discount} onChange={set("discount")} />
          </Field>
          <Field label="Amount paid (₹)">
            <input type="number" min="0" value={form.amountPaid} onChange={set("amountPaid")} />
          </Field>
          <Field label="Payment mode">
            <select value={form.paymentMode} onChange={set("paymentMode")}>
              {PAYMENT_MODES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={set("status")}>
              {BOOKING_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="Source (where it came from)">
            <select value={form.source} onChange={set("source")}>
              {BOOKING_SOURCES.map((s) => <option key={s} value={s}>{sourceLabel(s)}</option>)}
            </select>
          </Field>
        </div>

        <h3 className="form-section">Notes</h3>
        <textarea rows={3} value={form.notes} onChange={set("notes")} placeholder="Special requests, arrival time…" />
      </form>

      <h3 className="form-section">Bill (calculated automatically)</h3>
      <dl className="bill">
        <dt>Base fee · {b.nights ? `${plural(b.nights, "night")} × ${formatINR(form.rate)}` : "—"}</dt><dd>{formatINR(b.roomTotal)}</dd>
        <dt>Add-ons</dt><dd>{formatINR(b.addonTotal)}</dd>
        {num(form.discount) > 0 && (<><dt>Discount</dt><dd>− {formatINR(form.discount)}</dd></>)}
        <dt>GST on stay ({b.taxRate}%)</dt><dd>{formatINR(b.stayTaxAmount)}</dd>
        <dt>GST on add-ons</dt><dd>{formatINR(b.addonTaxAmount)}</dd>
        <dt>Convenience fee{form.online ? "" : " (online bookings only)"}</dt><dd>{formatINR(b.convenienceFee)}</dd>
        <dt className="bill-total">Total</dt><dd className="bill-total">{formatINR(b.total)}</dd>
        <dt className="bill-balance">Balance after payment</dt><dd className={`bill-balance ${b.balance > 0 ? "due" : ""}`}>{formatINR(b.balance)}</dd>
      </dl>
    </Modal>
  );
}

/* ---------- Detail view ---------- */

const NEXT_STEPS = {
  pending: [
    { action: "confirm", label: "Confirm booking", primary: true },
    { action: "check-in", label: "Check in" },
    { action: "cancel", label: "Cancel", danger: true },
  ],
  confirmed: [
    { action: "check-in", label: "Check in", primary: true },
    { action: "cancel", label: "Cancel", danger: true },
  ],
  "checked-in": [{ action: "check-out", label: "Check out", primary: true }],
  completed: [],
  cancelled: [{ action: "reopen", label: "Re-open as pending" }],
};

function Row({ label, children }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{children || "—"}</dd>
    </>
  );
}

function BookingDetail({ booking: b, suites, settings, onClose, onEdit, onChanged }) {
  const toast = useToast();
  const [busy, setBusy] = useState("");
  const [settle, setSettle] = useState(true);
  const [mode, setMode] = useState(b.paymentMode || "upi");
  const suite = suites.find((s) => s.id === b.suite);
  const mode_ = PAYMENT_MODES.find((p) => p.id === b.paymentMode)?.label;

  const run = async (action) => {
    setBusy(action);
    try {
      const body = action === "check-out" && settle && b.balance > 0 ? { settle: true, paymentMode: mode } : undefined;
      const saved = await api(`/api/bookings/${b.id}/${action}`, { method: "POST", body: body || {} });
      onChanged(saved);
      toast(
        { confirm: "Booking confirmed.", "check-in": `${b.name} checked in.`, "check-out": `${b.name} checked out.`, cancel: "Booking cancelled.", reopen: "Booking re-opened." }[action],
      );
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setBusy("");
    }
  };

  const invoice = async () => {
    setBusy("invoice");
    try {
      const { booking, settings: s } = await api(`/api/bookings/${b.id}/invoice`, { method: "POST", body: {} });
      onChanged(booking);
      await downloadInvoice(booking, s, suites.find((x) => x.id === booking.suite)?.location);
      toast(`Invoice ${booking.invoiceNo} downloaded.`);
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setBusy("");
    }
  };

  const timeline = [
    ["Requested", b.createdAt],
    ["Confirmed", b.confirmedAt],
    ["Checked in", b.checkedInAt],
    ["Checked out", b.checkedOutAt],
    ["Cancelled", b.cancelledAt],
  ].filter(([, t]) => t);

  return (
    <Modal
      wide
      title={`Booking ${b.ref}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onEdit}>
            <Icon name="edit" size={15} /> Edit
          </button>
          {b.status !== "cancelled" && (
            <button className="btn btn-ghost" onClick={invoice} disabled={!!busy}>
              <Icon name="download" size={15} /> {busy === "invoice" ? "Preparing…" : b.invoiceNo ? "Download invoice" : "Create invoice (PDF)"}
            </button>
          )}
          <span className="spacer" />
          <a className="icon-btn" href={waGuest(b.phone, `Hello ${b.name.split(" ")[0]}, this is CasaSaga regarding your booking ${b.ref}.`)} target="_blank" rel="noopener noreferrer" title="WhatsApp guest">
            <Icon name="chat" size={17} />
          </a>
          <a className="icon-btn" href={`tel:${b.phone}`} title="Call guest">
            <Icon name="phone" size={17} />
          </a>
        </>
      }
    >
      <div className="detail-top">
        <div>
          <div className="detail-name">{b.name}</div>
          <div className="muted small">
            {b.suiteName || suite?.name || b.suite} Suite · {fmtDate(b.checkIn)} → {fmtDate(b.checkOut)} · {plural(b.nights || nightsBetween(b.checkIn, b.checkOut), "night")}
          </div>
        </div>
        <Badge tone={STATUS_TONE[b.status]}>{statusLabel(BOOKING_STATUSES, b.status)}</Badge>
      </div>

      {NEXT_STEPS[b.status].length > 0 && (
        <div className="steps-bar">
          {b.status === "checked-in" && b.balance > 0 && (
            <label className="settle">
              <input type="checkbox" checked={settle} onChange={(e) => setSettle(e.target.checked)} />
              Mark balance {formatINR(b.balance)} as paid by
              <select value={mode} onChange={(e) => setMode(e.target.value)} className="select-sm">
                {PAYMENT_MODES.filter((p) => p.id).map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </label>
          )}
          <span className="spacer" />
          {NEXT_STEPS[b.status].map((s) => (
            <button
              key={s.action}
              className={`btn ${s.primary ? "btn-gold" : s.danger ? "btn-danger" : "btn-ghost"}`}
              onClick={() => run(s.action)}
              disabled={!!busy}
            >
              {busy === s.action ? "…" : s.label}
            </button>
          ))}
        </div>
      )}

      <div className="detail-grid">
        <section>
          <h3 className="form-section">Guest</h3>
          <dl className="details">
            <Row label="Name">{b.name}</Row>
            <Row label="Phone"><a className="link" href={`tel:${b.phone}`}>{b.phone}</a></Row>
            <Row label="Email">{b.email && <a className="link" href={`mailto:${b.email}`}>{b.email}</a>}</Row>
            <Row label="Guests">{b.guests}</Row>
            <Row label="Occasion">{b.occasion}</Row>
          </dl>
        </section>
        <section>
          <h3 className="form-section">Stay</h3>
          <dl className="details">
            <Row label="Suite">{b.suiteName || suite?.name || b.suite} Suite</Row>
            <Row label="Check-in">{fmtDate(b.checkIn)}</Row>
            <Row label="Check-out">{fmtDate(b.checkOut)}</Row>
            <Row label="Nights">{b.nights || nightsBetween(b.checkIn, b.checkOut)}</Row>
            <Row label="Source"><SourceTag source={b.source} /></Row>
          </dl>
        </section>
      </div>

      <h3 className="form-section">Add-ons</h3>
      {b.addonItems?.length ? (
        <ul className="addon-list">
          {b.addonItems.map((a) => (
            <li key={a.id}>
              <span>{a.title}</span>
              <strong>{a.price == null ? <span className="muted">Price on request</span> : <>{formatINR(a.price)}{a.taxRate ? <span className="muted small"> + {a.taxRate}% GST</span> : null}</>}</strong>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted small">No add-ons.</p>
      )}

      <h3 className="form-section">Bill</h3>
      <dl className="bill">
        <dt>Base fee · {plural(b.nights || 0, "night")} × {formatINR(b.rate)}</dt><dd>{formatINR(b.roomTotal)}</dd>
        <dt>Add-ons</dt><dd>{formatINR(b.addonTotal)}</dd>
        {b.discount > 0 && (<><dt>Discount</dt><dd>− {formatINR(b.discount)}</dd></>)}
        {b.taxAmount - (b.addonTaxAmount || 0) > 0 && (<><dt>GST on stay ({b.taxRate}%)</dt><dd>{formatINR(b.taxAmount - (b.addonTaxAmount || 0))}</dd></>)}
        {b.addonTaxAmount > 0 && (<><dt>GST on add-ons</dt><dd>{formatINR(b.addonTaxAmount)}</dd></>)}
        {b.convenienceFee > 0 && (<><dt>Convenience fee</dt><dd>{formatINR(b.convenienceFee)}</dd></>)}
        <dt className="bill-total">Total</dt><dd className="bill-total">{formatINR(b.total)}</dd>
        <dt>Paid{mode_ && b.paymentMode ? ` (${mode_})` : ""}</dt><dd>{formatINR(b.amountPaid)}</dd>
        <dt className="bill-balance">Balance</dt><dd className={`bill-balance ${b.balance > 0 ? "due" : ""}`}>{formatINR(b.balance)}</dd>
      </dl>
      {b.addonItems?.some((a) => a.price == null) && (
        <p className="warn-box">Some add-ons have no price yet. Use Edit to enter the agreed price before invoicing.</p>
      )}

      {b.notes && (
        <>
          <h3 className="form-section">Notes</h3>
          <p className="message">{b.notes}</p>
        </>
      )}

      <h3 className="form-section">Timeline</h3>
      <ol className="timeline">
        {timeline.map(([label, t]) => (
          <li key={label}>
            <span>{label}</span>
            <span className="muted small">{fmtDateTime(t)}</span>
          </li>
        ))}
        {b.invoiceNo && (
          <li>
            <span>Invoice {b.invoiceNo}</span>
            <span className="muted small">{fmtDateTime(b.invoiceDate)}</span>
          </li>
        )}
      </ol>
    </Modal>
  );
}

/* ---------- List ---------- */

function Bookings() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const { items, setItems, error, save, remove } = useCollection("bookings");
  const { items: suites } = useCollection("suites");
  const { items: addons } = useCollection("addons");
  const { settings } = useSettings();
  const [status, setStatus] = useState(params.get("status") || "all");
  const [when, setWhen] = useState("all");
  const [source, setSource] = useState(params.get("source") || "all");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);

  const ready = items && suites && addons && settings;

  // Deep links: ?new=1[&suite=&checkIn=] from the dashboard / availability, ?open=<id>
  useEffect(() => {
    if (!ready) return;
    if (params.get("new")) {
      const checkIn = params.get("checkIn") || todayISO();
      setEditing({ ...EMPTY, checkIn, suite: params.get("suite") || "" });
      router.replace("/bookings");
    } else if (params.get("open")) {
      const b = items.find((x) => x.id === params.get("open"));
      if (b) setViewing(b);
      router.replace("/bookings");
    }
  }, [ready, params, router, items]);

  const list = useMemo(() => {
    if (!items) return [];
    const today = todayISO();
    const term = q.trim().toLowerCase();
    return items
      .filter((b) => status === "all" || b.status === status)
      .filter((b) => when === "all" || (when === "upcoming" ? b.checkOut >= today : b.checkOut < today))
      .filter((b) => source === "all" || (b.source || "website") === source)
      .filter((b) => !term || [b.name, b.phone, b.email, b.ref, b.invoiceNo].some((v) => (v || "").toLowerCase().includes(term)))
      .sort((a, b) => (when === "upcoming" ? a.checkIn.localeCompare(b.checkIn) : (b.createdAt || "").localeCompare(a.createdAt || "")));
  }, [items, status, when, source, q]);

  if (!ready) return <Loading error={error} />;

  const suiteName = (b) => b.suiteName || suites.find((s) => s.id === b.suite)?.name || b.suite;
  const locName = (b) => settings.locations?.find((l) => l.id === suites.find((s) => s.id === b.suite)?.location)?.name;
  const count = (s) => items.filter((b) => s === "all" || b.status === s).length;
  const replace = (saved) => {
    setItems((list) => list.map((x) => (x.id === saved.id ? saved : x)));
    setViewing((v) => (v && v.id === saved.id ? saved : v));
  };

  const onSave = async (data) => {
    try {
      const saved = await save(data);
      toast(data.id ? "Booking updated." : `Booking ${saved.ref} created.`);
      setEditing(null);
      setViewing(saved);
    } catch (e) {
      toast(e.message, "error");
    }
  };

  return (
    <>
      <PageHeader title="Bookings" subtitle="Click a booking to see everything about it">
        <button className="btn btn-gold" onClick={() => setEditing({ ...EMPTY, checkIn: todayISO() })}>
          <Icon name="plus" size={16} /> New booking
        </button>
      </PageHeader>

      <div className="toolbar">
        <div className="tabs">
          {[{ id: "all", label: "All" }, ...BOOKING_STATUSES].map((s) => (
            <button key={s.id} className={`tab ${status === s.id ? "active" : ""}`} onClick={() => setStatus(s.id)}>
              {s.label} <span className="tab-count">{count(s.id)}</span>
            </button>
          ))}
        </div>
        <div className="toolbar-right">
          <select value={source} onChange={(e) => setSource(e.target.value)} className="select-sm" aria-label="Source">
            <option value="all">All sources</option>
            {BOOKING_SOURCES.map((s) => (
              <option key={s} value={s}>{sourceLabel(s)} ({items.filter((b) => (b.source || "website") === s).length})</option>
            ))}
          </select>
          <select value={when} onChange={(e) => setWhen(e.target.value)} className="select-sm">
            <option value="all">Any dates</option>
            <option value="upcoming">Upcoming & current</option>
            <option value="past">Past stays</option>
          </select>
          <div className="search">
            <Icon name="search" size={16} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, phone, ref or invoice" />
          </div>
        </div>
      </div>

      {list.length ? (
        <div className="panel table-wrap">
          <table className="table table-click">
            <thead>
              <tr>
                <th>Ref</th>
                <th>Guest</th>
                <th>Suite</th>
                <th>Stay</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {list.map((b) => (
                <tr key={b.id} onClick={() => setViewing(b)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setViewing(b)}>
                  <td>
                    <span className="mono">{b.ref}</span>
                    <div className="muted small">{fmtDateTime(b.createdAt)}</div>
                    <SourceTag source={b.source} />
                  </td>
                  <td>
                    <strong>{b.name}</strong>
                    <div className="muted small">{b.phone}{b.occasion ? ` · ${b.occasion}` : ""}</div>
                  </td>
                  <td>
                    {suiteName(b)}
                    {locName(b) && <span className="av-loc"><Icon name="pin" size={12} /> {locName(b)}</span>}
                    {b.addons?.length > 0 && <div className="muted small">+ {(b.addonItems || []).map((a) => a.title).join(", ") || `${b.addons.length} add-on(s)`}</div>}
                  </td>
                  <td>
                    {fmtDate(b.checkIn)} → {fmtDate(b.checkOut)}
                    <div className="muted small">{plural(nightsBetween(b.checkIn, b.checkOut), "night")} · {plural(Number(b.guests) || 0, "guest")}</div>
                  </td>
                  <td>
                    {formatINR(b.total)}
                    {b.balance > 0 && b.status !== "cancelled" && <div className="muted small">Due {formatINR(b.balance)}</div>}
                  </td>
                  <td>
                    <Badge tone={STATUS_TONE[b.status]}>{statusLabel(BOOKING_STATUSES, b.status)}</Badge>
                    {b.invoiceNo && <div className="muted small">{b.invoiceNo}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty icon="calendar" title={items.length ? "No bookings match" : "No bookings yet"} text={items.length ? "Try another filter or search." : "Requests from the website's booking form appear here. You can also add bookings taken by phone."}>
          {!items.length && (
            <button className="btn btn-gold" onClick={() => setEditing({ ...EMPTY, checkIn: todayISO() })}>
              <Icon name="plus" size={16} /> New booking
            </button>
          )}
        </Empty>
      )}

      {viewing && !editing && (
        <BookingDetail
          booking={viewing}
          suites={suites}
          settings={settings}
          onClose={() => setViewing(null)}
          onEdit={() => setEditing(viewing)}
          onChanged={replace}
        />
      )}

      {editing && (
        <BookingForm
          initial={editing}
          suites={suites}
          addons={addons}
          settings={settings}
          onSave={onSave}
          onClose={() => setEditing(null)}
          onDelete={async () => {
            await remove(editing.id);
            toast("Booking deleted.");
            setEditing(null);
            setViewing(null);
          }}
        />
      )}
    </>
  );
}

export default function BookingsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Bookings />
    </Suspense>
  );
}
