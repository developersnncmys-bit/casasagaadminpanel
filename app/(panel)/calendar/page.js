"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import BlockForm, { blockCovers, blockDates, blockLabel } from "@/components/BlockForm";
import { Badge, DeleteButton, Loading, PageHeader } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { useCollection, useSettings } from "@/lib/api";
import { BOOKING_STATUSES, STATUS_TONE, addDays, byOrder, fmtDate, formatINR, fullName, nightsBetween, plural, statusLabel, todayISO } from "@/lib/format";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const monthKey = (d) => d.slice(0, 7);
const monthTitle = (ym) => new Date(ym + "-01T00:00:00").toLocaleDateString("en-IN", { month: "long", year: "numeric" });
const shiftMonth = (ym, n) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
};
const dayTitle = (d) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

// The 6-week grid (Monday first) that covers a month
function monthGrid(ym) {
  const first = `${ym}-01`;
  const weekday = (new Date(first + "T00:00:00").getDay() + 6) % 7; // 0 = Monday
  const start = addDays(first, -weekday);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

/**
 * Month calendar of bookings. Each day says in plain words how many guests arrive, stay and leave;
 * the panel beside it lists them for the day picked (today to start).
 */
export default function Calendar() {
  const router = useRouter();
  const { items: bookings, error } = useCollection("bookings");
  const { items: suites } = useCollection("suites");
  const { settings } = useSettings();
  const { items: loadedBlocks, error: blocksError, save: saveBlock, remove: removeBlock } = useCollection("blocks");
  // If blocked dates can't be loaded (e.g. an older server), the calendar still opens without them
  const blocks = loadedBlocks || (blocksError ? [] : null);
  const toast = useToast();
  const today = todayISO();
  const [blocking, setBlocking] = useState(null); // the Block dates form's starting values
  const [ym, setYm] = useState(monthKey(today));
  const [day, setDay] = useState(today);
  const [show, setShow] = useState("all"); // "all", "loc:<id>" or a suite id
  const [showCancelled, setShowCancelled] = useState(false);

  const grid = useMemo(() => monthGrid(ym), [ym]);

  if (!bookings || !suites || !blocks) return <Loading error={error} />;

  const locations = settings?.locations || [];
  const sortedSuites = [...suites].sort(byOrder);
  const suiteOf = (id) => suites.find((s) => s.id === id);
  const locName = (id) => locations.find((l) => l.id === suiteOf(id)?.location)?.name;
  const inView = (s) => show === "all" || (show.startsWith("loc:") ? s?.location === show.slice(4) : s?.id === show);
  const list = bookings.filter((b) => (showCancelled || b.status !== "cancelled") && inView(suiteOf(b.suite)));

  // For a day: who arrives, who is staying that night, who leaves
  const onDay = (d) => ({
    arriving: list.filter((b) => b.checkIn === d),
    staying: list.filter((b) => b.checkIn <= d && d < b.checkOut),
    leaving: list.filter((b) => b.checkOut === d),
  });
  const shownSuites = suites.filter(inView);
  const blocksOn = (d) => blocks.filter((b) => b.from <= d && d <= b.to && shownSuites.some((s) => blockCovers(b, s)));
  const upcomingBlocks = [...blocks].filter((b) => b.to >= today).sort((a, b) => a.from.localeCompare(b.from));
  const unblock = async (b) => {
    await removeBlock(b.id);
    toast(`Unblocked ${blockDates(b)}.`);
  };

  const goMonth = (next) => {
    setYm(next);
    // Keep a day of that month picked: today when it's there, else the 1st
    setDay(monthKey(today) === next ? today : `${next}-01`);
  };
  const open = (b) => router.push(`/bookings?open=${b.id}`);
  const picked = onDay(day);
  const pickedBlocks = blocksOn(day);

  const guestCard = (b, tag) => (
    <li key={`${tag}-${b.id}`}>
      <button className="cal2-guest" onClick={() => open(b)} style={{ "--accent": suiteOf(b.suite)?.accent || "#b8892f" }}>
        <span className="cal2-guest-top">
          <strong>{b.name}</strong>
          <Badge tone={STATUS_TONE[b.status]}>{statusLabel(BOOKING_STATUSES, b.status)}</Badge>
        </span>
        <span className="muted small">
          {fullName(b.suiteName || suiteOf(b.suite)?.name || b.suite)}
          {locName(b.suite) ? ` · ${locName(b.suite)}` : ""}
        </span>
        <span className="small">
          {fmtDate(b.checkIn)} → {fmtDate(b.checkOut)} · {plural(nightsBetween(b.checkIn, b.checkOut), "night")} · {plural(Number(b.guests) || 0, "guest")} ·{" "}
          {formatINR(b.total)}
        </span>
      </button>
    </li>
  );
  const section = (title, tone, rows, empty) => (
    <div className="cal2-sec">
      <h3 className={`cal2-sec-title ${tone}`}>
        {title} <span>{rows.length}</span>
      </h3>
      {rows.length ? <ul className="cal2-guests">{rows.map((b) => guestCard(b, tone))}</ul> : <p className="muted small">{empty}</p>}
    </div>
  );

  return (
    <>
      <PageHeader title="Calendar" subtitle="Pick a day to see who is arriving, staying and leaving">
        <button className="btn btn-gold" onClick={() => setBlocking({ scope: show })} disabled={!!blocksError} title={blocksError ? "Blocked dates aren't available on the server yet" : undefined}>
          <Icon name="x" size={15} /> Block dates
        </button>
      </PageHeader>

      <div className="cal2-bar panel">
        <div className="cal2-month">
          <button className="icon-btn" onClick={() => goMonth(shiftMonth(ym, -1))} aria-label="Previous month">‹</button>
          <strong>{monthTitle(ym)}</strong>
          <button className="icon-btn" onClick={() => goMonth(shiftMonth(ym, 1))} aria-label="Next month">›</button>
          <button className="btn btn-ghost btn-sm" onClick={() => goMonth(monthKey(today))}>Today</button>
        </div>
        <label className="cal2-show">
          <span className="muted small">Show</span>
          <select value={show} onChange={(e) => setShow(e.target.value)} className="select-sm">
            <option value="all">All suites &amp; flats</option>
            <optgroup label="Location">
              {locations.map((l) => <option key={l.id} value={`loc:${l.id}`}>{l.name}</option>)}
            </optgroup>
            <optgroup label="Suite / flat">
              {sortedSuites.map((s) => (
                <option key={s.id} value={s.id}>{fullName(s.name)}{locations.length > 1 ? ` — ${locations.find((l) => l.id === s.location)?.name || ""}` : ""}</option>
              ))}
            </optgroup>
          </select>
        </label>
        <label className="settle">
          <input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} />
          Show cancelled
        </label>
      </div>

      <div className="cal2">
        <div className="cal2-left">
          <div className="panel cal2-grid">
            {WEEKDAYS.map((w) => (
              <div key={w} className="cal2-head">{w}</div>
            ))}
            {grid.map((d) => {
              const { arriving, staying, leaving } = onDay(d);
              const closed = blocksOn(d).length > 0;
              const outside = monthKey(d) !== ym;
              return (
                <button
                  type="button"
                  key={d}
                  className={`cal2-day ${outside ? "outside" : ""} ${d === today ? "is-today" : ""} ${d === day ? "is-picked" : ""} ${closed ? "blocked" : ""}`}
                  onClick={() => {
                    setDay(d);
                    if (outside) setYm(monthKey(d));
                    // On phones and tablets the day's guests are below the calendar — bring them into view
                    if (window.innerWidth <= 1200) setTimeout(() => document.querySelector(".cal2-day-panel")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
                  }}
                  aria-label={`${dayTitle(d)}: ${arriving.length} arriving, ${staying.length} staying, ${leaving.length} leaving${closed ? ", blocked" : ""}`}
                  aria-pressed={d === day}
                >
                  <span className="cal2-num">{Number(d.slice(8))}</span>
                  <span className="cal2-lines">
                    {arriving.length > 0 && <span className="cal2-line in"><i />{arriving.length}<em> arriving</em></span>}
                    {staying.length > 0 && <span className="cal2-line stay"><i />{staying.length}<em> staying</em></span>}
                    {leaving.length > 0 && <span className="cal2-line out"><i />{leaving.length}<em> leaving</em></span>}
                    {closed && <span className="cal2-line blk"><i /><em>Blocked</em></span>}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="cal2-legend">
            <span><i className="in" /> Arriving (check-in)</span>
            <span><i className="stay" /> Staying that night</span>
            <span><i className="out" /> Leaving (check-out)</span>
            <span><i className="blk" /> Blocked — not bookable</span>
          </div>
        </div>

        <aside className="panel cal2-day-panel">
          <p className="eyebrow">{day === today ? "Today" : day < today ? "Past day" : "Upcoming day"}</p>
          <h2 className="cal2-day-title">{dayTitle(day)}</h2>
          <div className="cal2-counts">
            <div className="in"><strong>{picked.arriving.length}</strong><span>Arriving</span></div>
            <div className="stay"><strong>{picked.staying.length}</strong><span>Staying tonight</span></div>
            <div className="out"><strong>{picked.leaving.length}</strong><span>Leaving</span></div>
          </div>

          {pickedBlocks.map((b) => (
            <div key={b.id} className="cal2-blocked">
              <span>
                <strong>Blocked</strong> · {blockLabel(b, suites, locations)}
                <span className="muted small"> · {blockDates(b)}{b.reason ? ` · ${b.reason}` : ""}</span>
              </span>
              <DeleteButton small label="Unblock" onConfirm={() => unblock(b)} />
            </div>
          ))}

          {section("Arriving", "in", picked.arriving, "No check-ins.")}
          {section("Already staying", "stay", picked.staying.filter((b) => b.checkIn !== day), "No one else staying tonight.")}
          {section("Leaving", "out", picked.leaving, "No check-outs.")}

          <div className="cal2-actions">
            <button className="btn btn-gold btn-sm" onClick={() => router.push(`/bookings?new=1&checkIn=${day}${show !== "all" && !show.startsWith("loc:") ? `&suite=${show}` : ""}`)}>
              <Icon name="plus" size={15} /> New booking
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setBlocking({ from: day, to: day, scope: show })} disabled={!!blocksError}>
              <Icon name="x" size={15} /> Block this day
            </button>
          </div>
        </aside>
      </div>

      <section className="panel pad blocks-panel">
        <h2 className="panel-title">Blocked dates</h2>
        <p className="muted small">Nights closed to bookings on the website and here.</p>
        {upcomingBlocks.length ? (
          <ul className="block-list">
            {upcomingBlocks.map((b) => (
              <li key={b.id}>
                <span className="clip">
                  <strong>{blockDates(b)}</strong>
                  <span className="muted small"> · {blockLabel(b, suites, locations)}{b.reason ? ` · ${b.reason}` : ""}</span>
                </span>
                <DeleteButton small label="Unblock" onConfirm={() => unblock(b)} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted small">No dates blocked.</p>
        )}
      </section>

      {blocking && (
        <BlockForm
          initial={blocking}
          suites={suites}
          locations={locations}
          onClose={() => setBlocking(null)}
          onSave={async (data) => {
            const saved = await saveBlock(data);
            setBlocking(null);
            toast(`Blocked ${blockDates(saved)} · ${blockLabel(saved, suites, locations)}.`);
          }}
        />
      )}
    </>
  );
}
