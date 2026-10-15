"use client";
import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { Field, ListEditor, Loading, PageHeader } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { useSettings } from "@/lib/api";

// Edits a list of two-field rows ({label, value} policies, {title, text} values)
function PairsEditor({ value = [], onChange, keys, labels, long }) {
  const [a, b] = keys;
  const update = (i, k, v) => onChange(value.map((row, j) => (j === i ? { ...row, [k]: v } : row)));
  const move = (i, d) => {
    const next = [...value];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  return (
    <div className="pairs">
      {value.map((row, i) => (
        <div key={i} className="pair">
          <input value={row[a]} onChange={(e) => update(i, a, e.target.value)} placeholder={labels[0]} />
          {long ? (
            <textarea rows={2} value={row[b]} onChange={(e) => update(i, b, e.target.value)} placeholder={labels[1]} />
          ) : (
            <input value={row[b]} onChange={(e) => update(i, b, e.target.value)} placeholder={labels[1]} />
          )}
          <div className="pair-actions">
            <button type="button" className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">
              <Icon name="up" size={15} />
            </button>
            <button type="button" className="icon-btn" disabled={i === value.length - 1} onClick={() => move(i, 1)} aria-label="Move down">
              <Icon name="down" size={15} />
            </button>
            <button type="button" className="icon-btn danger" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Remove">
              <Icon name="x" size={15} />
            </button>
          </div>
        </div>
      ))}
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange([...value, { [a]: "", [b]: "" }])}>
        <Icon name="plus" size={15} /> Add row
      </button>
    </div>
  );
}

export default function Settings() {
  const toast = useToast();
  const { settings, error, save } = useSettings();
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  if (!form) return <Loading error={error} />;

  const dirty = JSON.stringify(form) !== JSON.stringify(settings);
  const setContact = (k) => (e) => setForm({ ...form, contact: { ...form.contact, [k]: e?.target ? e.target.value : e } });
  const set = (k) => (v) => setForm({ ...form, [k]: v });
  const invoice = form.invoice || {};
  const setInvoice = (k) => (e) => setForm({ ...form, invoice: { ...invoice, [k]: e.target.value } });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const phoneDigits = form.contact.phone.replace(/[^\d+]/g, "");
      await save({
        ...form,
        // Keep the call link and WhatsApp number in step with the displayed phone unless set explicitly
        contact: { ...form.contact, tel: form.contact.tel || phoneDigits, whatsapp: (form.contact.whatsapp || phoneDigits).replace(/\D/g, "") },
        policies: form.policies.filter((p) => p.label.trim()),
        values: form.values.filter((v) => v.title.trim()),
        occasions: form.occasions.filter(Boolean),
        galleryCategories: form.galleryCategories.filter((c) => c && c !== "All"),
        invoice: { ...invoice, taxRate: Number(invoice.taxRate) || 0 },
      });
      toast("Settings saved.");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <PageHeader title="Contact & policies" subtitle="Details shown in the footer, contact, booking and about pages">
        {dirty && <span className="muted small">Unsaved changes</span>}
        <button className="btn btn-gold" disabled={busy || !dirty}>{busy ? "Saving…" : "Save changes"}</button>
      </PageHeader>

      <div className="settings">
        <section className="panel pad">
          <h2 className="panel-title">Contact</h2>
          <div className="form-grid">
            <Field label="Phone (as displayed)">
              <input value={form.contact.phone} onChange={setContact("phone")} />
            </Field>
            <Field label="Call link number" hint="Digits with country code, e.g. +917406565065">
              <input value={form.contact.tel} onChange={setContact("tel")} />
            </Field>
            <Field label="WhatsApp number" hint="Digits only with country code — booking requests go here">
              <input value={form.contact.whatsapp} onChange={setContact("whatsapp")} />
            </Field>
            <Field label="Google Maps link">
              <input value={form.contact.mapUrl} onChange={setContact("mapUrl")} />
            </Field>
            <Field label="Address lines" full>
              <ListEditor value={form.contact.address} onChange={setContact("address")} placeholder="Add address line" />
            </Field>
          </div>
        </section>

        <section className="panel pad settings-full">
          <h2 className="panel-title">Invoices</h2>
          <p className="muted small">Printed on every booking invoice (PDF)</p>
          <div className="form-grid">
            <Field label="Business name">
              <input value={invoice.businessName || ""} onChange={setInvoice("businessName")} />
            </Field>
            <Field label="GSTIN" hint="Leave empty if not registered">
              <input value={invoice.gstin || ""} onChange={setInvoice("gstin")} placeholder="29ABCDE1234F1Z5" />
            </Field>
            <Field label="Default tax / GST (%)" hint="Applied to new bookings; 0 = no tax line">
              <input type="number" min="0" max="100" step="0.01" value={invoice.taxRate ?? 0} onChange={setInvoice("taxRate")} />
            </Field>
            <Field label="Invoice number prefix" hint={`e.g. ${invoice.prefix || "CS"}-${new Date().getFullYear()}-0001`}>
              <input value={invoice.prefix || ""} onChange={setInvoice("prefix")} />
            </Field>
            <Field label="Thank-you note" full>
              <input value={invoice.note || ""} onChange={setInvoice("note")} />
            </Field>
          </div>
        </section>

        <section className="panel pad">
          <h2 className="panel-title">House policies</h2>
          <p className="muted small">Check-in, check-out, cancellation and other rules</p>
          <PairsEditor value={form.policies} onChange={set("policies")} keys={["label", "value"]} labels={["Policy", "Details"]} />
        </section>

        <section className="panel pad">
          <h2 className="panel-title">Occasions</h2>
          <p className="muted small">Choices in the booking and contact forms</p>
          <ListEditor value={form.occasions} onChange={set("occasions")} placeholder="Add occasion" />
        </section>

        <section className="panel pad">
          <h2 className="panel-title">Gallery categories</h2>
          <p className="muted small">Filters on the gallery page (“All” is added automatically)</p>
          <ListEditor value={form.galleryCategories} onChange={set("galleryCategories")} placeholder="Add category" />
        </section>

        <section className="panel pad settings-full">
          <h2 className="panel-title">Our values</h2>
          <p className="muted small">Shown on the About page</p>
          <PairsEditor value={form.values} onChange={set("values")} keys={["title", "text"]} labels={["Title", "Description"]} long />
        </section>
      </div>
    </form>
  );
}
