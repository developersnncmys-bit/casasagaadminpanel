"use client";
import { useCallback, useEffect, useState } from "react";

// The Node/Express backend (casasaga-adminpanel/backend)
export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "https://casasagabackend.vercel.app").replace(/\/$/, "");

const TOKEN_KEY = "casasaga_token";
export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};
export const setToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {}
};

export function signOut() {
  setToken(null);
  const here = window.location.pathname;
  window.location.href = here === "/" || here === "/login" ? "/login" : `/login?next=${encodeURIComponent(here)}`;
}

async function request(path, init) {
  const token = getToken();
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { ...(init.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      cache: "no-store",
    });
  } catch {
    throw new Error(`Can't reach the server at ${API_URL} — is the backend running?`);
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !path.startsWith("/api/auth/login")) {
    signOut();
    throw new Error("Please sign in again.");
  }
  if (!res.ok) throw new Error(data.message || "Something went wrong.");
  return data.data;
}

// path is the backend route, e.g. "/api/bookings"; resolves to the response's `data`
export function api(path, { method = "GET", body } = {}) {
  return request(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function uploadImage(file) {
  const form = new FormData();
  form.append("file", file);
  const data = await request("/api/uploads", { method: "POST", body: form });
  return data.url;
}

// Load a collection and keep a local copy in sync after saves / deletes
export function useCollection(name) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setError("");
    return api(`/api/${name}`).then(setItems).catch((e) => setError(e.message));
  }, [name]);

  useEffect(() => {
    load();
  }, [load]);

  // Items with an id are updated; pass { create: true } to create one with a chosen id (suites, add-ons)
  const save = async (item, { create = !item.id } = {}) => {
    const saved = create
      ? await api(`/api/${name}`, { method: "POST", body: item })
      : await api(`/api/${name}/${item.id}`, { method: "PUT", body: item });
    setItems((list) => (create ? [...(list || []), saved] : (list || []).map((x) => (x.id === saved.id ? saved : x))));
    return saved;
  };

  // Swap display order of two items (the website shows content sorted by `order`)
  const swap = async (a, b) => {
    const [x, y] = [a.order ?? 0, b.order ?? 0];
    await Promise.all([save({ ...a, order: y === x ? x + 1 : y }), save({ ...b, order: x })]);
  };

  const remove = async (id) => {
    await api(`/api/${name}/${id}`, { method: "DELETE" });
    setItems((list) => (list || []).filter((x) => x.id !== id));
  };

  return { items, setItems, error, load, save, swap, remove };
}

export function useSettings() {
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api("/api/settings").then(setSettings).catch((e) => setError(e.message));
  }, []);
  const save = async (patch) => {
    const next = await api("/api/settings", { method: "PUT", body: patch });
    setSettings(next);
    return next;
  };
  return { settings, error, save };
}
