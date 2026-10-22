# CasaSaga Admin Panel

Next.js admin panel for the CasaSaga website. It manages bookings, enquiries and everything the website shows.

- **API:** [casasagabackend](https://github.com/developersnncmys-bit/casasagabackend) (Node.js + Express + MongoDB), live at https://api.casasaga.in
- **Website:** `casasagawebsite`, which reads its content from the same API

## Run it

```bash
npm install
cp .env.example .env.local   # point NEXT_PUBLIC_API_URL at the API
npm run dev                  # http://localhost:3001
```

Sign in with the admin account created by the backend's seed (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in the backend's `.env`).

| Variable | |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | The API: `https://api.casasaga.in`, or `http://localhost:5000` for a local backend |
| `NEXT_PUBLIC_SITE_URL` | The website (default `https://casasagawebsite.vercel.app`). Its images (`/images/...`) are shown from here, and "View website" links to it. Use `http://localhost:3000` when running the website locally |

## Pages

| Page | What it does |
| --- | --- |
| Dashboard | Pending requests, revenue and nights this month, arrivals in the next 7 days, where bookings come from |
| Bookings | Click a booking for everything about it: guest, stay, add-ons with prices, bill, payment, notes, timeline. **Confirm → Check in → Check out** (check-out can mark the balance paid), cancel, re-open, edit, WhatsApp or call the guest, and **download an invoice PDF** with a sequential number |
| Availability | Two weeks of rooms per suite: stays as bars for one-room suites, rooms free for multi-room suites, tonight's summary |
| Calendar | Month view of every stay; click a booking to open it, or a day to see arrivals, stays and departures |
| Suites | Name, theme, price, **rooms of this type** (inventory), descriptions, highlights, amenities, photos, order, show/hide |
| Add-ons | Decoration packages, with a price or "on request", photo, order, show/hide |
| Gallery | Website gallery photos and videos by category, bulk upload |
| Contact & policies | Phone, WhatsApp, address, map, house policies, occasions, gallery categories, About-page values, and **invoice details** (business name, GSTIN, default GST %, number prefix, thank-you note) |

Changes to website content show on the site straight away. The API tells the website to refresh.

## How it works

- **Auth:** `POST /api/auth/login` returns a JWT, kept in `localStorage`. `components/AuthGuard.jsx` protects every page, and any `401` signs the admin out.
- **Data:** `lib/api.js` holds `api()`, `useCollection()` and `useSettings()`. Every response is `{ success, data | message }`.
- **Images:** uploads go to `POST /api/uploads` and are stored in MongoDB by the API.
- **Invoices:** `lib/invoice.js` builds the PDF in the browser with jsPDF. Amounts print as "Rs." because the PDF's built-in fonts have no ₹ glyph.
- **Availability:** pending, confirmed and checked-in bookings each hold a room. The API refuses a booking once any night of the stay is full.

## Scripts

`npm run dev` (port 3001) · `npm run build` · `npm start` (port 3001)
