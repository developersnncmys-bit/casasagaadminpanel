// Web app manifest (served at /manifest.webmanifest) — lets the admin panel be installed as an
// app on phones and computers (Chrome / Edge "Install", Safari "Add to Home Screen")
export default function manifest() {
  return {
    name: "CasaSaga Admin",
    short_name: "CasaSaga",
    description: "Bookings, availability, calendar and website content for CasaSaga",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#4a1826",
    theme_color: "#4a1826",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
