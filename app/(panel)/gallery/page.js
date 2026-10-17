"use client";
import { useRef, useState } from "react";
import Icon from "@/components/Icon";
import { DeleteButton, Empty, Field, ImageField, Loading, MediaPreview, Modal, PageHeader } from "@/components/ui";
import { useToast } from "@/components/Toast";
import Pagination, { usePaged } from "@/components/Pagination";
import { MEDIA_ACCEPT, uploadImage, useCollection, useSettings } from "@/lib/api";
import { byOrder, imgSrc } from "@/lib/format";

function PhotoForm({ initial, categories, onSave, onDelete, onClose }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm({ ...form, [k]: e?.target ? e.target.value : e });
  const submit = (e) => {
    e.preventDefault();
    if (!form.src) return setError("Add a photo or video.");
    if (!form.alt.trim()) return setError("Describe the photo (used for accessibility and SEO).");
    if (form.alt.trim().length > 120) return setError("Keep the description under 120 characters.");
    if (!form.cat) return setError("Choose a category.");
    onSave(form);
  };
  return (
    <Modal
      title={form.id ? "Edit photo / video" : "Add photo or video"}
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
        <Field label="Photo or video" hint="Upload a file, or paste an image / video URL or a YouTube link" full>
          <ImageField value={form.src} onChange={set("src")} allowVideo />
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
  const [progress, setProgress] = useState(0);
  const fileRef = useRef(null);

  // 24 photos a page (hooks run before the loading check below)
  const { rows: pageItems, pager } = usePaged(items ? [...items].sort(byOrder).filter((g) => cat === "All" || g.cat === cat) : [], { perPage: 24, resetOn: [cat] });
  if (!items || !settings) return <Loading error={error} />;
  const categories = settings.galleryCategories || [];
  const all = [...items].sort(byOrder);
  const list = all.filter((g) => cat === "All" || g.cat === cat);

  // Bulk upload: each file becomes a photo in the current (or first) category
  const bulk = async (files) => {
    setUploading(true);
    setProgress(0);
    let n = 0;
    try {
      for (const [i, f] of files.entries()) {
        const src = await uploadImage(f, (p) => setProgress(Math.round(((i + p / 100) / files.length) * 100)));
        await save({ src, cat: cat === "All" ? categories[0] : cat, alt: f.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ") });
        n++;
      }
      toast(`${n} item${n === 1 ? "" : "s"} added. Check their descriptions.`);
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <PageHeader title="Gallery" subtitle="Photos and videos on the website's gallery page, by category">
        <button className="btn btn-ghost" onClick={() => fileRef.current?.click()} disabled={uploading}>
          <Icon name="upload" size={16} /> {uploading ? `Uploading ${progress}%` : "Upload photos / videos"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept={MEDIA_ACCEPT}
          multiple
          hidden
          onChange={(e) => {
            const files = [...e.target.files];
            e.target.value = "";
            if (files.length) bulk(files);
          }}
        />
        <button className="btn btn-gold" onClick={() => setEditing({ src: "", cat: cat === "All" ? categories[0] : cat, alt: "" })}>
          <Icon name="plus" size={16} /> Add photo / video
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
        <>
        <div className="photo-grid">
          {pageItems.map((g) => {
            const i = all.indexOf(g);
            return (
              <figure key={g.id} className="photo">
                <button className="photo-open" onClick={() => setEditing(g)} aria-label={`Edit ${g.alt}`}>
                  <MediaPreview src={g.src} />
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
        <Pagination pager={pager} sizes={[24, 48, 96]} label="photos and videos" />
        </>
      ) : (
        <Empty icon="image" title="Nothing here yet" text="Upload photos or videos, or switch category." />
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
