"use client";
import { useState } from "react";
import { Field, Modal } from "./ui";
import { byOrder, fmtDate, fullName, todayISO } from "@/lib/format";

/** "All suites & flats" / "Banashankari 6th Stage (all)" / "Tulum Suite, Riviera Suite" — with "2 rooms of" when partial */
export function blockLabel(b, suites, locations) {
  let what;
  if (b.suites?.length) what = b.suites.map((id) => fullName(suites.find((s) => s.id === id)?.name || id)).join(", ");
  else if (b.location) what = `${locations.find((l) => l.id === b.location)?.name || b.location} (all)`;
  else what = "All suites & flats";
  return b.rooms ? `${b.rooms} room${b.rooms === 1 ? "" : "s"} of ${what}` : what;
}

export const blockDates = (b) => (b.from === b.to ? fmtDate(b.from) : `${fmtDate(b.from)} → ${fmtDate(b.to)}`);

/** Does the block close (some of) this suite? (same rule as the server's Block.covers) */
export const blockCovers = (b, suite) =>
  b.suites?.length ? b.suites.includes(suite.id) : b.location ? suite.location === b.location : true;

// The calendar's filter ("all", "loc:<id>" or a suite id) as the form's starting choice
const fromScope = (scope = "all") =>
  scope === "all" ? { mode: "all", location: "", picked: [] } : scope.startsWith("loc:") ? { mode: "location", location: scope.slice(4), picked: [] } : { mode: "suites", location: "", picked: [scope] };

/**
 * Close dates to bookings: the nights from…to (both included), for every suite, a whole location
 * or the suites ticked — all their rooms, or just some (flats have several units).
 */
export default function BlockForm({ initial, suites, locations, onSave, onClose }) {
  const sorted = [...suites].sort(byOrder);
  const [form, setForm] = useState({ from: initial.from || todayISO(), to: initial.to || initial.from || todayISO(), reason: "", rooms: "", ...fromScope(initial.scope) });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const update = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setError("");
  };
  const set = (k) => (e) => {
    const v = e.target.value;
    // Moving the first night past the last one moves the last one along
    update({ [k]: v, ...(k === "from" && form.to < v ? { to: v } : {}) });
  };
  // Uses the latest picks, so quick clicks never lose one
  const toggle = (id) => {
    setForm((f) => ({ ...f, picked: f.picked.includes(id) ? f.picked.filter((x) => x !== id) : [...f.picked, id] }));
    setError("");
  };

  // The suites this block would touch, and the most rooms any of them has (for the rooms choice)
  const chosen =
    form.mode === "all" ? sorted : form.mode === "location" ? sorted.filter((s) => s.location === form.location) : sorted.filter((s) => form.picked.includes(s.id));
  const mostRooms = Math.max(1, ...chosen.map((s) => s.inventory || 1));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.from || !form.to) return setError("Choose the first and last night to block.");
    if (form.to < form.from) return setError("The last night can't be before the first.");
    if (form.mode === "location" && !form.location) return setError("Choose a location.");
    if (form.mode === "suites" && !form.picked.length) return setError("Tick at least one suite or flat.");
    if (form.reason.length > 120) return setError("Keep the reason under 120 characters.");
    setBusy(true);
    try {
      await onSave({
        from: form.from,
        to: form.to,
        reason: form.reason.trim(),
        suites: form.mode === "suites" ? form.picked : [],
        location: form.mode === "location" ? form.location : "",
        rooms: form.rooms && Number(form.rooms) < mostRooms ? Number(form.rooms) : null,
      });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const nights = Math.round((new Date(form.to) - new Date(form.from)) / 86400000) + 1;
  return (
    <Modal
      wide
      title="Block dates"
      onClose={onClose}
      footer={
        <>
          <span className="spacer" />
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" form="block-form" className="btn btn-gold" disabled={busy}>{busy ? "Blocking…" : "Block these dates"}</button>
        </>
      }
    >
      <form id="block-form" onSubmit={submit} className="form-grid" noValidate>
        <Field label="First night">
          <input type="date" value={form.from} onChange={set("from")} />
        </Field>
        <Field label="Last night" hint={nights > 0 ? `${nights} night${nights === 1 ? "" : "s"} — guests can still check out on ${fmtDate(form.from)} and check in after ${fmtDate(form.to)}` : ""}>
          <input type="date" value={form.to} min={form.from} onChange={set("to")} />
        </Field>

        <Field label="Block" full>
          <div className="checks">
            {[["all", "All suites & flats"], ["location", "A whole location"], ["suites", "Choose suites / flats"]].map(([mode, label]) => (
              <button type="button" key={mode} className={`check ${form.mode === mode ? "on" : ""}`} aria-pressed={form.mode === mode} onClick={() => update({ mode, rooms: "" })}>
                {label}
              </button>
            ))}
          </div>
        </Field>

        {form.mode === "location" && (
          <Field label="Location" full>
            <select value={form.location} onChange={(e) => update({ location: e.target.value, rooms: "" })}>
              <option value="">Choose a location</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </Field>
        )}

        {form.mode === "suites" && (
          <Field label={`Suites / flats to block${form.picked.length ? ` (${form.picked.length} ticked)` : ""}`} full>
            <div className="block-picks">
              {locations.map((l) => {
                const here = sorted.filter((s) => s.location === l.id);
                if (!here.length) return null;
                return (
                  <div key={l.id} className="block-pick-group">
                    <span className="muted small">{l.name}</span>
                    <div className="checks">
                      {here.map((s) => (
                        <button type="button" key={s.id} className={`check ${form.picked.includes(s.id) ? "on" : ""}`} aria-pressed={form.picked.includes(s.id)} onClick={() => toggle(s.id)}>
                          {form.picked.includes(s.id) ? "✓ " : ""}{fullName(s.name)}
                          {(s.inventory || 1) > 1 && <span className="muted small">{s.inventory} rooms</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Field>
        )}

        {mostRooms > 1 && chosen.length > 0 && (
          <Field label="Rooms to block" hint={form.rooms ? `Closes ${form.rooms} room${Number(form.rooms) === 1 ? "" : "s"} of each — the rest stay bookable (a suite with fewer rooms is fully closed)` : "Every room of each chosen suite / flat"}>
            <select value={form.rooms} onChange={(e) => update({ rooms: e.target.value })}>
              <option value="">All rooms</option>
              {Array.from({ length: mostRooms - 1 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n} room{n === 1 ? "" : "s"}</option>
              ))}
            </select>
          </Field>
        )}

        <Field label="Reason (optional)" hint="Only you see this — e.g. Maintenance, Private event" full>
          <input value={form.reason} onChange={set("reason")} maxLength={120} placeholder="Maintenance" />
        </Field>
        <p className="muted small field-full">
          Blocked nights show as unavailable on the website, and no booking — online or here — can use them. Existing bookings on these nights stay as
          they are.
        </p>
        {error && <p className="error-text field-full">{error}</p>}
      </form>
    </Modal>
  );
}
