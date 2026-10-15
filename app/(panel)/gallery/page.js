"use client";
import { useRef, useState } from "react";
import Icon from "@/components/Icon";
import { DeleteButton, Empty, Field, ImageField, Loading, Modal, PageHeader } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { uploadImage, useCollection, useSettings } from "@/lib/api";
import { byOrder, imgSrc } from "@/lib/format";

function PhotoForm({ initial, categories, onSave, onDelete, onClose }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm({ ...form, [k]: e?.target ? e.target.value : e });
  const submit = (e) => {
    e.preventDefault();
    if (!form.src) return setError("Add an image.");
    if (!form.alt.trim()) return setError("Describe the photo (used for accessibility and SEO).");
    onSave(form);
  };
  return (
    <Modal
      title={form.id ? "Edit photo" : "Add photo"}
      onClose={onClose}
      footer={
        <>
          {form.id && <DeleteButton onConfirm={onDelete} />}
          <span className="spacer" />
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" form="photo-form" className="btn btn-gold">Save photo</button>
        </>
      }
    >
      <form id="photo-form" onSubmit={submit} className="form-grid">
        <Field label="Image" full>
          <ImageField value={form.src} onChange={set("src")} />
        </Field>
        <Field label="Category">
          <select value={form.cat} onChange={set("cat")}>
            {categories.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Description">
          <input value={form.alt} onChange={set("alt")} placeholder="Santorini Suite plunge pool" />
        </Field>
      </form>
      {error && <p className="error-text">{error}</p>}
    </Modal>
  );
}

export default function Gallery() {
  const toast = useToast();
  const { items, error, save, swap, remove } = useCollection("gallery");
  const { settings } = useSettings();
  const [cat, setCat] = useState("All");
  const [editing, setEditing] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  if (!items || !settings) return <Loading error={error} />;
  const categories = settings.galleryCategories || [];
  const all = [...items].sort(byOrder);
  const list = all.filter((g) => cat === "All" || g.cat === cat);

  // Bulk upload: each file becomes a photo in the current (or first) category
  const bulk = async (files) => {
    setUploading(true);
    let n = 0;
    try {
      for (const f of files) {
        const src = await uploadImage(f);
        await save({ src, cat: cat === "All" ? categories[0] : cat, alt: f.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ") });
        n++;
      }
      toast(`${n} photo${n === 1 ? "" : "s"} added. Check their descriptions.`);
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <PageHeader title="Gallery" subtitle="Photos on the website's gallery page">
        <button className="btn btn-ghost" onClick={() => fileRef.current?.click()} disabled={uploading}>
          <Icon name="upload" size={16} /> {uploading ? "Uploading…" : "Upload photos"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          multiple
          hidden
          onChange={(e) => {
            const files = [...e.target.files];
            e.target.value = "";
            if (files.length) bulk(files);
          }}
        />
        <button className="btn btn-gold" onClick={() => setEditing({ src: "", cat: cat === "All" ? categories[0] : cat, alt: "" })}>
          <Icon name="plus" size={16} /> Add photo
        </button>
      </PageHeader>

      <div className="toolbar">
        <div className="tabs">
          {["All", ...categories].map((c) => (
            <button key={c} className={`tab ${cat === c ? "active" : ""}`} onClick={() => setCat(c)}>
              {c} <span className="tab-count">{items.filter((g) => c === "All" || g.cat === c).length}</span>
            </button>
          ))}
        </div>
      </div>

      {list.length ? (
        <div className="photo-grid">
          {list.map((g) => {
            const i = all.indexOf(g);
            return (
              <figure key={g.id} className="photo">
                <button className="photo-open" onClick={() => setEditing(g)} aria-label={`Edit ${g.alt}`}>
                  <img src={imgSrc(g.src)} alt={g.alt} loading="lazy" />
                </button>
                <figcaption>
                  <div className="clip">
                    <span className="ellipsis">{g.alt}</span>
                    <span className="muted small">{g.cat}</span>
                  </div>
                  <div className="photo-actions">
                    <button className="icon-btn" disabled={i === 0} onClick={() => swap(g, all[i - 1])} title="Move earlier">
                      <Icon name="up" size={14} />
                    </button>
                    <button className="icon-btn" disabled={i === all.length - 1} onClick={() => swap(g, all[i + 1])} title="Move later">
                      <Icon name="down" size={14} />
                    </button>
                  </div>
                </figcaption>
              </figure>
            );
          })}
        </div>
      ) : (
        <Empty icon="image" title="No photos here" text="Upload photos or switch category." />
      )}

      {editing && (
        <PhotoForm
          initial={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSave={async (data) => {
            try {
              await save(data);
              toast(data.id ? "Photo saved." : "Photo added.");
              setEditing(null);
            } catch (e) {
              toast(e.message, "error");
            }
          }}
          onDelete={async () => {
            await remove(editing.id);
            toast("Photo removed from gallery.");
            setEditing(null);
          }}
        />
      )}
    </>
  );
}
