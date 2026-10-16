"use client";
import { useState } from "react";
import Icon from "@/components/Icon";
import { Badge, DeleteButton, Empty, Field, ImageField, Loading, Modal, PageHeader, Toggle } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { useCollection, useSettings } from "@/lib/api";
import { byOrder, formatINR, imgSrc } from "@/lib/format";
import { slugify } from "@/lib/slug";

const EMPTY = { id: "", title: "", occasion: "", text: "", img: "", price: "", taxRate: "", active: true };

function AddonForm({ initial, isNew, occasions, taken, defaultTax, onSave, onDelete, onClose }) {
  const [form, setForm] = useState({ ...initial, price: initial.price ?? "", taxRate: initial.taxRate ?? "" });
  const [errors, setErrors] = useState({});
  const set = (k) => (e) => {
    setForm({ ...form, [k]: e?.target ? e.target.value : e });
    setErrors({ ...errors, [k]: undefined });
  };
  const submit = (e) => {
    e.preventDefault();
    const err = {};
    if (!form.title.trim()) err.title = "Give the add-on a name.";
    if (form.price !== "" && !(Number(form.price) >= 0)) err.price = "Enter a valid price or leave empty.";
    if (isNew && taken.includes(slugify(form.title))) err.title = "An add-on with this name already exists.";
    if (!form.img) err.img = "Add a photo.";
    setErrors(err);
    if (Object.keys(err).length) return;
    onSave({ ...form, id: isNew ? slugify(form.title) : form.id, price: form.price === "" ? null : Number(form.price), taxRate: form.taxRate === "" ? null : Number(form.taxRate) });
  };

  return (
    <Modal
      wide
      title={isNew ? "Add decoration add-on" : form.title}
      onClose={onClose}
      footer={
        <>
          {!isNew && <DeleteButton onConfirm={onDelete} />}
          <span className="spacer" />
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" form="addon-form" className="btn btn-gold">Save add-on</button>
        </>
      }
    >
      <form id="addon-form" onSubmit={submit} className="form-grid">
        <Field label="Name" error={errors.title}>
          <input value={form.title} onChange={set("title")} placeholder="Birthday Decor" autoFocus />
        </Field>
        <Field label="Price (₹)" error={errors.price} hint="Leave empty to show “Price on request”">
          <input type="number" min="0" value={form.price} onChange={set("price")} />
        </Field>
        <Field label="GST (%)" hint="Leave empty to use the add-on default from Contact & policies">
          <input type="number" min="0" max="100" step="0.01" value={form.taxRate} onChange={set("taxRate")} placeholder={`Default: ${defaultTax}%`} />
        </Field>
        <Field label="Matches occasion" hint="Picked automatically in the booking form">
          <select value={form.occasion} onChange={set("occasion")}>
            <option value="">—</option>
            {occasions.map((o) => <option key={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Visibility">
          <Toggle checked={form.active !== false} onChange={set("active")} label={form.active !== false ? "Shown on website" : "Hidden"} />
        </Field>
        <Field label="Description" full>
          <textarea rows={3} value={form.text} onChange={set("text")} />
        </Field>
        <Field label="Photo" error={errors.img} full>
          <ImageField value={form.img} onChange={set("img")} />
        </Field>
      </form>
    </Modal>
  );
}

export default function Addons() {
  const toast = useToast();
  const { items, error, save, swap, remove } = useCollection("addons");
  const { settings } = useSettings();
  const [editing, setEditing] = useState(null);

  if (!items || !settings) return <Loading error={error} />;
  const list = [...items].sort(byOrder);

  // Number labels ("01", "02"…) follow display order
  const renumber = async (ordered) => {
    await Promise.all(ordered.map((a, i) => (a.no !== String(i + 1).padStart(2, "0") ? save({ ...a, no: String(i + 1).padStart(2, "0") }) : null)));
  };

  return (
    <>
      <PageHeader title="Add-ons" subtitle="In-house decoration packages guests can add to a stay">
        <button className="btn btn-gold" onClick={() => setEditing({ ...EMPTY })}>
          <Icon name="plus" size={16} /> Add add-on
        </button>
      </PageHeader>

      {list.length ? (
        <div className="addon-grid">
          {list.map((a, i) => (
            <article key={a.id} className={`addon-card ${a.active === false ? "is-hidden" : ""}`}>
              <div className="addon-img">
                <img src={imgSrc(a.img)} alt="" />
                <span className="addon-no">{a.no}</span>
              </div>
              <div className="addon-body">
                <div className="suite-card-top">
                  <h3>{a.title}</h3>
                  {a.active === false && <Badge tone="bad">Hidden</Badge>}
                </div>
                <p className="muted small ellipsis-2">{a.text}</p>
                <p className="price small">
                  {a.price ? formatINR(a.price) : <span className="muted">Price on request</span>}
                  <span className="muted small"> · {a.taxRate ?? settings.invoice?.addonTaxRate ?? 0}% GST</span>
                </p>
                <div className="row-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditing(a)}>
                    <Icon name="edit" size={15} /> Edit
                  </button>
                  <span className="spacer" />
                  <button className="icon-btn" disabled={i === 0} onClick={async () => { await swap(a, list[i - 1]); }} title="Move earlier">
                    <Icon name="up" size={15} />
                  </button>
                  <button className="icon-btn" disabled={i === list.length - 1} onClick={async () => { await swap(a, list[i + 1]); }} title="Move later">
                    <Icon name="down" size={15} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty icon="sparkles" title="No add-ons yet" text="Add decoration packages like birthday or anniversary setups." />
      )}

      {list.some((a, i) => a.no !== String(i + 1).padStart(2, "0")) && (
        <p className="muted small renumber">
          Numbers are out of order.{" "}
          <button className="link" onClick={() => renumber(list).then(() => toast("Add-ons renumbered."))}>Renumber 01, 02, 03…</button>
        </p>
      )}

      {editing && (
        <AddonForm
          initial={editing}
          isNew={!editing.id}
          occasions={settings.occasions || []}
          defaultTax={settings.invoice?.addonTaxRate ?? 18}
          taken={items.map((a) => a.id)}
          onClose={() => setEditing(null)}
          onSave={async (data) => {
            try {
              const isNew = !editing.id;
              await save(isNew ? { ...data, no: String(items.length + 1).padStart(2, "0") } : data, { create: isNew });
              toast(isNew ? "Add-on created." : "Add-on saved.");
              setEditing(null);
            } catch (e) {
              toast(e.message, "error");
            }
          }}
          onDelete={async () => {
            await remove(editing.id);
            toast("Add-on deleted.");
            setEditing(null);
          }}
        />
      )}
    </>
  );
}
