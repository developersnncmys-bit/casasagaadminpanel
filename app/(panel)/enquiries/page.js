"use client";
import { useMemo, useState } from "react";
import Icon from "@/components/Icon";
import { Badge, DeleteButton, Empty, Field, Loading, Modal, PageHeader } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { useCollection, useSettings } from "@/lib/api";
import { ENQUIRY_STATUSES, STATUS_TONE, fmtDateTime, statusLabel, waGuest } from "@/lib/format";

const EMPTY = { name: "", email: "", phone: "", occasion: "", message: "", status: "new" };

function EnquiryForm({ initial, occasions, onSave, onClose }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = (e) => {
    e.preventDefault();
    if (form.name.trim().length < 2 || (!form.email && !form.phone) || !form.message.trim()) {
      return setError("Add a name, an email or phone number, and the message.");
    }
    onSave(form);
  };
  return (
    <Modal
      title="Add enquiry"
      onClose={onClose}
      footer={
        <>
          <span className="spacer" />
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" form="enq-form" className="btn btn-gold">Save enquiry</button>
        </>
      }
    >
      <form id="enq-form" onSubmit={submit} className="form-grid">
        <Field label="Name"><input value={form.name} onChange={set("name")} autoFocus /></Field>
        <Field label="Occasion">
          <select value={form.occasion} onChange={set("occasion")}>
            <option value="">—</option>
            {occasions.map((o) => <option key={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Email"><input type="email" value={form.email} onChange={set("email")} /></Field>
        <Field label="Phone"><input value={form.phone} onChange={set("phone")} /></Field>
        <Field label="Message" full><textarea rows={5} value={form.message} onChange={set("message")} /></Field>
      </form>
      {error && <p className="error-text">{error}</p>}
    </Modal>
  );
}

export default function Enquiries() {
  const toast = useToast();
  const { items, error, save, remove } = useCollection("enquiries");
  const { settings } = useSettings();
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);
  const [adding, setAdding] = useState(false);

  const list = useMemo(() => {
    if (!items) return [];
    const term = q.trim().toLowerCase();
    return items
      .filter((e) => status === "all" || e.status === status)
      .filter((e) => !term || [e.name, e.email, e.phone, e.message].some((v) => (v || "").toLowerCase().includes(term)))
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  }, [items, status, q]);

  if (!items || !settings) return <Loading error={error} />;

  const setStatusOf = async (e, s) => {
    try {
      const saved = await save({ ...e, status: s });
      if (open?.id === e.id) setOpen(saved);
      toast(`Marked ${statusLabel(ENQUIRY_STATUSES, s).toLowerCase()}.`);
    } catch (err) {
      toast(err.message, "error");
    }
  };

  return (
    <>
      <PageHeader title="Enquiries" subtitle="Messages from the contact page">
        <button className="btn btn-ghost" onClick={() => setAdding(true)}>
          <Icon name="plus" size={16} /> Add enquiry
        </button>
      </PageHeader>

      <div className="toolbar">
        <div className="tabs">
          {[{ id: "all", label: "All" }, ...ENQUIRY_STATUSES].map((s) => (
            <button key={s.id} className={`tab ${status === s.id ? "active" : ""}`} onClick={() => setStatus(s.id)}>
              {s.label} <span className="tab-count">{items.filter((e) => s.id === "all" || e.status === s.id).length}</span>
            </button>
          ))}
        </div>
        <div className="search">
          <Icon name="search" size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search enquiries" />
        </div>
      </div>

      {list.length ? (
        <div className="cards-list">
          {list.map((e) => (
            <button key={e.id} className={`enquiry ${e.status === "new" ? "unread" : ""}`} onClick={() => setOpen(e)}>
              <div className="enquiry-top">
                <strong>{e.name}</strong>
                <Badge tone={STATUS_TONE[e.status]}>{statusLabel(ENQUIRY_STATUSES, e.status)}</Badge>
              </div>
              <div className="muted small">
                {[e.occasion, e.email, e.phone].filter(Boolean).join(" · ")} · {fmtDateTime(e.createdAt)}
              </div>
              <p className="ellipsis-2">{e.message}</p>
            </button>
          ))}
        </div>
      ) : (
        <Empty icon="mail" title={items.length ? "No enquiries match" : "No enquiries yet"} text={items.length ? "Try another filter." : "Messages sent from the website's Contact page appear here. Use “Add enquiry” for ones taken by phone."} />
      )}

      {open && (
        <Modal
          title={open.name}
          onClose={() => setOpen(null)}
          footer={
            <>
              <DeleteButton
                onConfirm={async () => {
                  await remove(open.id);
                  toast("Enquiry deleted.");
                  setOpen(null);
                }}
              />
              <span className="spacer" />
              {ENQUIRY_STATUSES.filter((s) => s.id !== open.status).map((s) => (
                <button key={s.id} className="btn btn-ghost" onClick={() => setStatusOf(open, s.id)}>
                  Mark {s.label.toLowerCase()}
                </button>
              ))}
            </>
          }
        >
          <dl className="details">
            <dt>Received</dt><dd>{fmtDateTime(open.createdAt)}</dd>
            {open.occasion && (<><dt>Occasion</dt><dd>{open.occasion}</dd></>)}
            {open.email && (<><dt>Email</dt><dd><a className="link" href={`mailto:${open.email}`}>{open.email}</a></dd></>)}
            {open.phone && (<><dt>Phone</dt><dd><a className="link" href={`tel:${open.phone}`}>{open.phone}</a></dd></>)}
          </dl>
          <p className="message">{open.message}</p>
          <div className="row-actions">
            {open.phone && (
              <a className="btn btn-gold btn-sm" href={waGuest(open.phone, `Hello ${open.name.split(" ")[0]}, thank you for contacting CasaSaga!`)} target="_blank" rel="noopener noreferrer" onClick={() => open.status === "new" && setStatusOf(open, "replied")}>
                <Icon name="chat" size={15} /> Reply on WhatsApp
              </a>
            )}
            {open.email && (
              <a className="btn btn-ghost btn-sm" href={`mailto:${open.email}?subject=${encodeURIComponent("Your enquiry — CasaSaga")}`} onClick={() => open.status === "new" && setStatusOf(open, "replied")}>
                <Icon name="mail" size={15} /> Reply by email
              </a>
            )}
          </div>
        </Modal>
      )}

      {adding && (
        <EnquiryForm
          initial={EMPTY}
          occasions={settings.occasions || []}
          onClose={() => setAdding(false)}
          onSave={async (data) => {
            try {
              await save(data);
              toast("Enquiry added.");
              setAdding(false);
            } catch (err) {
              toast(err.message, "error");
            }
          }}
        />
      )}
    </>
  );
}
