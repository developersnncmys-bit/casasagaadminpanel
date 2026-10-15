"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, getToken } from "@/lib/api";
import { Loading } from "./ui";

// Panel pages only render for a signed-in admin; the token is checked with the backend once per visit
export default function AuthGuard({ children }) {
  const router = useRouter();
  const path = usePathname();
  const [state, setState] = useState("checking");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!getToken()) {
      router.replace(path === "/" ? "/login" : `/login?next=${encodeURIComponent(path)}`);
      return;
    }
    api("/api/auth/me")
      .then(() => setState("ok"))
      .catch((e) => setError(e.message));
    // Only on first load — later 401s are handled by api()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state !== "ok") return <Loading error={error} />;
  return children;
}
