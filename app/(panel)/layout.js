import AuthGuard from "@/components/AuthGuard";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

export default function PanelLayout({ children }) {
  return (
    <AuthGuard>
      <div className="shell">
        <Sidebar />
        <div className="main-col">
          <Topbar />
          <main className="content">{children}</main>
        </div>
      </div>
    </AuthGuard>
  );
}
