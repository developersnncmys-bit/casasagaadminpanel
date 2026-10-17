"use client";
import { useEffect, useState } from "react";

/**
 * Splits a list into pages. `resetOn` (e.g. the filters) jumps back to page 1 when it changes.
 * Returns the rows to show plus what <Pagination> needs.
 */
export function usePaged(rows, { perPage: initialPerPage = 10, resetOn = [] } = {}) {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(initialPerPage);
  const pages = Math.max(1, Math.ceil(rows.length / perPage));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setPage(1), [perPage, ...resetOn]);
  // Deleting the last row of the last page shouldn't leave an empty page
  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages]);
  const start = (Math.min(page, pages) - 1) * perPage;
  return {
    rows: rows.slice(start, start + perPage),
    pager: { page: Math.min(page, pages), pages, perPage, total: rows.length, start, setPage, setPerPage },
  };
}

// 1 … 4 5 6 … 12 — the first, last and two either side of the current page
const pageList = (page, pages) => {
  const keep = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages));
  const out = [];
  [...keep].sort((a, b) => a - b).forEach((p, i, all) => {
    if (i && p - all[i - 1] > 1) out.push("…" + p);
    out.push(p);
  });
  return out;
};

/** "Showing 11–20 of 57" · rows per page · page buttons. Hidden when everything fits on one page of 10. */
export default function Pagination({ pager, sizes = [10, 25, 50, 100], label = "bookings" }) {
  const { page, pages, perPage, total, start, setPage, setPerPage } = pager;
  if (total <= sizes[0]) return null;
  const go = (p) => {
    setPage(p);
    document.querySelector(".content")?.scrollIntoView({ block: "start", behavior: "smooth" });
  };
  return (
    <nav className="pager" aria-label="Pages">
      <span className="muted small pager-count">
        Showing {start + 1}–{Math.min(start + perPage, total)} of {total} {label}
      </span>
      <label className="pager-size muted small">
        Per page
        <select value={perPage} onChange={(e) => setPerPage(Number(e.target.value))} className="select-sm">
          {sizes.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <div className="pager-pages">
        <button type="button" className="pager-btn" onClick={() => go(page - 1)} disabled={page <= 1} aria-label="Previous page">‹</button>
        {pageList(page, pages).map((p) =>
          typeof p === "string" ? (
            <span key={p} className="pager-gap">…</span>
          ) : (
            <button type="button" key={p} className={`pager-btn ${p === page ? "on" : ""}`} onClick={() => go(p)} aria-current={p === page ? "page" : undefined}>
              {p}
            </button>
          ),
        )}
        <button type="button" className="pager-btn" onClick={() => go(page + 1)} disabled={page >= pages} aria-label="Next page">›</button>
      </div>
    </nav>
  );
}
