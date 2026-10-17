"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import { Badge, Loading, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";
import { BOOKING_STATUSES, EARNING, SOURCE_INFO, STATUS_TONE, sourceLabel, fmtDate, fmtDateTime, formatINR, fullName, imgSrc, nightsBetween, statusLabel, todayISO, unpaidExpired } from "@/lib/format";


export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const names = ["bookings", "suites", "addons", "gallery"];
    Promise.all(names.map((n) => api(`/api/${n}`)))
      .then((r) => setData(Object.fromEntries(names.map((n, i) => [n, r[i]]))))
      .catch((e) => setError(e.message));
  }, []);

  if (!data) return <Loading error={error} />;

  const { bookings, suites, addons, gallery } = data;
  const today = todayISO();
  const month = today.slice(0, 7);
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const suiteName = (id) => suites.find((s) => s.id === id)?.name || id;

  const earning = bookings.filter((b) => EARNING.includes(b.status));
  const stats = [
    { label: "Pending requests", value: bookings.filter((b) => b.status === "pending" && !unpaidExpired(b)).length, icon: "calendar", href: "/bookings?status=pending" },
    {
      label: "Revenue this month",
      value: formatINR(earning.filter((b) => (b.checkIn || "").startsWith(month)).reduce((t, b) => t + (b.total || 0), 0)),
      icon: "rupee",
      href: "/bookings",
    },
    {
      label: "Nights booked this month",
      value: earning.filter((b) => (b.checkIn || "").startsWith(month)).reduce((t, b) => t + nightsBetween(b.checkIn, b.checkOut), 0),
      icon: "bed",
      href: "/bookings",
    },
  ];

  const upcoming = bookings
    .filter((b) => ["pending", "confirmed"].includes(b.status) && b.checkIn >= today && b.checkIn <= in7)
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  const inHouse = bookings.filter((b) => b.status === "checked-in");
  const recent = [...bookings].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")).slice(0, 6);

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Bookings, guests and website at a glance" />

      <section className="stats">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="stat">
            <span className="stat-icon">
              <Icon name={s.icon} />
            </span>
            <span className="stat-value">{s.value}</span>
            <span className="stat-label">{s.label}</span>
          </Link>
        ))}
      </section>

      <div>
        <section className="panel">
          <div className="panel-head">
            <h2>Arriving in the next 7 days</h2>
            <Link href="/bookings" className="link">All bookings</Link>
          </div>
          {upcoming.length || inHouse.length ? (
            <ul className="rows">
              {inHouse.map((b) => (
                <li key={b.id} className="row">
                  <div>
                    <strong>{b.name}</strong>
                    <span className="muted"> · {fullName(suiteName(b.suite))}</span>
                    <div className="muted small">In house until {fmtDate(b.checkOut)}</div>
                  </div>
                  <Badge tone="info">Checked in</Badge>
                </li>
              ))}
              {upcoming.map((b) => (
                <li key={b.id} className="row">
                  <div>
                    <strong>{b.name}</strong>
                    <span className="muted"> · {fullName(suiteName(b.suite))}</span>
                    <div className="muted small">
                      {b.checkIn === today ? "Today" : fmtDate(b.checkIn)} → {fmtDate(b.checkOut)} · {b.guests} guests
                    </div>
                  </div>
                  <Badge tone={STATUS_TONE[b.status]}>{statusLabel(BOOKING_STATUSES, b.status)}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted pad">No arrivals in the next week.</p>
          )}
        </section>

        
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2>Recent booking requests</h2>
        </div>
        {recent.length ? (
          <div className="table-wrap">
            <table className="table table-cards">
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
                {recent.map((b) => (
                  <tr key={b.id}>
                    <td className="mono">{b.ref}</td>
                    <td>{b.name}</td>
                    <td>{suiteName(b.suite)}</td>
                    <td>
                      {fmtDate(b.checkIn)} → {fmtDate(b.checkOut)}
                    </td>
                    <td>{formatINR(b.total)}</td>
                    <td>
                      <Badge tone={STATUS_TONE[b.status]}>{statusLabel(BOOKING_STATUSES, b.status)}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted pad">
            No bookings yet. Requests from the website&apos;s booking form appear here, or add one from{" "}
            <Link href="/bookings?new=1" className="link">Bookings</Link>.
          </p>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Where bookings come from</h2>
          <span className="muted small">All bookings except cancelled</span>
        </div>
        {(() => {
          const live = bookings.filter((b) => b.status !== "cancelled");
          const rows = Object.entries(
            live.reduce((acc, b) => {
              const k = b.source || "website";
              acc[k] = acc[k] || { count: 0, revenue: 0 };
              acc[k].count += 1;
              acc[k].revenue += b.total || 0;
              return acc;
            }, {}),
          ).sort((a, b) => b[1].count - a[1].count);
          const max = Math.max(1, ...rows.map(([, r]) => r.count));
          return rows.length ? (
            <div className="source-bars">
              {rows.map(([src, r]) => (
                <div key={src} className="source-bar" style={{ "--src": (SOURCE_INFO[src] || SOURCE_INFO.other).color }}>
                  <Link href={`/bookings?source=${src}`}>{sourceLabel(src)}</Link>
                  <div className="source-track"><div className="source-fill" style={{ width: `${(r.count / max) * 100}%` }} /></div>
                  <span className="muted small">{r.count} booking{r.count > 1 ? "s" : ""} · {formatINR(r.revenue)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted pad">No bookings yet.</p>
          );
        })()}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Suites on the website</h2>
          <Link href="/suites" className="link">Manage suites</Link>
        </div>
        <div className="suite-strip">
          {suites.map((s) => (
            <Link key={s.id} href={`/suites/${s.id}`} className="suite-mini">
              <img src={imgSrc(s.img)} alt="" />
              <div>
                <strong>{s.name}</strong>
                <span className="muted small">{formatINR(s.price)}/night</span>
                <span className="muted small">{bookings.filter((b) => b.suite === s.id && b.status !== "cancelled").length} bookings</span>
              </div>
              {s.active === false && <Badge tone="bad">Hidden</Badge>}
            </Link>
          ))}
        </div>
        <div className="content-counts">
          <Link href="/addons">{addons.length} add-ons</Link>
          <Link href="/gallery">{gallery.length} gallery photos</Link>
        </div>
      </section>
    </>
  );
}
