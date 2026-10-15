"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { Loading, PageHeader } from "@/components/ui";
import { useCollection } from "@/lib/api";
import { HOLDING, addDays, byOrder, todayISO } from "@/lib/format";

const DAYS = 14;
const label = (d) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric" });
const month = (d) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { month: "long", year: "numeric" });

// Rooms taken per suite per night, for the next two weeks
export default function Availability() {
  const router = useRouter();
  const { items: bookings, error } = useCollection("bookings");
  const { items: suites } = useCollection("suites");
  const [start, setStart] = useState(todayISO());

  const days = useMemo(() => Array.from({ length: DAYS }, (_, i) => addDays(start, i)), [start]);

  if (!bookings || !suites) return <Loading error={error} />;

  const holding = bookings.filter((b) => HOLDING.includes(b.status));
  const stays = (suiteId, d) => holding.filter((b) => b.suite === suiteId && b.checkIn <= d && d < b.checkOut);
  const today = todayISO();

  return (
    <>
      <PageHeader title="Availability" subtitle="Rooms taken per night — pending, confirmed and checked-in stays hold a room">
        <div className="range-nav">
          <button className="icon-btn" onClick={() => setStart(addDays(start, -DAYS))} aria-label="Previous two weeks">‹</button>
          <input type="date" value={start} onChange={(e) => e.target.value && setStart(e.target.value)} />
          <button className="icon-btn" onClick={() => setStart(addDays(start, DAYS))} aria-label="Next two weeks">›</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setStart(today)}>Today</button>
        </div>
      </PageHeader>

      <div className="panel table-wrap">
        <table className="cal">
          <thead>
            <tr>
              <th className="cal-suite">{month(start)}</th>
              {days.map((d) => (
                <th key={d} className={d === today ? "is-today" : ""}>{label(d)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...suites].sort(byOrder).map((s) => {
              const inv = s.inventory || 1;
              return (
                <tr key={s.id}>
                  <th className="cal-suite">
                    <span className="cal-dot" style={{ background: s.accent }} />
                    {s.name}
                    <span className="muted small"> · {inv} room{inv > 1 ? "s" : ""}</span>
                  </th>
                  {days.map((d) => {
                    const here = stays(s.id, d);
                    const taken = here.length;
                    const state = taken === 0 ? "free" : taken >= inv ? "full" : "part";
                    const first = here[0];
                    return (
                      <td key={d} className={`cal-cell ${state} ${d === today ? "is-today" : ""}`}>
                        <button
                          title={here.length ? here.map((b) => `${b.name} (${b.ref}) · ${b.status}`).join("\n") : "Free — click to book"}
                          onClick={() =>
                            router.push(
                              first && state === "full" ? `/bookings?open=${first.id}` : `/bookings?new=1&suite=${s.id}&checkIn=${d}`,
                            )
                          }
                        >
                          {taken === 0 ? "" : inv > 1 ? `${taken}/${inv}` : first.status === "pending" ? "Req" : first.name.split(" ")[0]}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="cal-legend">
        <span><i className="cal-key free" /> Free — click to book</span>
        <span><i className="cal-key part" /> Some rooms taken</span>
        <span><i className="cal-key full" /> Full — click to open the booking</span>
        <span className="muted"><Icon name="bed" size={14} /> Set how many rooms each suite has under Suites → Rooms of this type</span>
      </div>
    </>
  );
}
