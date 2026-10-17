"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { DeleteButton, Field, ImageField, ImageListEditor, ListEditor, Loading, PageHeader, Toggle } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { api, useCollection, useSettings } from "@/lib/api";
import { slugify } from "@/lib/slug";
import { fullName } from "@/lib/format";

const EMPTY = {
  id: "", name: "", mood: "", tag: "", price: "", img: "", accent: "#d8b56a", size: "", guests: "2 guests",
  inventory: 1, includedGuests: 2, maxGuests: 4, extraGuestPrice: 0, blurb: "", story: "", features: [], amenities: [], gallery: [], active: true,
};

export default function SuiteEditor() {
  const { id } = useParams();
  const isNew = id === "new";
  const router = useRouter();
  const toast = useToast();
  const { items, save, remove } = useCollection("suites");
  const { settings } = useSettings();
  const locations = settings?.locations || [];
  const [form, setForm] = useState(isNew ? EMPTY : null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  // The suite as last loaded or saved — anything different hasn't reached the website yet
  const [savedAs, setSavedAs] = useState(isNew ? JSON.stringify(EMPTY) : null);
  const dirty = !!form && savedAs !== null && JSON.stringify(form) !== savedAs;

  useEffect(() => {
    if (isNew) return;
    api(`/api/suites/${id}`)
      .then((s) => {
        setForm({ ...EMPTY, ...s });
        setSavedAs(JSON.stringify({ ...EMPTY, ...s }));
      })
      .catch((e) => setLoadError(e.message));
  }, [id, isNew]);

  // Warn before leaving with photos or changes that were never saved
  useEffect(() => {
    if (!dirty) return;
    const warn = (e) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (!form || !items) return <Loading error={loadError} />;

  const set = (k) => (e) => {
    const v = e?.target ? e.target.value : e;
    setForm((f) => ({ ...f, [k]: v, ...(k === "name" && isNew && !f.__idTouched ? { id: slugify(v) } : {}) }));
    setErrors((er) => ({ ...er, [k]: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    const err = {};
    if (!form.name.trim()) err.name = "Give the suite a name.";
    if (!(Number(form.price) > 0)) err.price = "Enter the nightly price.";
    if (isNew && !slugify(form.id)) err.id = "Enter a URL name.";
    if (isNew && items.some((s) => s.id === slugify(form.id))) err.id = "Another suite already uses this URL.";
    if (!form.img) err.img = "Add a main photo.";
    if (Number(form.maxGuests) < Number(form.includedGuests)) err.maxGuests = "Can't be fewer than the guests included.";
    setErrors(err);
    if (Object.keys(err).length) return;
    setBusy(true);
    try {
      const { __idTouched, ...data } = form;
      const saved = await save({ ...data, id: isNew ? slugify(form.id) : form.id, price: Number(form.price), inventory: Math.max(1, Number(form.inventory) || 1), includedGuests: Math.max(1, Number(form.includedGuests) || 2), maxGuests: Math.max(1, Number(form.maxGuests) || 4), extraGuestPrice: Math.max(0, Number(form.extraGuestPrice) || 0), taxRate: form.taxRate === "" || form.taxRate == null ? null : Number(form.taxRate), location: form.location || locations[0]?.id }, { create: isNew });
      toast(isNew ? `${fullName(saved.name)} added.` : "Suite saved.");
      setSavedAs(JSON.stringify({ ...EMPTY, ...saved }));
      if (isNew) router.replace(`/suites/${saved.id}`);
      else setForm({ ...EMPTY, ...saved });
    } catch (e2) {
      toast(e2.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <PageHeader title={isNew ? "Add suite" : fullName(form.name)} subtitle={isNew ? "A new room for the website" : `/rooms/${form.id}`}>
        {dirty && <span className="unsaved">Unsaved changes — not on the website yet</span>}
        <Link href="/suites" className="btn btn-ghost">Back</Link>
        <button className="btn btn-gold" disabled={busy}>{busy ? "Saving…" : "Save suite"}</button>
      </PageHeader>

      <div className="editor">
        <section className="panel pad">
          <h2 className="panel-title">Basics</h2>
          <div className="form-grid">
            <Field label="Name" error={errors.name} hint="Shown as “Name Suite” — a name ending in Flat, Room, Villa… is shown as it is">
              <input value={form.name} onChange={set("name")} placeholder="Tulum" />
            </Field>
            <Field label="URL name" error={errors.id} hint={isNew ? "Used in the page address" : "Can't be changed after creating"}>
              <input value={form.id} disabled={!isNew} onChange={(e) => setForm({ ...form, id: e.target.value, __idTouched: true })} />
            </Field>
            <Field label="Mood / theme">
              <input value={form.mood} onChange={set("mood")} placeholder="Boho Chic" />
            </Field>
            <Field label="Tag">
              <input value={form.tag} onChange={set("tag")} placeholder="Signature Suite" />
            </Field>
            <Field label="Price per night (₹)" error={errors.price}>
              <input type="number" min="0" step="1" value={form.price} onChange={set("price")} />
            </Field>
            <Field label="Accent colour">
              <div className="color-field">
                <input type="color" value={form.accent || "#d8b56a"} onChange={set("accent")} />
                <input value={form.accent} onChange={set("accent")} />
              </div>
            </Field>
            <Field label="Size">
              <input value={form.size} onChange={set("size")} placeholder="65 sq. m." />
            </Field>
            <Field label="Guests included in the price" hint="The nightly price covers this many guests">
              <input type="number" min="1" max="10" value={form.includedGuests ?? 2} onChange={set("includedGuests")} />
            </Field>
            <Field label="Maximum guests" hint="The most guests the website lets book this suite" error={errors.maxGuests}>
              <input type="number" min="1" max="10" value={form.maxGuests ?? 4} onChange={set("maxGuests")} />
            </Field>
            <Field label="Extra guest charge (₹ per night)" hint="For each guest over those included, plus the suite's GST">
              <input type="number" min="0" step="1" value={form.extraGuestPrice ?? 0} onChange={set("extraGuestPrice")} />
            </Field>
            <Field label="Location" hint="Which property this suite is at">
              <select value={form.location || locations[0]?.id || ""} onChange={set("location")}>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Rooms of this type" hint="How many guests can book this suite for the same night">
              <input type="number" min="1" max="50" value={form.inventory ?? 1} onChange={set("inventory")} />
            </Field>
            <Field label="GST (%)" hint="Leave empty to use the default from Contact & policies → Invoices & pricing">
              <input type="number" min="0" max="100" step="0.01" value={form.taxRate ?? ""} onChange={set("taxRate")} placeholder="Default" />
            </Field>
            <Field label="Short description" hint="Shown on the suites list" full>
              <textarea rows={2} value={form.blurb} onChange={set("blurb")} />
            </Field>
            <Field label="Story" hint="Shown on the suite's own page" full>
              <textarea rows={5} value={form.story} onChange={set("story")} />
            </Field>
          </div>
        </section>

        <aside className="editor-side">
          <section className="panel pad">
            <h2 className="panel-title">Visibility</h2>
            <Toggle checked={form.active !== false} onChange={set("active")} label={form.active !== false ? "Shown on website" : "Hidden from website"} />
            <p className="muted small">Visible suites are listed on the website. The home page shows the suites at the first location (Contact &amp; policies → Locations), in the order set with the arrows on the Suites page.</p>
          </section>
          <section className="panel pad">
            <h2 className="panel-title">Main photo</h2>
            <ImageField value={form.img} onChange={set("img")} />
            {errors.img && <em className="field-error">{errors.img}</em>}
          </section>
          <section className="panel pad">
            <h2 className="panel-title">Highlights</h2>
            <p className="muted small">Three short chips shown on the suite card</p>
            <ListEditor value={form.features} onChange={set("features")} placeholder="Sunken private jacuzzi" />
          </section>
        </aside>

        <section className="panel pad editor-full">
          <h2 className="panel-title">Amenities</h2>
          <ListEditor value={form.amenities} onChange={set("amenities")} placeholder="Rainfall shower" />
        </section>

        <section className="panel pad editor-full">
          <h2 className="panel-title">Photos &amp; videos</h2>
          <p className="muted small">Shown on the suite page, first ones first. Upload photos or videos (MP4/WebM/MOV, up to 50 MB), or paste a YouTube link. The first two photos are also used at the top of the suite page.</p>
          <ImageListEditor value={form.gallery} onChange={set("gallery")} />
        </section>

        {!isNew && (
          <section className="panel pad editor-full danger-zone">
            <div>
              <h2 className="panel-title">Delete suite</h2>
              <p className="muted small">Removes it from the website. Existing bookings keep their record. To take it offline for a while, hide it instead.</p>
            </div>
            <DeleteButton
              label="Delete suite"
              onConfirm={async () => {
                await remove(form.id);
                toast("Suite deleted.");
                router.replace("/suites");
              }}
            />
          </section>
        )}
      </div>
    </form>
  );
}
