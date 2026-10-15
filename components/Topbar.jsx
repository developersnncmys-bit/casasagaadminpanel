"use client";
import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import { useAdmin } from "./AuthGuard";
import { setToken } from "@/lib/api";
import { SITE_URL, fmtDateTime } from "@/lib/format";

function Clock() {
  const [now, setNow] = useState(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!now) return null;
  return (
    <div className="clock" aria-label="Current date and time">
      <Icon name="calendar" size={16} />
      <span className="clock-date">{now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
      <span className="clock-sep" />
      <span className="clock-time">{now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}</span>
    </div>
  );
}

const initials = (name, email) =>
  (name && name !== "Admin" ? name : email || "A")
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

function Profile() {
  const admin = useAdmin();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close when clicking elsewhere or pressing Escape
  useEffect(() => {
    if (!open) return;
    const away = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const signOut = () => {
    setToken(null);
    window.location.href = "/login";
  };

  return (
    <div className="profile" ref={ref}>
      <button className="profile-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu">
        <span className="avatar">{initials(admin.name, admin.email)}</span>
        <span className="profile-text">
          <strong>{admin.name || "Admin"}</strong>
          <span>Administrator</span>
        </span>
        <Icon name="down" size={15} />
      </button>
      {open && (
        <div className="profile-menu" role="menu">
          <div className="profile-head">
            <span className="avatar avatar-lg">{initials(admin.name, admin.email)}</span>
            <div className="clip">
              <strong className="ellipsis">{admin.name || "Admin"}</strong>
              <span className="muted small ellipsis">{admin.email}</span>
            </div>
          </div>
          {admin.lastLoginAt && <p className="muted small profile-meta">Signed in {fmtDateTime(admin.lastLoginAt)}</p>}
          <a role="menuitem" href={SITE_URL} target="_blank" rel="noopener noreferrer" className="profile-item">
            <Icon name="globe" size={16} /> View website
          </a>
          <button role="menuitem" className="profile-item danger" onClick={signOut}>
            <Icon name="logout" size={16} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

// Header across the top of every panel page
export default function Topbar() {
  return (
    <header className="topbar">
      <Clock />
      <span className="spacer" />
      <Profile />
    </header>
  );
}
