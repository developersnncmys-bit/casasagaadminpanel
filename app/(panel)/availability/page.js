"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { Loading, PageHeader } from "@/components/ui";
import { useCollection, useSettings } from "@/lib/api";
import { BOOKING_STATUSES, HOLDING, addDays, byOrder, fmtDate, formatINR, statusLabel, todayISO } from "@/lib/format";

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
  const locName = (id) => settings?.locations?.find((l) => l.id === id)?.name;
  const [start, setStart] = useState(todayISO());

  const days = useMemo(() => Array.from({ length: DAYS }, (_, i) => addDays(start, i)), [start]);

  if (!bookings || !suites) return <Loading error={error} />;

  const today = todayISO();
  const holding = bookings.filter((b) => HOLDING.includes(b.status));
  const staysOn = (suiteId, d) => holding.filter((b) => b.suite === suiteId && b.checkIn <= d && d < b.checkOut);
  const list = [...suites].sort(byOrder);

  // Tonight at a glance
  const totalRooms = list.reduce((t, s) => t + (s.inventory || 1), 0);
  const occupied = list.reduce((t, s) => t + Math.min(staysOn(s.id, today).length, s.inventory || 1), 0);
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
      const free = Math.max(inv - here.length, 0);
      const state = free === 0 ? "full" : free <= Math.max(1, Math.floor(inv * 0.3)) ? "low" : "ok";
      return (
        <td key={d} className={`av-cell ${isWeekend(d) ? "weekend" : ""} ${d === today ? "is-today" : ""}`}>
          <button
            className={`av-count ${state}`}
            onClick={() => (free > 0 ? book(s.id, d) : open(here[0]))}
            title={
              here.length
                ? `${here.length} booked: ${here.map((b) => b.name).join(", ")}${free ? " — click to book another" : " — sold out"}`
                : "All rooms free — click to book"
            }
          >
            <strong>{free === 0 ? "Sold out" : `${free} free`}</strong>
            {here.length > 0 && <span>{here.length} booked</span>}
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
          <input type="date" value={start} onChange={(e) => e.target.value && setStart(e.target.value)} aria-label="Start date" />
          <button className="btn btn-ghost btn-sm" onClick={() => setStart(today)}>Today</button>
        </div>
      </PageHeader>

      <section className="stats av-stats">
        <div className="stat">
          <span className="stat-icon"><Icon name="bed" /></span>
          <span className="stat-value">{totalRooms - occupied} <small className="muted">of {totalRooms}</small></span>
          <span className="stat-label">Rooms free tonight</span>
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
      </div>
      <p className="muted small av-note">
        Pending, confirmed and checked-in bookings hold a room; cancelled and completed ones don&apos;t. Change how many rooms a suite has in
        Suites → Edit → Rooms of this type.
      </p>
    </>
  );
}
