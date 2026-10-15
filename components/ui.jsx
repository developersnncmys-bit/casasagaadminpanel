"use client";
import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import { uploadImage } from "@/lib/api";
import { imgSrc } from "@/lib/format";
import { useToast } from "./Toast";

export function PageHeader({ title, subtitle, children }) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </header>
  );
}

export function Loading({ error }) {
  return <div className="state">{error ? <span className="error-text">{error}</span> : <span className="spinner" />}</div>;
}

export function Empty({ icon = "sparkles", title, text, children }) {
  return (
    <div className="empty">
      <Icon name={icon} size={28} />
      <h3>{title}</h3>
      {text && <p className="muted">{text}</p>}
      {children}
    </div>
  );
}

export function Badge({ tone = "neutral", children }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? "modal-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, hint, error, children, full }) {
  return (
    <label className={`field ${full ? "field-full" : ""}`}>
      <span className="field-label">{label}</span>
      {children}
      {error ? <em className="field-error">{error}</em> : hint ? <em className="field-hint">{hint}</em> : null}
    </label>
  );
}

export function Toggle({ checked, onChange, label }) {
  return (
    <button type="button" className={`toggle ${checked ? "on" : ""}`} onClick={() => onChange(!checked)} aria-pressed={checked}>
      <span className="toggle-track">
        <span className="toggle-dot" />
      </span>
      {label}
    </button>
  );
}

// Delete button that asks once before acting
export function DeleteButton({ onConfirm, label = "Delete", small }) {
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!ask) return;
    const t = setTimeout(() => setAsk(false), 4000);
    return () => clearTimeout(t);
  }, [ask]);

  const click = async () => {
    if (!ask) return setAsk(true);
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
      setAsk(false);
    }
  };
  return (
    <button type="button" className={`btn btn-danger ${small ? "btn-sm" : ""} ${ask ? "is-asking" : ""}`} onClick={click} disabled={busy}>
      <Icon name="trash" size={15} />
      {ask ? "Click to confirm" : label}
    </button>
  );
}

// Edits a list of strings (amenities, features, occasions…)
export function ListEditor({ value = [], onChange, placeholder = "Add item" }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    onChange([...value, v]);
    setDraft("");
  };
  const move = (i, d) => {
    const next = [...value];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  return (
    <div className="list-editor">
      {value.map((item, i) => (
        <div key={i} className="list-row">
          <input value={item} onChange={(e) => onChange(value.map((x, j) => (j === i ? e.target.value : x)))} />
          <button type="button" className="icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
            <Icon name="up" size={15} />
          </button>
          <button type="button" className="icon-btn" onClick={() => move(i, 1)} disabled={i === value.length - 1} aria-label="Move down">
            <Icon name="down" size={15} />
          </button>
          <button type="button" className="icon-btn danger" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Remove">
            <Icon name="x" size={15} />
          </button>
        </div>
      ))}
      <div className="list-row">
        <input
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" className="btn btn-ghost btn-sm" onClick={add}>
          <Icon name="plus" size={15} /> Add
        </button>
      </div>
    </div>
  );
}

function useUpload(onDone) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  const pick = () => ref.current?.click();
  const input = (
    <input
      ref={ref}
      type="file"
      accept="image/jpeg,image/png,image/webp,image/avif"
      hidden
      multiple
      onChange={async (e) => {
        const files = [...e.target.files];
        e.target.value = "";
        if (!files.length) return;
        setBusy(true);
        try {
          const urls = [];
          for (const f of files) urls.push(await uploadImage(f));
          onDone(urls);
        } catch (err) {
          toast(err.message, "error");
        } finally {
          setBusy(false);
        }
      }}
    />
  );
  return { busy, pick, input };
}

// One image: path/URL + upload + preview
export function ImageField({ value, onChange }) {
  const { busy, pick, input } = useUpload((urls) => onChange(urls[0]));
  return (
    <div className="image-field">
      <div className="image-preview">{value ? <img src={imgSrc(value)} alt="" /> : <Icon name="image" size={26} />}</div>
      <div className="image-controls">
        <input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder="/images/photo.jpg or https://…" />
        <button type="button" className="btn btn-ghost btn-sm" onClick={pick} disabled={busy}>
          <Icon name="upload" size={15} /> {busy ? "Uploading…" : "Upload image"}
        </button>
        {input}
      </div>
    </div>
  );
}

// Several images (suite gallery)
export function ImageListEditor({ value = [], onChange }) {
  const { busy, pick, input } = useUpload((urls) => onChange([...value, ...urls]));
  const [draft, setDraft] = useState("");
  const move = (i, d) => {
    const next = [...value];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  return (
    <div className="image-list">
      <div className="thumbs">
        {value.map((src, i) => (
          <figure key={src + i} className="thumb">
            <img src={imgSrc(src)} alt="" />
            <figcaption>
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move left">‹</button>
              <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Remove">
                <Icon name="x" size={13} />
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === value.length - 1} aria-label="Move right">›</button>
            </figcaption>
          </figure>
        ))}
        <button type="button" className="thumb thumb-add" onClick={pick} disabled={busy}>
          <Icon name="upload" size={20} />
          {busy ? "Uploading…" : "Upload"}
        </button>
        {input}
      </div>
      <div className="list-row">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="…or paste a path / URL" />
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            if (!draft.trim()) return;
            onChange([...value, draft.trim()]);
            setDraft("");
          }}
        >
          <Icon name="plus" size={15} /> Add
        </button>
      </div>
    </div>
  );
}
