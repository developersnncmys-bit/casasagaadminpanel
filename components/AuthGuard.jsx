"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, getToken } from "@/lib/api";
import { Loading } from "./ui";

const AdminContext = createContext(null);
// The signed-in admin ({ name, email, lastLoginAt }) for any panel component
export const useAdmin = () => useContext(AdminContext);

// Panel pages only render for a signed-in admin; the token is checked with the backend once per visit
export default function AuthGuard({ children }) {
  const router = useRouter();
  const path = usePathname();
  const [admin, setAdmin] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!getToken()) {
      router.replace(path === "/" ? "/login" : `/login?next=${encodeURIComponent(path)}`);
      return;
    }
    api("/api/auth/me")
      .then(setAdmin)
      .catch((e) => setError(e.message));
    // Only on first load — later 401s are handled by api()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!admin) return <Loading error={error} />;
  return <AdminContext.Provider value={admin}>{children}</AdminContext.Provider>;
}
