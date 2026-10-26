"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import DateInput from "@/components/DateInput";
import { blockCovers } from "@/components/BlockForm";
import { Loading, PageHeader } from "@/components/ui";
import { useCollection, useSettings } from "@/lib/api";
import { BOOKING_STATUSES, addDays, holdsRoom, byOrder, fmtDate, formatINR, statusLabel, todayISO } from "@/lib/format";

const DAYS = 14;
const weekday = (d) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short" });
const dayNum = (d) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const isWeekend = (d) => [0, 6].includes(new Date(d + "T00:00:00").getDay());
const rangeTitle = (a, b) =>
  `${new Date(a + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${new Date(b + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`;

// Rooms taken per suite per night, for two weeks at a time
export default function Availability() {
  const router = useRouter();
  const { items: bookings, error } = useCollection("bookings");
  const { items: suites } = useCollection("suites");
  const { settings } = useSettings();
  // Blocked dates (Calendar → Block dates) close rooms too; if they can't be loaded the grid still shows
  const { items: loadedBlocks, error: blocksError } = useCollection("blocks");
  const blocks = loadedBlocks || (blocksError ? [] : null);
  const locName = (id) => settings?.locations?.find((l) => l.id === id)?.name;
  const [start, setStart] = useState(todayISO());

  const days = useMemo(() => Array.from({ length: DAYS }, (_, i) => addDays(start, i)), [start]);

  if (!bookings || !suites || !blocks) return <Loading error={error} />;

  const today = todayISO();
  const holding = bookings.filter(holdsRoom);
  const staysOn = (suiteId, d) => holding.filter((b) => b.suite === suiteId && b.checkIn <= d && d < b.checkOut);
  const list = [...suites].sort(byOrder);
  // Rooms of a suite closed by blocks that night (a block closes `rooms` rooms, or all of them)
  const blockedOn = (s, d) => {
    const inv = s.inventory || 1;
    const mine = blocks.filter((b) => b.from <= d && d <= b.to && blockCovers(b, s));
    return { rooms: Math.min(inv, mine.reduce((n, b) => n + (b.rooms || inv), 0)), reasons: mine.map((b) => b.reason).filter(Boolean) };
  };

  // Tonight at a glance
  const totalRooms = list.reduce((t, s) => t + (s.inventory || 1), 0);
  const occupied = list.reduce((t, s) => t + Math.min(staysOn(s.id, today).length, s.inventory || 1), 0);
  const blockedTonight = list.reduce((t, s) => t + Math.min(blockedOn(s, today).rooms, Math.max((s.inventory || 1) - staysOn(s.id, today).length, 0)), 0);
  const arrivals = holding.filter((b) => b.checkIn === today).length;
  const departures = bookings.filter((b) => b.checkOut === today && b.status !== "cancelled").length;

  const book = (suiteId, d) => router.push(`/bookings?new=1&suite=${suiteId}&checkIn=${d}`);
  const open = (b) => router.push(`/bookings?open=${b.id}`);

  // A one-room suite: join the nights of each stay into one bar
  const singleRow = (s) => {
    const cells = [];
    for (let i = 0; i < days.length; ) {
      const d = days[i];
      const b = staysOn(s.id, d)[0];
      if (!b && blockedOn(s, d).rooms > 0) {
        cells.push(
          <td key={d} className={`av-cell ${d === today ? "is-today" : ""}`}>
            <span className="av-blocked" title={`Blocked${blockedOn(s, d).reasons.length ? ` — ${blockedOn(s, d).reasons.join(", ")}` : ""} (Calendar → Blocked dates)`}>
              Blocked
            </span>
          </td>,
        );
        i++;
        continue;
      }
      if (!b) {
        cells.push(
          <td key={d} className={`av-cell ${isWeekend(d) ? "weekend" : ""} ${d === today ? "is-today" : ""}`}>
            <button className="av-free" onClick={() => book(s.id, d)} title={`${s.name} is free on ${fmtDate(d)} — click to book`}>
              Available
            </button>
          </td>,
        );
        i++;
        continue;
      }
      let span = 1;
      while (i + span < days.length && staysOn(s.id, days[i + span])[0]?.id === b.id) span++;
      const startsHere = b.checkIn >= d;
      const endsHere = b.checkOut <= addDays(d, span);
      cells.push(
        <td key={d} colSpan={span} className="av-cell">
          <button
            className={`av-stay ${b.status} ${startsHere ? "" : "cont-left"} ${endsHere ? "" : "cont-right"}`}
            onClick={() => open(b)}
            title={`${b.name} · ${fmtDate(b.checkIn)} → ${fmtDate(b.checkOut)} · ${statusLabel(BOOKING_STATUSES, b.status)} · ${formatINR(b.total)}`}
          >
            <strong>{b.name}</strong>
            <span>
              {statusLabel(BOOKING_STATUSES, b.status)}
              {span > 1 ? ` · ${dayNum(b.checkIn)} → ${dayNum(b.checkOut)}` : ""}
            </span>
          </button>
        </td>,
      );
      i += span;
    }
    return cells;
  };

  // A suite with several rooms: how many are free each night
  const multiRow = (s) =>
    days.map((d) => {
      const inv = s.inventory || 1;
      const here = staysOn(s.id, d);
      const blocked = blockedOn(s, d);
      // Free = rooms − bookings − blocked rooms
      const free = Math.max(inv - here.length - blocked.rooms, 0);
      const state = free === 0 ? (here.length ? "full" : "blk") : free <= Math.max(1, Math.floor(inv * 0.3)) ? "low" : "ok";
      return (
        <td key={d} className={`av-cell ${isWeekend(d) ? "weekend" : ""} ${d === today ? "is-today" : ""}`}>
          <button
            className={`av-count ${state}`}
            onClick={() => (free > 0 ? book(s.id, d) : here[0] ? open(here[0]) : router.push("/calendar"))}
            title={[
              here.length ? `${here.length} booked: ${here.map((b) => b.name).join(", ")}` : "",
              blocked.rooms ? `${blocked.rooms} blocked${blocked.reasons.length ? ` (${blocked.reasons.join(", ")})` : ""}` : "",
              free ? `${free} free — click to book` : here.length ? "sold out" : "all rooms blocked",
            ].filter(Boolean).join(" · ")}
          >
            <strong>{free > 0 ? `${free} free` : here.length ? "Sold out" : "Blocked"}</strong>
            {(here.length > 0 || blocked.rooms > 0) && (
              <span>{[here.length && `${here.length} booked`, blocked.rooms && `${blocked.rooms} blocked`].filter(Boolean).join(" · ")}</span>
            )}
          </button>
        </td>
      );
    });

  return (
    <>
      <PageHeader title="Availability" subtitle="Which rooms are free or booked each night. Click a free night to book it, or a booking to open it.">
        <div className="range-nav">
          <button className="icon-btn" onClick={() => setStart(addDays(start, -DAYS))} aria-label="Previous two weeks">‹</button>
          <strong className="av-range">{rangeTitle(days[0], days[DAYS - 1])}</strong>
          <button className="icon-btn" onClick={() => setStart(addDays(start, DAYS))} aria-label="Next two weeks">›</button>
          <DateInput value={start} onChange={(e) => e.target.value && setStart(e.target.value)} aria-label="Start date" />
          <button className="btn btn-ghost btn-sm" onClick={() => setStart(today)}>Today</button>
        </div>
      </PageHeader>

      <section className="stats av-stats">
        <div className="stat">
          <span className="stat-icon"><Icon name="bed" /></span>
          <span className="stat-value">{totalRooms - occupied - blockedTonight} <small className="muted">of {totalRooms}</small></span>
          <span className="stat-label">Rooms free tonight{blockedTonight ? ` · ${blockedTonight} blocked` : ""}</span>
        </div>
        <div className="stat">
          <span className="stat-icon"><Icon name="users" /></span>
          <span className="stat-value">{occupied}</span>
          <span className="stat-label">Rooms booked tonight</span>
        </div>
        <div className="stat">
          <span className="stat-icon"><Icon name="calendar" /></span>
          <span className="stat-value">{arrivals} <small className="muted">in</small> · {departures} <small className="muted">out</small></span>
          <span className="stat-label">Arrivals and departures today</span>
        </div>
      </section>

      <div className="panel table-wrap">
        <table className="av">
          <thead>
            <tr>
              <th className="av-suite">Suite</th>
              {days.map((d) => (
                <th key={d} className={`${isWeekend(d) ? "weekend" : ""} ${d === today ? "is-today" : ""}`}>
                  <span className="av-wd">{d === today ? "Today" : weekday(d)}</span>
                  <span className="av-dn">{dayNum(d)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((s) => {
              const inv = s.inventory || 1;
              return (
                <tr key={s.id} className={s.active === false ? "av-hidden" : ""}>
                  <th className="av-suite">
                    <div className="av-suite-inner">
                      <span className="cal-dot" style={{ background: s.accent }} />
                      <span>
                        <strong>{s.name}</strong>
                        {locName(s.location) && <span className="av-loc"><Icon name="pin" size={12} /> {locName(s.location)}</span>}
                        <span className="muted small">
                          {inv} room{inv > 1 ? "s" : ""} · {formatINR(s.price)}/night{s.active === false ? " · hidden" : ""}
                        </span>
                      </span>
                    </div>
                  </th>
                  {inv > 1 ? multiRow(s) : singleRow(s)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="av-legend">
        <span><i className="av-key free" /> Available — click to book</span>
        <span><i className="av-key confirmed" /> Confirmed</span>
        <span><i className="av-key checked-in" /> Checked in</span>
        <span><i className="av-key pending" /> Pending</span>
        <span className="sep" />
        <span><i className="av-key ok" /> Plenty free</span>
        <span><i className="av-key low" /> Few left</span>
        <span><i className="av-key full" /> Sold out</span>
        <span><i className="av-key blk" /> Blocked (Calendar → Block dates)</span>
      </div>
      <p className="muted small av-note">
        Pending, confirmed and checked-in bookings hold a room, and so do blocked dates; cancelled and completed bookings don&apos;t. Change how many rooms a suite has in
        Suites → Edit → Rooms of this type.
      </p>
    </>
  );
}
