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
  const locations = form.locations || [];
  const setLocation = (i, k, v) => setForm({ ...form, locations: locations.map((l, j) => (j === i ? { ...l, [k]: v } : l)) });
  const addLocation = () => setForm({ ...form, locations: [...locations, { id: "", name: "", address: [], mapUrl: "", mapQuery: "" }] });

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
        // A new location gets its id from its name; existing ids never change (suites point at them)
        locations: locations
          .filter((l) => l.name.trim())
          .map((l) => ({ ...l, id: l.id || l.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""), address: (l.address || []).filter(Boolean) })),
        invoice: { ...invoice, taxRate: Number(invoice.taxRate) || 0, addonTaxRate: Number(invoice.addonTaxRate ?? 18) || 0, convenienceFee: Number(invoice.convenienceFee) || 0, convenienceFeeType: invoice.convenienceFeeType || "fixed" },
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
          <h2 className="panel-title">Locations</h2>
          <p className="muted small">Each suite belongs to one of these. The website lets guests choose a location under Suites, and invoices use the suite&apos;s address.</p>
          <div className="loc-edit">
            {locations.map((l, i) => (
              <div key={l.id || i} className="loc-card">
                <div className="form-grid">
                  <Field label="Name" hint={l.id ? `Web id: ${l.id}` : "e.g. JP Nagar 7th Phase"}>
                    <input value={l.name} onChange={(e) => setLocation(i, "name", e.target.value)} />
                  </Field>
                  <Field label="Google Maps link" hint="Used for “Get directions”">
                    <input value={l.mapUrl || ""} onChange={(e) => setLocation(i, "mapUrl", e.target.value)} placeholder="https://maps.app.goo.gl/…" />
                  </Field>
                  <Field label="Map pin" hint="Address or “latitude,longitude” for the map on the contact page">
                    <input value={l.mapQuery || ""} onChange={(e) => setLocation(i, "mapQuery", e.target.value)} placeholder="12.8940229,77.5784378" />
                  </Field>
                  <Field label="Address lines" full>
                    <ListEditor value={l.address || []} onChange={(v) => setLocation(i, "address", v)} placeholder="Add address line" />
                  </Field>
                </div>
              </div>
            ))}
            <button type="button" className="btn btn-ghost btn-sm" onClick={addLocation}>
              <Icon name="plus" size={15} /> Add location
            </button>
          </div>
        </section>

        <section className="panel pad settings-full">
          <h2 className="panel-title">Invoices &amp; pricing</h2>
          <p className="muted small">GST and convenience fee are added to every booking automatically, and printed on the invoice (PDF)</p>
          <div className="form-grid">
            <Field label="Business name">
              <input value={invoice.businessName || ""} onChange={setInvoice("businessName")} />
            </Field>
            <Field label="GSTIN" hint="Leave empty if not registered">
              <input value={invoice.gstin || ""} onChange={setInvoice("gstin")} placeholder="29ABCDE1234F1Z5" />
            </Field>
            <Field label="Stay GST (%)" hint="For suites without their own GST %; 0 = no GST line">
              <input type="number" min="0" max="100" step="0.01" value={invoice.taxRate ?? 0} onChange={setInvoice("taxRate")} />
            </Field>
            <Field label="Add-on GST (%)" hint="For decoration add-ons without their own GST %">
              <input type="number" min="0" max="100" step="0.01" value={invoice.addonTaxRate ?? 18} onChange={setInvoice("addonTaxRate")} />
            </Field>
            <Field label="Convenience fee" hint={invoice.convenienceFeeType === "percent" ? "% of the base fee, added to every booking" : "₹ added to every booking; 0 = none"}>
              <div className="color-field">
                <input type="number" min="0" step="0.01" value={invoice.convenienceFee ?? 0} onChange={setInvoice("convenienceFee")} />
                <select value={invoice.convenienceFeeType || "fixed"} onChange={setInvoice("convenienceFeeType")} style={{ width: "auto" }}>
                  <option value="fixed">₹ per booking</option>
                  <option value="percent">% of base fee</option>
                </select>
              </div>
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
