# Vault

A personal vault organized into modules (Reminders, Finance, Bills, Subscriptions, Vehicles, Documents, Health, …), with all data stored as JSON in a folder of your own Google Drive. There is no backend: the app runs in the browser and talks directly to the Drive API.

## Stack

- React + Vite + TypeScript
- Tailwind CSS v4 + shadcn/ui (layout based on the `dashboard-01` block), charts with Recharts
- Google Identity Services (sign-in) + Drive API v3 (storage), `drive.file` scope

## Modules

Modules are fixed and defined in code. Currently:

- **Início** — the landing page. Greets you, shows a month calendar with every dated thing across modules (reminders in their color, including each repetition, with multi-day periods drawn as one bar across the days they cover and stacked when they overlap; bills with paid/overdue state; subscription charges; document expiries, insurance ends, health follow-ups, investment maturities), and a side panel with what needs attention across every module (overdue bills, expired or expiring documents, insurance to renew, upcoming follow-ups, stale balances, due reminders), the selected day's items and an agenda of the next 30 days. Reminders can be marked done right from the list.
- **Reminders** — for what isn't a bill or a subscription: one-time, or repeating every N days, weeks (on chosen weekdays), months or years from a start date, with an optional end date: repeating reminders stop after it, and a one-time reminder with one becomes a period (a trip, a stay) that covers every day in between. Each reminder can have a color from a fixed palette, used on the calendar and as a dot in the list. Each occurrence can be marked done (with undo) or snoozed by a day or a week, and a reminder can start asking for attention up to a month ahead. Only the latest missed occurrence is shown, so a daily reminder never piles up. Repeating reminders can be ended and reactivated; done one-time and ended ones move to "Concluídos". Clicking one, here or on the home calendar, opens its details, with Concluir and Editar.
- **Notes** — Markdown notes in folders. The editor (Tiptap) is visual but reads and writes plain Markdown: headings, bold/italic/strike, links, lists, checklists, quotes, code, tables and images. There is no toolbar: formatting comes from typing Markdown (`# `, `- `, `1. `, `[ ] `, `> `, ```` ``` ````, `**bold**`, `[text](url)`) or Tiptap's shortcuts (⌘B, ⌘I, ⌘⇧S, ⌘E, ⌘⌥1–3, ⌘⇧7/8/9, ⌘⇧B, ⌘⌥C, and ⌘⌥T for a 3×3 table, where Tab moves between cells and adds a row from the last one); pasting a URL over selected text links it. Pasting Markdown text formats it; pasting or dropping an image uploads it to `attachments/` and writes `![name](attachment:<fileId>)`. Notes save themselves while you type, and a save is refused (with a choice of which version to keep) when the note changed on another device since it was opened. Folders can be nested, renamed, moved and deleted with their contents; `.md` files can be imported into any folder. A "Ler" button switches to reading mode (nothing editable, links clickable), remembered on the device until "Editar". Notes stay readable offline (see below).
- **Reading** — a library of PDF and EPUB books, each stored in `attachments/` (up to 200 MB; files over 20 MB go up with a resumable upload). Opening one (`#/reading/<id>`) shows a single paginated reader built on foliate-js: swipe on phones, arrows or ← → to turn pages. EPUBs reflow (two columns on wide screens) and show the percentage and current chapter, with a font size remembered on the device; scripts inside them never run, since each chapter is cleaned of scripts, event handlers and `javascript:` links before it renders. PDFs go through an adapter over pdf.js (based on foliate-js's experimental one) and show one page at a time with "Pág. N de M", fitting the page or its width (remembered on the device); text can be selected, links inside the PDF aren't clickable. On first open an EPUB's own title and author replace the file name. The position (a CFI and the percentage) is saved to Drive a couple of seconds after it changes and when you leave, so the book reopens there on any device. Each book is downloaded once per device and kept in the browser's private file storage (OPFS), so it opens right away and offline; the readers read it from disk in pieces instead of loading it whole. Up to 1 GB is kept, removing the least recently opened books first; cards mark the books on the device, "Remover do aparelho" frees one, and copies of books removed elsewhere, and everything on sign-out, are deleted. The library is kept on the device too, and a position saved offline goes to Drive on the next load with a connection. Books can be renamed or removed (the file goes to the Drive trash). foliate-js loads only when a book is opened, and pdf.js only for PDFs.
- **Finance** — accounts by institution (bank, brokerage, crypto…), each with a history of dated balances. Net worth is the sum of every account's latest balance; the chart shows how it evolved over time. An "Investimentos" tab tracks each application (CDB, LCI, LCA, Tesouro…) with amount, rate, dates and maturity, warns before it matures and computes the return (total and annualized) on redemption. Investments are a detail of the balances and never add to net worth.
- **Bills** (a tab inside Contas, `#/bills/list`) — bills with varying amounts (rent, condo, electricity, water, gas, credit card statement, taxes…), due monthly, bimonthly, quarterly, semiannually, yearly or just once: due day, payment method and an estimate per bill, then each due month's real amount, payment date and boleto/statement file. Less frequent bills repeat every cycle from their first due month. A month selector shows what's paid, pending or overdue, and each bill has a chart and average of its last 12 months (or last 12 due dates).
- **Cards** (a tab inside Contas, `#/bills/cards`) — credit cards are bills of category "Fatura do cartão" with extra details in `bills.json` (bank, last 4 digits only, limit, closing day), so each statement shows on the home agenda (Contas itself lists only the other bills). Cartões opens on each card's open statement (the one today's purchases go to); the month arrows browse earlier and later ones. Each card shows that statement (amount, paid or pending, pay/enter/history), the previous one while it is still to pay (with a Pagar button), its limit and the subscriptions charged to it (`cardId`) with their monthly total. Selecting a card opens a table of the expenses in that month's statement, subscriptions included, with a total per category (Supermercado, Transporte, Carro, Comida, Pet…; bills can use the same ones). Purchases (Mercado Livre, AliExpress…) can be added to a card, with a category, paid in full or in installments: each falls in a statement worked out from the closing and due days (adjustable), and until the real amount is entered the statement shows at least what its purchases and the subscriptions charged in it add up to. The full number, CVV or password are never stored.
- **Month summary** (the first tab in Contas, `#/bills`) — what the month costs: bills, card purchases made in it (installments one per month from the purchase date, plus any unregistered part of a statement) and subscriptions, with the total, a breakdown by category and a table of every expense.
- **Subscriptions** (a tab inside Contas, `#/bills/subscriptions`; its own `data/subscriptions.json`) — recurring charges (streaming, internet, insurance, gym, utilities…) with amount, billing cycle (monthly, quarterly, semiannual, yearly), first charge date and payment method. Shows the next charge of each one, monthly and yearly totals, a breakdown by category, and keeps cancelled ones for history.
- **Vehicles** — vehicle registry (plate, renavam, chassis…) and maintenance history: services, repairs and part replacements, with odometer, workshop, labor, parts and an optional invoice (nota fiscal) file. The current odometer is the highest reading recorded, from a service or a standalone reading. Each vehicle also keeps its insurance policies (insurer, policy number, period, premium and installments, deductible, coverages, 24h assistance phone, PDF), with a renewal reminder two months before the end and past policies kept as history.
- **Documents** — ID cards, driver's license, passport, certificates, insurance… per person, with number, issuer, issue and expiry dates, and photos/PDFs stored in the Drive `attachments/` folder. Expired documents and those expiring within 90 days are highlighted. Each person also has a "Dados pessoais" card (full name, CPF, birth, parents, passport, address, phone, e-mail and custom fields) with a copy button on every field and a one-line "Copiar endereço".
- **Health** — per person: an emergency profile (blood type, allergies, conditions, health insurance, emergency contact), medications in use with dosage and schedule, and a history of appointments, exams, vaccines and procedures with attached results and follow-up / next-dose dates.
- **Cameras** — live view of home cameras. The browser can't play a camera's RTSP stream, so a go2rtc bridge on a machine at home serves it over HTTPS through a Cloudflare Tunnel guarded by Cloudflare Access (see [bridge/README.md](bridge/README.md)). Each camera stores only the bridge address and stream name; the camera's password stays on the bridge.

To add a module:

1. Create `src/modules/<id>/` with an `index.ts` exporting a `VaultModule` (`id`, `name`, `icon`, `Screen`).
2. Register it in `src/modules/index.ts`. It shows up in the sidebar and at `#/<id>`; sub-routes (`#/<id>/...`) reach the screen through the `path` prop.
3. In the screen, call `useCollection('<id>', EMPTY)` to read and write `data/<id>.json`. `EMPTY` defines the module's lists (e.g. `{ accounts: [], balances: [] }`); lists added later need no migration. For files, `useAttachments('<id>')` uploads to and trashes from `attachments/`, and `<AttachmentGrid>` / `<AttachmentPicker>` render them.

**Search** — ⌘K / Ctrl+K (or "Buscar" in the sidebar, the magnifier in the header on phones) searches every module at once: documents (showing their number), accounts, investments, bills, subscriptions, vehicles and their services and insurance (plate, chassis, policy number, part names), and health records. Matching ignores case and accents, and every typed word must match.

**Hide values** — the eye in the header masks every amount (balances, bills, subscriptions, insurance, services) as "R$ ••••", for opening the app next to someone. It stays on until you tap it again, also after reopening the app (stored in the browser, per device).

Code, file names, routes and stored values are in English; UI text is in Brazilian Portuguese.

## Drive layout

```
db-vault/
  data/
    finance.json    ← one file per module
    bills.json
    reminders.json
    subscriptions.json
    vehicles.json
    documents.json
    health.json
    reading.json
  attachments/      ← uploaded files (images, PDFs), tagged with the owning module
  notes/
    <id>.md         ← one Markdown file per note; the folder tree and titles are in data/notes.json

backup-db-vault/
  2026-10-24 14h30/ ← one folder per backup
    finance.json
    …
    <id>.md         ← every note
```

Every file is tagged with `appProperties.vault` (`root`, `data`, `attachments`, `collection`), so the app finds them by query rather than by name: renaming or moving the folder doesn't break anything. With the `drive.file` scope the app only sees files it created itself.

## Backup

The **Backup** item at the bottom of the sidebar:

- **Fazer backup no Drive** copies every module's JSON file and every note (server-side, nothing is downloaded) into a new `backup-db-vault/<date time>/` folder at the root of your Drive. Attachments aren't copied: the app never overwrites them, it only moves removed ones to the trash.
- **Baixar cópia (.json)** downloads a single JSON file with every module's data and every note's Markdown, for an offline copy that doesn't depend on your Google account.
- **Restore**, from any backup in the list or from a downloaded `.json`, replaces the data of the modules present in the backup (other modules are left untouched). A restore overwrites instead of merging, since merging keeps the newest version of each item and an older backup would never win. Before restoring, the app automatically backs up the current state, so a restore can always be undone. Records that point to attachments removed after the backup may need those files restored from the Drive trash.

Removing a file from a record moves it to the Drive trash (recoverable for 30 days); nothing is deleted outright.

Every write is **read → merge → write**: each item has an `id`, `updatedAt` and `deleted` flag, and the most recent `updatedAt` wins. Editing from two devices never overwrites the other's changes. Money is stored in cents (integers).

## Code

```
src/
  auth/            Google sign-in (1h access token), session context
  domain/          base types (Syncable) and merge
  storage/         DriveClient (REST), Vault (Drive layout), VaultProvider, useCollection
  modules/         one folder per module + registry (index.ts)
  components/      dashboard layout (sidebar, header) and shadcn components in ui/
  lib/             shared helpers (formatting money, dates, km)
  screens/         sign-in screen
```

## Google Cloud setup (once)

1. Go to <https://console.cloud.google.com/> and create a project (e.g. `vault`).
2. **APIs & Services → Library** → enable the **Google Drive API**.
3. **Google Auth Platform → Get started**: app name, support email, audience **External**, contact email.
4. **Audience → Test users**: add the Google accounts allowed to sign in.
   - The app stays in **Testing** mode, so Google itself blocks any account that isn't on this list.
   - Publishing to production would let any Google account sign in (each one only sees its own Drive). It also requires a home page and privacy policy on a verified domain.
5. **Clients → Create client** → type **Web application**:
   - **Authorized JavaScript origins**: `http://localhost:5180` and the production URL.
   - **Authorized redirect URIs**: the same URLs with a trailing slash (`http://localhost:5180/`, `https://<your-domain>/`), used by the installed app's sign-in. The client secret is not used.
6. Copy the **Client ID** into `.env.local`:

   ```
   VITE_GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
   ```

The Client ID is public by design (it ships in the browser bundle); it grants nothing on its own.

## Running locally

```bash
npm install
npm run dev
```

The dev server runs on port 5180 (fixed, since it must match the OAuth origins).

## Installable app (PWA)

On the phone, open the site and use **Compartilhar → Adicionar à Tela de Início** (iPhone, Safari) or **⋮ → Instalar app** (Android, Chrome). It opens full screen like an app.

- **Offline app shell:** `public/sw.js` caches the page, bundles, fonts and icons, so the app opens without internet (pages network-first, hashed assets cache-first, old bundles pruned). Drive data needs a connection, and a banner says so when offline.
- **Offline notes (read-only):** notes are the one exception. Each time the Notes screen loads from Drive, the tree and every note changed since the last visit are copied to the device's IndexedDB (`src/lib/offline-store.ts`); images are copied once opened. Offline, the app opens even with an expired session and shows notes from that copy, without editing. The copy is tagged with the account and erased on sign-out.
- **Sign-in in the installed app** uses a full-page redirect to Google instead of the popup (unreliable in standalone mode, especially on iOS). The OAuth client needs `<origin>/` as an **Authorized redirect URI** (e.g. `https://your-domain.com/` and `http://localhost:5180/`). The `state` parameter is checked on return and the token is removed from the address bar.
- The service worker only registers in production builds; test it with `npm run build && npm run preview`.

## Deploy

Static site (`npm run build` → `dist/`), deployed on Vercel. Set `VITE_GOOGLE_CLIENT_ID` as a **Config** (non-secret) environment variable and redeploy: Vite inlines it at build time. Add the production URL to the OAuth client's authorized origins.

See [CHANGELOG.md](CHANGELOG.md) for release history.
