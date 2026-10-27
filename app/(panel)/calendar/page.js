"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import BlockForm, { blockCovers, blockDates, blockLabel } from "@/components/BlockForm";
import { Badge, DeleteButton, Loading, PageHeader } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { useCollection, useSettings } from "@/lib/api";
import { BOOKING_STATUSES, STATUS_TONE, addDays, byOrder, fmtDate, fullName, holdsRoom, nightsBetween, plural, statusLabel, todayISO } from "@/lib/format";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const monthKey = (d) => d.slice(0, 7);
const monthTitle = (ym) => new Date(ym + "-01T00:00:00").toLocaleDateString("en-IN", { month: "long", year: "numeric" });
const shiftMonth = (ym, n) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
};
const dayTitle = (d) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
const shortDay = (d) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const firstName = (n = "") => n.trim().split(/\s+/)[0];

// The 6-week grid (Monday first) that covers a month
function monthGrid(ym) {
  const first = `${ym}-01`;
  const weekday = (new Date(first + "T00:00:00").getDay() + 6) % 7; // 0 = Monday
  const start = addDays(first, -weekday);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

/**
 * Month calendar with two views:
 * - Bookings: rooms free each night and who checks in, with the picked day's guests beside it
 * - Block dates: tap the first and last night to close them; blocked nights show in red
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
  const [view, setView] = useState("bookings"); // "bookings" | "block"
  const [blocking, setBlocking] = useState(null); // the Block dates form's starting values
  const [ym, setYm] = useState(monthKey(today));
  const [day, setDay] = useState(today);
  const [show, setShow] = useState("all"); // "all", "loc:<id>" or a suite id
  const [sel, setSel] = useState({ from: "", to: "" }); // nights picked to block

  const grid = useMemo(() => monthGrid(ym), [ym]);

  if (!bookings || !suites || !blocks) return <Loading error={error} />;

  const locations = settings?.locations || [];
  const sortedSuites = [...suites].sort(byOrder);
  const suiteOf = (id) => suites.find((s) => s.id === id);
  const locName = (id) => locations.find((l) => l.id === suiteOf(id)?.location)?.name;
  const inView = (s) => show === "all" || (show.startsWith("loc:") ? s?.location === show.slice(4) : s?.id === show);
  const shownSuites = suites.filter((s) => inView(s) && s.active !== false);
  const list = bookings.filter((b) => b.status !== "cancelled" && inView(suiteOf(b.suite)));
  const holding = list.filter(holdsRoom);

  const blocksOn = (d) => blocks.filter((b) => b.from <= d && d <= b.to && shownSuites.some((s) => blockCovers(b, s)));
  // Rooms of one suite closed by blocks on a night (a block closes `rooms` rooms, or all of them)
  const blockedRooms = (s, d) => {
    const inv = s.inventory || 1;
    return Math.min(inv, blocks.filter((b) => b.from <= d && d <= b.to && blockCovers(b, s)).reduce((n, b) => n + (b.rooms || inv), 0));
  };
  const totalRooms = shownSuites.reduce((t, s) => t + (s.inventory || 1), 0);
  // Rooms still free on a night: rooms − bookings − blocked
  const freeOn = (d) =>
    shownSuites.reduce((t, s) => {
      const inv = s.inventory || 1;
      const booked = holding.filter((b) => b.suite === s.id && b.checkIn <= d && d < b.checkOut).length;
      return t + Math.max(inv - booked - blockedRooms(s, d), 0);
    }, 0);
  const level = (free) => (free === 0 ? "full" : free <= Math.max(1, Math.floor(totalRooms * 0.3)) ? "low" : "ok");

  const onDay = (d) => ({
    arriving: list.filter((b) => b.checkIn === d),
    staying: list.filter((b) => b.checkIn < d && d < b.checkOut),
    leaving: list.filter((b) => b.checkOut === d),
  });
  const upcomingBlocks = [...blocks].filter((b) => b.to >= today).sort((a, b) => a.from.localeCompare(b.from));
  const unblock = async (b) => {
    await removeBlock(b.id);
    toast(`Unblocked ${blockDates(b)}.`);
  };
  // Short words for a block inside a day box: "JP Nagar 7th Phase · 5 rooms", "Tulum Suite", "All"
  const blockTag = (b) => {
    let what;
    if (b.suites?.length) what = fullName(suiteOf(b.suites[0])?.name || b.suites[0]) + (b.suites.length > 1 ? ` +${b.suites.length - 1}` : "");
    else if (b.location) what = locations.find((l) => l.id === b.location)?.name || b.location;
    else what = "Everything";
    return b.rooms ? `${what} · ${plural(b.rooms, "room")}` : what;
  };

  const goMonth = (next) => {
    setYm(next);
    setDay(monthKey(today) === next ? today : `${next}-01`);
  };
  const open = (b) => router.push(`/bookings?open=${b.id}`);
  const toPanel = () => {
    // On phones and tablets the panel is below the calendar — bring it into view
    if (window.innerWidth <= 1200) setTimeout(() => document.querySelector(".cal3-panel")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  // Block view: the first tap picks the first night, the second the last night, then the form opens
  const pickNight = (d) => {
    if (d < today) return;
    if (!sel.from || sel.to || d < sel.from) {
      setSel({ from: d, to: "" });
      toPanel();
      return;
    }
    setSel({ from: sel.from, to: d });
    setBlocking({ from: sel.from, to: d, scope: show });
  };
  const inSel = (d) => sel.from && d >= sel.from && d <= (sel.to || sel.from);
  const switchView = (v) => {
    setView(v);
    setSel({ from: "", to: "" });
  };

  const picked = onDay(day);
  const pickedBlocks = blocksOn(day);

  const guestCard = (b) => (
    <li key={b.id}>
      <button className="cal3-guest" onClick={() => open(b)} style={{ "--accent": suiteOf(b.suite)?.accent || "#b8892f" }}>
        <span className="cal3-guest-top">
          <strong>{b.name}</strong>
          <Badge tone={STATUS_TONE[b.status]}>{statusLabel(BOOKING_STATUSES, b.status)}</Badge>
        </span>
        <span className="muted small">
          {fullName(b.suiteName || suiteOf(b.suite)?.name || b.suite)}
          {locName(b.suite) ? ` · ${locName(b.suite)}` : ""}
        </span>
        <span className="small">
          {shortDay(b.checkIn)} → {shortDay(b.checkOut)} ·{" "}
          {plural(nightsBetween(b.checkIn, b.checkOut), "night")} · {plural(Number(b.guests) || 0, "guest")}
        </span>
      </button>
    </li>
  );
  const group = (title, tone, rows, empty) => (
    <div className="cal3-group">
      <h3 className={`cal3-group-title ${tone}`}>{title} <span>{rows.length}</span></h3>
      {rows.length ? <ul className="cal3-guests">{rows.map(guestCard)}</ul> : <p className="muted small">{empty}</p>}
    </div>
  );

  const nightsSel = sel.from ? nightsBetween(sel.from, sel.to || sel.from) + 1 : 0;

  return (
    <>
      <PageHeader title="Calendar" subtitle={view === "block" ? "Close nights so nobody can book them" : "Rooms free each night and who is checking in"}>
        <button className="btn btn-ghost" onClick={() => router.push(`/bookings?new=1&checkIn=${day >= today ? day : today}`)}>
          <Icon name="plus" size={15} /> New booking
        </button>
      </PageHeader>

      <div className="cal3-tabs" role="tablist">
        <button role="tab" aria-selected={view === "bookings"} className={view === "bookings" ? "on" : ""} onClick={() => switchView("bookings")}>
          <Icon name="calendar" size={17} /> Bookings
        </button>
        <button role="tab" aria-selected={view === "block"} className={`blk ${view === "block" ? "on" : ""}`} onClick={() => switchView("block")} disabled={!!blocksError}>
          <Icon name="x" size={17} /> Block dates
          {upcomingBlocks.length > 0 && <span className="cal3-tab-count">{upcomingBlocks.length}</span>}
        </button>
      </div>

      <div className="cal3-bar panel">
        <div className="cal3-month">
          <button className="icon-btn" onClick={() => goMonth(shiftMonth(ym, -1))} aria-label="Previous month">‹</button>
          <strong>{monthTitle(ym)}</strong>
          <button className="icon-btn" onClick={() => goMonth(shiftMonth(ym, 1))} aria-label="Next month">›</button>
          <button className="btn btn-ghost btn-sm" onClick={() => goMonth(monthKey(today))}>Today</button>
        </div>
        <select value={show} onChange={(e) => setShow(e.target.value)} className="select-sm cal3-show" aria-label="Which suites to show">
          <option value="all">All properties</option>
          <optgroup label="Property">
            {locations.map((l) => <option key={l.id} value={`loc:${l.id}`}>{l.name}</option>)}
          </optgroup>
          <optgroup label="One suite / flat">
            {sortedSuites.map((s) => (
              <option key={s.id} value={s.id}>{fullName(s.name)}{locations.length > 1 ? ` — ${locations.find((l) => l.id === s.location)?.name || ""}` : ""}</option>
            ))}
          </optgroup>
        </select>
      </div>

      {view === "block" && (
        <p className="cal3-hint">
          <Icon name="x" size={15} />
          {!sel.from
            ? "Tap the first night you want to close, then the last night."
            : !sel.to
              ? `First night: ${shortDay(sel.from)}. Now tap the last night (or the same day for one night).`
              : `${shortDay(sel.from)} → ${shortDay(sel.to)} picked.`}
        </p>
      )}

      <div className="cal3">
        <div className={`panel cal3-grid ${view === "block" ? "mode-block" : ""}`}>
          {WEEKDAYS.map((w) => (
            <div key={w} className="cal3-head">{w}</div>
          ))}
          {grid.map((d) => {
            const outside = monthKey(d) !== ym;
            const dayBlocks = blocksOn(d);
            const past = d < today;
            const cls = ["cal3-day", outside && "outside", past && "past", d === today && "is-today", dayBlocks.length && "blocked"];

            if (view === "block") {
              return (
                <button
                  type="button"
                  key={d}
                  className={[...cls, inSel(d) && "is-sel", d === sel.from && "sel-start", d === (sel.to || sel.from) && "sel-end"].filter(Boolean).join(" ")}
                  onClick={() => pickNight(d)}
                  disabled={past}
                  aria-label={`${dayTitle(d)}${dayBlocks.length ? ", blocked" : ""}`}
                >
                  <span className="cal3-num">{Number(d.slice(8))}</span>
                  <span className="cal3-tags">
                    {dayBlocks.slice(0, 2).map((b) => <span key={b.id} className="cal3-blk-tag">{blockTag(b)}</span>)}
                    {dayBlocks.length > 2 && <span className="cal3-more">+{dayBlocks.length - 2} more</span>}
                  </span>
                </button>
              );
            }

            const free = freeOn(d);
            const { arriving } = onDay(d);
            return (
              <button
                type="button"
                key={d}
                className={[...cls, d === day && "is-picked"].filter(Boolean).join(" ")}
                onClick={() => {
                  setDay(d);
                  if (outside) setYm(monthKey(d));
                  toPanel();
                }}
                aria-label={`${dayTitle(d)}: ${free} of ${totalRooms} rooms free, ${arriving.length} checking in${dayBlocks.length ? ", some rooms blocked" : ""}`}
                aria-pressed={d === day}
              >
                <span className="cal3-top">
                  <span className="cal3-num">{Number(d.slice(8))}</span>
                  {dayBlocks.length > 0 && <span className="cal3-blk-dot" title="Some rooms blocked">Blocked</span>}
                </span>
                {!past && totalRooms > 0 && (
                  <span className={`cal3-free ${level(free)}`}>
                    <span className="cal3-meter"><i style={{ width: `${((totalRooms - free) / totalRooms) * 100}%` }} /></span>
                    <span className="cal3-free-text">{free === 0 ? "Full" : <><b>{free}</b><em> free</em></>}</span>
                  </span>
                )}
                {arriving.length > 0 && (
                  <span className="cal3-arrivals">
                    {arriving.slice(0, 2).map((b) => (
                      <span key={b.id} className="cal3-arr" style={{ "--accent": suiteOf(b.suite)?.accent || "#b8892f" }}>{firstName(b.name)}</span>
                    ))}
                    {arriving.length > 2 && <span className="cal3-more">+{arriving.length - 2} more</span>}
                    <span className="cal3-arr-count">{arriving.length} in</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {view === "bookings" ? (
          <aside className="panel cal3-panel">
            <p className="eyebrow">{day === today ? "Today" : day < today ? "Past day" : "Upcoming"}</p>
            <h2 className="cal3-title">{dayTitle(day)}</h2>
            <div className="cal3-stats">
              <div className={`free ${level(freeOn(day))}`}><strong>{freeOn(day)}<small>/{totalRooms}</small></strong><span>Rooms free</span></div>
              <div className="in"><strong>{picked.arriving.length}</strong><span>Check-ins</span></div>
              <div className="out"><strong>{picked.leaving.length}</strong><span>Check-outs</span></div>
            </div>

            {pickedBlocks.map((b) => (
              <div key={b.id} className="cal3-blocked">
                <span>
                  <strong>Blocked</strong> · {blockLabel(b, suites, locations)}
                  <span className="muted small"> · {blockDates(b)}{b.reason ? ` · ${b.reason}` : ""}</span>
                </span>
                <DeleteButton small label="Unblock" onConfirm={() => unblock(b)} />
              </div>
            ))}

            {group("Checking in", "in", picked.arriving, "No check-ins.")}
            {group("Checking out", "out", picked.leaving, "No check-outs.")}
            {group("In the house", "stay", picked.staying, "Nobody else staying.")}

            <div className="cal3-actions">
              {day >= today && (
                <button className="btn btn-gold btn-sm" onClick={() => router.push(`/bookings?new=1&checkIn=${day}${show !== "all" && !show.startsWith("loc:") ? `&suite=${show}` : ""}`)}>
                  <Icon name="plus" size={15} /> Book this day
                </button>
              )}
              {day >= today && (
                <button className="btn btn-ghost btn-sm" onClick={() => setBlocking({ from: day, to: day, scope: show })} disabled={!!blocksError}>
                  <Icon name="x" size={15} /> Block this day
                </button>
              )}
            </div>
          </aside>
        ) : (
          <aside className="panel cal3-panel">
            <p className="eyebrow">Block dates</p>
            <ol className="cal3-steps">
              <li className={sel.from ? "done" : "now"}><span>1</span> First night{sel.from && <b>{shortDay(sel.from)}</b>}</li>
              <li className={sel.to ? "done" : sel.from ? "now" : ""}><span>2</span> Last night{sel.to && <b>{shortDay(sel.to)}</b>}</li>
              <li className={sel.to ? "now" : ""}><span>3</span> Choose rooms &amp; save</li>
            </ol>
            {sel.from && (
              <div className="cal3-actions">
                <button className="btn btn-gold btn-sm cal3-btn-blk" onClick={() => setBlocking({ from: sel.from, to: sel.to || sel.from, scope: show })}>
                  Block {plural(nightsSel, "night")}…
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setSel({ from: "", to: "" })}>Clear</button>
              </div>
            )}

            <h3 className="cal3-group-title blk">Blocked dates <span>{upcomingBlocks.length}</span></h3>
            {upcomingBlocks.length ? (
              <ul className="cal3-block-list">
                {upcomingBlocks.map((b) => (
                  <li key={b.id}>
                    <button type="button" className="cal3-block-when" onClick={() => setYm(monthKey(b.from))} title="Show on the calendar">
                      <strong>{blockDates(b)}</strong>
                      <span className="muted small">{blockLabel(b, suites, locations)}{b.reason ? ` · ${b.reason}` : ""}</span>
                    </button>
                    <DeleteButton small label="Unblock" onConfirm={() => unblock(b)} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small">Nothing blocked. Blocked nights can&apos;t be booked on the website or here.</p>
            )}
          </aside>
        )}
      </div>

      {view === "bookings" && (
        <div className="cal3-legend">
          <span><i className="ok" /> Plenty free</span>
          <span><i className="low" /> Few rooms left</span>
          <span><i className="full" /> Full</span>
          <span><i className="arr" /> Name = guest checking in</span>
          <span><i className="blk" /> Some rooms blocked</span>
        </div>
      )}

      {blocking && (
        <BlockForm
          initial={blocking}
          suites={suites}
          locations={locations}
          onClose={() => setBlocking(null)}
          onSave={async (data) => {
            const saved = await saveBlock(data);
            setBlocking(null);
            setSel({ from: "", to: "" });
            toast(`Blocked ${blockDates(saved)} · ${blockLabel(saved, suites, locations)}.`);
          }}
        />
      )}
    </>
  );
}
