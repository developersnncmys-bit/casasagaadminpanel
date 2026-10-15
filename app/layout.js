import { Cormorant_Garamond, Manrope } from "next/font/google";
import { ToastProvider } from "@/components/Toast";
import "./globals.css";

const serif = Cormorant_Garamond({ subsets: ["latin"], weight: ["400", "500", "600"], style: ["normal", "italic"], variable: "--font-serif" });
const sans = Manrope({ subsets: ["latin"], variable: "--font-sans" });

export const metadata = {
  title: { default: "CasaSaga Admin", template: "%s · CasaSaga Admin" },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      {/* Browser extensions (e.g. ColorZilla's cz-shortcut-listen) add attributes to <body> before React loads */}
      <body suppressHydrationWarning>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
