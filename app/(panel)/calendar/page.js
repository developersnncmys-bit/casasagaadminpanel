"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { Badge, Loading, Modal, PageHeader } from "@/components/ui";
import { useCollection, useSettings } from "@/lib/api";
import { BOOKING_STATUSES, STATUS_TONE, addDays, byOrder, fmtDate, formatINR, statusLabel, todayISO } from "@/lib/format";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_CHIPS = 3;

const monthKey = (d) => d.slice(0, 7);
const monthTitle = (ym) => new Date(ym + "-01T00:00:00").toLocaleDateString("en-IN", { month: "long", year: "numeric" });
const shiftMonth = (ym, n) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
};
const dayLong = (d) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

// The 6-week grid (Monday first) that covers a month
function monthGrid(ym) {
  const first = `${ym}-01`;
  const weekday = (new Date(first + "T00:00:00").getDay() + 6) % 7; // 0 = Monday
  const start = addDays(first, -weekday);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

// Month view of every booking: who arrives, stays and leaves each day
export default function Calendar() {
  const router = useRouter();
  const { items: bookings, error } = useCollection("bookings");
  const { items: suites } = useCollection("suites");
  const { settings } = useSettings();
  const [ym, setYm] = useState(monthKey(todayISO()));
  const [suite, setSuite] = useState("all");
  const [showCancelled, setShowCancelled] = useState(false);
  const [day, setDay] = useState(null);

  const grid = useMemo(() => monthGrid(ym), [ym]);

  if (!bookings || !suites) return <Loading error={error} />;

  const today = todayISO();
  const accent = (id) => suites.find((s) => s.id === id)?.accent || "#b8892f";
  const locOf = (suiteId) => suites.find((s) => s.id === suiteId)?.location;
  // "loc:<id>" filters by property, anything else by suite
  const matches = (b) => suite === "all" || (suite.startsWith("loc:") ? locOf(b.suite) === suite.slice(4) : b.suite === suite);
  const list = bookings.filter((b) => (showCancelled || b.status !== "cancelled") && matches(b));

  // For a day: who is staying that night, who arrives, who leaves
  const onDay = (d) => ({
    staying: list.filter((b) => b.checkIn <= d && d < b.checkOut),
    arriving: list.filter((b) => b.checkIn === d),
    leaving: list.filter((b) => b.checkOut === d),
  });

  const inMonth = list.filter((b) => b.checkIn <= `${ym}-31` && b.checkOut > `${ym}-01`);
  const open = (b) => router.push(`/bookings?open=${b.id}`);

  return (
    <>
      <PageHeader title="Calendar" subtitle="Every booking by date — click a booking to open it, or a day to see who arrives, stays and leaves">
        <div className="range-nav">
          <button className="icon-btn" onClick={() => setYm(shiftMonth(ym, -1))} aria-label="Previous month">‹</button>
          <strong className="cal-month">{monthTitle(ym)}</strong>
          <button className="icon-btn" onClick={() => setYm(shiftMonth(ym, 1))} aria-label="Next month">›</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setYm(monthKey(today))}>Today</button>
        </div>
      </PageHeader>

      <div className="toolbar">
        <div className="tabs">
          <button className={`tab ${suite === "all" ? "active" : ""}`} onClick={() => setSuite("all")}>All suites</button>
          {(settings?.locations || []).map((l) => (
            <button key={l.id} className={`tab ${suite === `loc:${l.id}` ? "active" : ""}`} onClick={() => setSuite(`loc:${l.id}`)}>
              <Icon name="pin" size={13} /> {l.name}
            </button>
          ))}
          {[...suites].sort(byOrder).map((s) => (
            <button key={s.id} className={`tab ${suite === s.id ? "active" : ""}`} onClick={() => setSuite(s.id)}>
              <span className="cal-dot" style={{ background: s.accent }} />
              {s.name}
            </button>
          ))}
        </div>
        <div className="toolbar-right">
          <span className="muted small">{inMonth.length} booking{inMonth.length === 1 ? "" : "s"} this month</span>
          <label className="settle">
            <input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} />
            Show cancelled
          </label>
        </div>
      </div>

      <div className="panel month">
        {WEEKDAYS.map((w) => (
          <div key={w} className="month-head">{w}</div>
        ))}
        {grid.map((d) => {
          const { staying, arriving, leaving } = onDay(d);
          const outside = monthKey(d) !== ym;
          return (
            <div
              key={d}
              className={`month-day ${outside ? "outside" : ""} ${d === today ? "is-today" : ""}`}
              onClick={() => setDay(d)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && setDay(d)}
              aria-label={`${dayLong(d)}: ${staying.length} staying, ${arriving.length} arriving, ${leaving.length} leaving`}
            >
              <div className="month-date">
                <span>{Number(d.slice(8))}</span>
                {(arriving.length > 0 || leaving.length > 0) && (
                  <span className="month-moves">
                    {arriving.length > 0 && <span title="Arriving">↘ {arriving.length}</span>}
                    {leaving.length > 0 && <span title="Leaving">↗ {leaving.length}</span>}
                  </span>
                )}
              </div>
              {staying.slice(0, MAX_CHIPS).map((b) => (
                <button
                  key={b.id}
                  className={`stay-chip ${b.checkIn === d ? "starts" : ""} ${b.status}`}
                  style={{ "--chip": accent(b.suite) }}
                  onClick={(e) => {
                    e.stopPropagation();
                    open(b);
                  }}
                  title={`${b.name} · ${b.suiteName || b.suite} · ${fmtDate(b.checkIn)} → ${fmtDate(b.checkOut)} · ${statusLabel(BOOKING_STATUSES, b.status)}`}
                >
                  {b.checkIn === d && "▸ "}
                  {b.name.split(" ")[0]} · {b.suiteName || b.suite}
                </button>
              ))}
              {staying.length > MAX_CHIPS && <span className="month-more">+{staying.length - MAX_CHIPS} more</span>}
            </div>
          );
        })}
      </div>

      <div className="cal-legend">
        <span>▸ Check-in day</span>
        <span>↘ arrivals · ↗ departures</span>
        <span><i className="cal-key" style={{ background: "repeating-linear-gradient(45deg, #b8892f55 0 4px, transparent 4px 8px)" }} /> Pending</span>
        <span className="muted">Chip colour = suite</span>
      </div>

      {day && (
        <Modal title={dayLong(day)} onClose={() => setDay(null)}>
          {(() => {
            const { staying, arriving, leaving } = onDay(day);
            const section = (title, rows, empty) => (
              <>
                <h3 className="form-section">{title}</h3>
                {rows.length ? (
                  <ul className="day-list">
                    {rows.map((b) => (
                      <li key={b.id}>
                        <button onClick={() => open(b)} style={{ "--chip": accent(b.suite) }}>
                          <span className="cal-dot" style={{ background: accent(b.suite) }} />
                          <span className="clip">
                            <strong>{b.name}</strong>
                            <span className="muted small">
                              {" "}· {b.suiteName || b.suite} · {fmtDate(b.checkIn)} → {fmtDate(b.checkOut)} · {formatINR(b.total)}
                            </span>
                          </span>
                          <Badge tone={STATUS_TONE[b.status]}>{statusLabel(BOOKING_STATUSES, b.status)}</Badge>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted small">{empty}</p>
                )}
              </>
            );
            return (
              <>
                {section(`Arriving (${arriving.length})`, arriving, "No arrivals.")}
                {section(`Staying tonight (${staying.length})`, staying, "Nobody staying tonight.")}
                {section(`Leaving (${leaving.length})`, leaving, "No departures.")}
                <div className="row-actions">
                  <button className="btn btn-gold btn-sm" onClick={() => router.push(`/bookings?new=1&checkIn=${day}${suite !== "all" && !suite.startsWith("loc:") ? `&suite=${suite}` : ""}`)}>
                    <Icon name="plus" size={15} /> New booking from this day
                  </button>
                </div>
              </>
            );
          })()}
        </Modal>
      )}
    </>
  );
}
