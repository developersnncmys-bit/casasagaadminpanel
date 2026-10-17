"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Icon from "@/components/Icon";
import { api, setToken } from "@/lib/api";
import { checkEmail } from "@/lib/validate";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const problem = checkEmail(form.email, { required: true }) || (!form.password ? "Enter your password." : "");
    if (problem) return setError(problem);
    setBusy(true);
    setError("");
    try {
      const { token } = await api("/api/auth/login", { method: "POST", body: form });
      setToken(token);
      const next = params.get("next");
      router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="login-form" noValidate>
      <label className="field">
        <span className="field-label">Email</span>
        <input type="email" autoComplete="username" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </label>
      <div className="field">
        <label className="field-label" htmlFor="password">Password</label>
        <div className="password-wrap">
          <input
            id="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <button
            type="button"
            className="password-toggle"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide password" : "Show password"}
            aria-pressed={show}
            title={show ? "Hide password" : "Show password"}
          >
            <Icon name={show ? "eyeOff" : "eye"} size={18} />
          </button>
        </div>
      </div>
      {error && <p className="error-text">{error}</p>}
      <button className="btn btn-gold btn-block" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
