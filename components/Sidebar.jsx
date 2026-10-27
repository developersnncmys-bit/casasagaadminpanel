"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "./Icon";
import { api, setToken } from "@/lib/api";
import { SITE_URL, awaitingPayment } from "@/lib/format";

const NAV = [
  { group: "Overview", items: [{ href: "/", label: "Dashboard", icon: "dashboard" }] },
  {
    group: "Guests",
    items: [
      { href: "/bookings", label: "Bookings", icon: "calendar", count: "bookings" },
      { href: "/availability", label: "Availability", icon: "grid" },
      { href: "/calendar", label: "Calendar", icon: "month" },
    ],
  },
  {
    group: "Website content",
    items: [
      { href: "/suites", label: "Suites", icon: "bed" },
      { href: "/addons", label: "Add-ons", icon: "sparkles" },
      { href: "/gallery", label: "Gallery", icon: "image" },
      { href: "/settings", label: "Contact & policies", icon: "settings" },
    ],
  },
];

export default function Sidebar() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState({});

  // Badge: pending booking requests
  useEffect(() => {
    setOpen(false);
    api("/api/bookings")
      .then((b) => setCounts({ bookings: b.filter((x) => x.status === "pending" && !awaitingPayment(x)).length }))
      .catch(() => {});
  }, [path]);

  const logout = () => {
    setToken(null);
    window.location.href = "/login";
  };

  const active = (href) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <>
      <div className="mobile-bar">
        <button type="button" className="icon-btn" onClick={() => setOpen(true)} aria-label="Open menu">
          <Icon name="menu" />
        </button>
        <img src="/logo.png" alt="CasaSaga" className="logo logo-sm" />
      </div>
      {open && <div className="sidebar-scrim" onClick={() => setOpen(false)} />}
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="sidebar-brand">
          <img src="/logo.png" alt="CasaSaga" className="logo" />
          <span className="eyebrow">Admin panel</span>
        </div>
        <nav>
          {NAV.map((g) => (
            <div key={g.group} className="nav-group">
              <p className="nav-title">{g.group}</p>
              {g.items.map((it) => (
                <Link key={it.href} href={it.href} className={`nav-link ${active(it.href) ? "active" : ""}`}>
                  <Icon name={it.icon} />
                  <span>{it.label}</span>
                  {it.count && counts[it.count] > 0 && <span className="nav-count">{counts[it.count]}</span>}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          <a href={SITE_URL} target="_blank" rel="noopener noreferrer" className="nav-link">
            <Icon name="globe" />
            <span>View website</span>
          </a>
          <button type="button" className="nav-link" onClick={logout}>
            <Icon name="logout" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
