import { Suspense } from "react";
import LoginForm from "./LoginForm";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="login">
      <div className="login-card">
        <img src="/logo.png" alt="CasaSaga" className="logo logo-lg" />
        <p className="eyebrow">Admin panel</p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
