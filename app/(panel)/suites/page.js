"use client";
import Link from "next/link";
import Icon from "@/components/Icon";
import { Badge, Loading, PageHeader } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { useCollection, useSettings } from "@/lib/api";
import { SITE_URL, byOrder, formatINR, imgSrc } from "@/lib/format";

export default function Suites() {
  const toast = useToast();
  const { items, error, save, swap } = useCollection("suites");
  const { settings } = useSettings();
  const locName = (id) => settings?.locations?.find((l) => l.id === id)?.name || id;
  if (!items) return <Loading error={error} />;
  const list = [...items].sort(byOrder);

  const toggle = async (s) => {
    try {
      await save({ ...s, active: s.active === false });
      toast(s.active === false ? `${s.name} is visible on the website.` : `${s.name} is hidden from the website.`);
    } catch (e) {
      toast(e.message, "error");
    }
  };

  return (
    <>
      <PageHeader title="Suites" subtitle="Rooms, prices, amenities and photos shown on the website">
        <Link href="/suites/new" className="btn btn-gold">
          <Icon name="plus" size={16} /> Add suite
        </Link>
      </PageHeader>

      <div className="suite-grid">
        {list.map((s, i) => (
          <article key={s.id} className={`suite-card ${s.active === false ? "is-hidden" : ""}`}>
            <div className="suite-card-img">
              <img src={imgSrc(s.img)} alt={s.name} />
              {s.tag && <span className="chip">{s.tag}</span>}
              <span className="suite-accent" style={{ background: s.accent }} />
            </div>
            <div className="suite-card-body">
              <div className="suite-card-top">
                <h3>
                  {s.name} <em>Suite</em>
                </h3>
                {s.active === false && <Badge tone="bad">Hidden</Badge>}
                {s.active !== false && list.filter((x) => x.active !== false).indexOf(s) < 3 && <Badge tone="ok">On home page</Badge>}
              </div>
              <p className="muted small">{s.mood}</p>
              <p className="small loc-line"><Icon name="pin" size={13} /> {locName(s.location)}</p>
              <p className="price">
                {formatINR(s.price)} <span className="muted small">/ night</span>
              </p>
              <p className="muted small">
                {s.inventory || 1} room{(s.inventory || 1) > 1 ? "s" : ""} · {(s.amenities || []).length} amenities · {(s.gallery || []).length} photos
              </p>
              <div className="row-actions">
                <Link href={`/suites/${s.id}`} className="btn btn-ghost btn-sm">
                  <Icon name="edit" size={15} /> Edit
                </Link>
                <button className="btn btn-ghost btn-sm" onClick={() => toggle(s)}>
                  {s.active === false ? "Show" : "Hide"}
                </button>
                <a className="icon-btn" href={`${SITE_URL}/rooms/${s.id}`} target="_blank" rel="noopener noreferrer" title="Open on website">
                  <Icon name="external" size={15} />
                </a>
                <span className="spacer" />
                <button className="icon-btn" disabled={i === 0} onClick={() => swap(s, list[i - 1])} title="Move earlier">
                  <Icon name="up" size={15} />
                </button>
                <button className="icon-btn" disabled={i === list.length - 1} onClick={() => swap(s, list[i + 1])} title="Move later">
                  <Icon name="down" size={15} />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
