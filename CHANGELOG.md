# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.4.0] - 2026-11-03

### Added
- Month summary (Contas › Resumo, `#/bills`): everything spent in the month in one place: bills, card purchases and subscriptions. Shows the total, the share of each, a breakdown by category (bill and purchase categories together) and a table of every expense with where it was paid. Card purchases count in the month they were made (installments one per month from the purchase date), and the part of a statement not covered by its purchases shows as "Gastos não lançados" in the month most of that statement was spent.

### Changed
- Resumo is the first tab and what Contas opens (`#/bills`); the bills list moved to `#/bills/list`. Bills on the home calendar and in search open Contas or Cartões.
- Contas (now `#/bills/list`) no longer lists card statements or counts them in its totals; they stay in Cartões (to pay them) and in Resumo.

## [0.3.0] - 2026-11-01

### Added
- Subscriptions charged to a card now count in its statements: each charge falls in the statement of its date, the estimate is at least what purchases and subscriptions add up to (the "Fatura média" is not added on top), and they show in the card's table.
- Card expenses: selecting a card in Contas › Cartões opens a table of its purchases in that month's statement, with date, category, installment and amount, plus a total per category. Purchases now have a category (Carro, Comida, Pet, Casa, Saúde, Lazer, Viagem, Compras, Outros); ones saved earlier show as "Outros".
- Card purchases in Contas › Cartões: add a purchase to a card with description, total, date and installments. It falls in the right statement from the closing and due days (adjustable), each installment shows in its own month ("3/10"), and until the real amount is entered the statement shows at least what its purchases add up to.
- Reminder details dialog: clicking a reminder in Lembretes, or on the home calendar and lists, shows its schedule, date, status, heads-up and notes, with Concluir and Editar. Editing stays one click away instead of being the first thing that opens.
- Reminder colors: pick one of eight colors (or none) in the reminder form. The calendar shows the reminder in that color, as does the dot next to its title in the list and in the agenda.
- Periods on the calendar: a reminder with a start and an end is drawn as one bar across the days it covers, named at its start and again at the start of each week it continues into; overlapping periods stack. Phones show a thin colored line. Busy weeks grow taller instead of clipping.
- Reading mode for notes: a "Ler" / "Editar" button next to the title locks the note for viewing only (links open, checklists don't toggle). The choice is remembered on the device.
- Tables in notes: pasted Markdown tables become real tables and are saved back as Markdown tables; ⌘⌥T inserts a new 3×3 table.
- Month calendar on Início, in place of the summary cards: reminders (every repetition, and multi-day periods), bills (paid, pending, overdue), subscription charges, document expiries, insurance ends, health follow-ups and investment maturities. A side panel holds "Precisa de atenção", the selected day's items and the next 30 days (which used to be separate cards below); On wide screens the calendar fills the rest of the screen's height and the panel scrolls within it; on phones the panel sits below the calendar. Titles show in the cells on wide screens and dots on phones. Only the occurrence a reminder is waiting on shows as late.
- End date on reminders: repeating reminders stop repeating after it; a one-time reminder with one spans every day up to it, and is late only after its last day.
- **Notes** module: Markdown notes in nested folders, edited in a Tiptap editor that reads and writes plain Markdown (headings, emphasis, links, lists, checklists, quotes, code, images). Each note is its own `notes/<id>.md` file on Drive; the tree and titles live in `notes.json`. Autosave while typing, a conflict prompt when the note changed on another device, pasted Markdown formatted on paste, pasted or dropped images uploaded as attachments, `.md` import into any folder, and notes in the global search.
- Offline reading of notes: the tree and every note are copied to IndexedDB in the background (images once opened). Offline, the app opens even with an expired session and shows notes read-only. The copy is tied to the account and erased on sign-out.
- Backups (on Drive and the downloaded `.json`) include every note, and restoring brings them back.
- Cartões tab inside Contas: credit cards with bank, last 4 digits, limit, closing and due day; the month's statement (pay, enter, history) and the subscriptions charged to each card with their monthly total. Cards are bills, so statements show in Contas and Início. Subscriptions pick the card from a list (or "Outra forma").
- **Reminders** module for things that aren't bills: one-time or repeating daily, weekly (chosen weekdays), monthly or yearly, every N units, from a start date. Per-occurrence done (with an undo toast) and snooze by a day or a week, a heads-up from the day itself up to a month before, end/reactivate for repeating ones and a "Concluídos" tab. Only the latest missed occurrence is listed.
- Reminders on the Início page (in the agenda, and in "Precisa de atenção" from their heads-up day, with a button to mark them done there) and in the global search.
- Bill frequency: besides monthly, bills can be bimonthly, quarterly, semiannual, yearly (IPTU, IPVA…) or one-off ("Avulsa"). They show up only in their due months, counted from the first one; existing bills stay monthly. The schedule (e.g. "trimestral · dia 10 (jan, abr, jul, out)") shows in the history dialog and search, and the history chart covers the last 12 due dates.
- Hide values: an eye button in the header masks every amount across modules as "R$ ••••" and remembers the choice on the device.
- Personal data card in Documents, per person: identification (full name, CPF, birth date and place, parents, marital status, nationality, passport with expiry), address and contact, custom fields and notes. Every field has a copy button, the address can be copied as a single formatted line, empty sections are hidden, and the data is indexed by the global search. Person tabs now default to you.
- Optional invoice (nota fiscal) on vehicle maintenance records: attach PDFs or photos in the service form, with a paperclip in the history table. Files go to the Drive trash when removed or when the service or vehicle is deleted.
- App icon (white vault on black), favicon and a web app manifest.
- Installable PWA: standalone display, iOS meta tags and a hand-written service worker that keeps the app shell (page, bundles, fonts, icons) available offline. Drive data is never cached; an offline banner explains why data doesn't load.
- Redirect sign-in for the installed app (the Google popup is unreliable in standalone mode): full-page OAuth implicit flow with `state` verification, token removed from the URL, previous route restored, errors shown on the sign-in screen.
- Global search (⌘K / Ctrl+K, a "Buscar" button in the sidebar and a header button on phones) across every module: documents with their number, accounts, investments, bills, subscriptions, vehicles, services (including part names), insurance policies and health records. Accent- and case-insensitive, all words must match; picking a document opens it directly (`#/documents/<id>`).
- Investments inside Finance: applications (CDB, LCI, LCA, Tesouro, funds, stocks, crypto…) with institution, amount, rate, investment date and maturity; "Investimentos" and "Resgatados" tabs; a summary of the active amount, what matures within 30 days and the realized return; and a redemption dialog that shows the return in money, for the period and annualized. They don't add to net worth, since balances already include them.
- Investment maturities on the Início page: in the agenda within 30 days, and in "Precisa de atenção" within a week or once matured without a redemption.
- **Início** landing page: greeting, net worth, fixed monthly spending, amount left to pay this month, a "Precisa de atenção" list gathered from every module (overdue and soon-due bills, expired or expiring documents, insurance to renew, health follow-ups within a week, balances not updated for 30 days) and a 30-day agenda including subscription charges. Each item links to its module.
- **Bills** module for monthly bills with varying amounts: name, category, due day (clamped to short months), payment method, estimate, first/last month and notes. Each month gets an entry with the real amount, due date, payment date, notes and attached boleto/statement.
- Month view with a month selector, totals (month, paid, to pay, next due), a paid / pending / overdue status per bill, "Marcar como paga", undo, and a per-bill history dialog with a 12-month bar chart, average and highest amount. Bills can be ended (kept as history) or deleted.
- Car insurance inside each vehicle: insurer, policy number, broker, coverage period, premium and installments, deductible, coverages, 24h assistance phone (tap to call), notes and attached files. A renewal reminder shows two months before the end, "Renovar" prefills the next policy, and past policies stay listed as history.
- Backup: a sidebar entry opens a dialog that copies every collection file into `backup-db-vault/<YYYY-MM-DD HHhMM>/` on Drive (server-side copy), lists recent backups with links, and downloads a single JSON export of all data.
- Restore from a Drive backup or a downloaded `.json` export. It overwrites the modules present in the backup, takes an automatic backup of the current state first, and reloads the app.
- **Subscriptions** module: recurring charges with category, amount, billing cycle (monthly, quarterly, semiannual, yearly), first charge date, payment method, management link and notes. The next charge is computed from the first charge date (month-end dates clamp to shorter months).
- Subscription summary: monthly and yearly totals, next charge, charges due in the next 30 days, spending by category and an upcoming-charges list. Cancelled subscriptions leave the totals but stay in a "Canceladas" tab and can be reactivated.
- **Health** module, organized by person: emergency profile (birth date, blood type, allergies, conditions, health insurance with card number, emergency contact), medications in use (dosage, frequency, start/end, "stop today"), and a history of appointments, exams, vaccines and procedures with provider, specialty, cost, notes, attached files and a follow-up / next-dose date.
- Health summary cards: appointments and exams this year, next scheduled follow-up and medications in use.
- **Documents** module: personal documents (ID, CPF, driver's license, passport, voter ID, certificates, insurance, other) per person, with number, issuer, issue and expiry dates, notes and attached files.
- Expiry tracking: expired documents and those expiring within 90 days are flagged in the table and summary cards.
- Owner tabs to filter documents by person, and one-click copy of the document number.
- File attachments stored in the Drive `attachments/` folder: upload (images and PDFs, up to 20 MB), thumbnails, open in a new tab, and removal to the Drive trash. Reusable by any module through `useAttachments`, `AttachmentGrid` and `AttachmentPicker`.
- This changelog.

### Removed
- Unused Vite template assets (`icons.svg`, Vite favicon).

### Fixed
- ⌘B / Ctrl+B no longer toggles the sidebar while typing in a text field or the notes editor, so it can make text bold.

### Changed
- Notes editor: the formatting toolbar is gone; formatting comes from Markdown typed inline and keyboard shortcuts, and images are added by pasting or dropping them.
- Assinaturas moved into Contas as a second tab (Contas | Assinaturas, `#/bills/subscriptions`), one sidebar entry less. Data stays in its own file; search and backups still list it as Assinaturas.
- Subscriptions no longer offer the "Casa (luz, água, gás)" category; those bills belong in Contas. Existing entries with it show as "Outros".
- README rewritten in English, with the Google Cloud setup matching the current configuration (Testing mode with test users).
- Shared `Field` form component moved to `src/components/form-field.tsx`.
- Expiry status and badge shared in `src/lib/expiry.ts` and `src/components/expiry-badge.tsx`; pending-upload file list shared as `PendingFileList`.

## [0.2.0] - 2026-10-24

### Added
- Card expenses: selecting a card in Contas › Cartões opens a table of its purchases in that month's statement, with date, category, installment and amount, plus a total per category. Purchases now have a category (Carro, Comida, Pet, Casa, Saúde, Lazer, Viagem, Compras, Outros); ones saved earlier show as "Outros".
- **Vehicles** module: vehicle registry (brand, model, year, plate, color, renavam, chassis, notes) and a page per vehicle at `#/vehicles/<id>`.
- Maintenance history per vehicle: date, odometer, type (service, part replacement, repair, other), description, workshop, labor cost, parts with quantity and unit price, and notes. Totals are computed automatically.
- Standalone odometer readings. The current odometer is the highest value from services or readings.
- Vehicle summary cards: current odometer, total spent, spent this year and last service.
- Hash routing with sub-routes, passed to module screens as `path`.
- Breadcrumbs in the page header.

### Changed
- Code structure renamed to English: `finance` and `vehicles` modules (hooks, screens, types), route slugs (`#/finance`, `#/vehicles`), data files (`data/finance.json`, `data/vehicles.json`) and stored enum values (e.g. `checking`, `investment`, `car`, `service`).
- Shared money, date and odometer formatting helpers moved to `src/lib/format.ts`.
- The Drive attachments folder is created as `attachments` instead of `anexos`.

## [0.1.1] - 2026-10-24

### Changed
- The Drive root folder is created as `db-vault` instead of `Vault`.

## [0.1.0] - 2026-10-24

### Added
- Card expenses: selecting a card in Contas › Cartões opens a table of its purchases in that month's statement, with date, category, installment and amount, plus a total per category. Purchases now have a category (Carro, Comida, Pet, Casa, Saúde, Lazer, Viagem, Compras, Outros); ones saved earlier show as "Outros".
- Personal vault single-page app with no backend (React, Vite, TypeScript, Tailwind CSS v4, shadcn/ui).
- Google sign-in with Google Identity Services, `drive.file` scope and a reconnect flow when the 1-hour token expires.
- Google Drive as the database: a root folder with one JSON file per module, found through `appProperties`.
- Read-merge-write sync per item (`id`, `updatedAt`, `deleted`), so edits from different devices don't overwrite each other.
- Code-defined modules with hash routing and a dashboard layout (sidebar, header) based on shadcn `dashboard-01`.
- **Finance** module: accounts by institution, dated balance history, summary cards (net worth, 30-day and month-to-date change, largest institution, account count), net worth chart and accounts table.

