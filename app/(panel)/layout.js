import AuthGuard from "@/components/AuthGuard";
import Sidebar from "@/components/Sidebar";

export default function PanelLayout({ children }) {
  return (
    <AuthGuard>
      <div className="shell">
        <Sidebar />
        <main className="content">{children}</main>
      </div>
    </AuthGuard>
  );
}
