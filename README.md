# Dua Dev — Internal tool

Internal outreach & operations tool for Dua Dev: track proposal outreach across European firms, see progress on a map, manage employees & contracts, and generate Angebots and invoices.

Built with **Next.js 16** (App Router, Server Actions) + **Supabase** (Postgres, Auth, Storage). Access is by invitation: a workspace admin adds members and chooses which pages each can read or edit.

## What's here

| Area | Status |
|---|---|
| Firms tracking (CRUD, search, filters, cascading country/state/city, status) | ✅ full |
| Overview (stats + interactive country map) | ✅ full |
| City completion tracking (auto + manual override) | ✅ full |
| Employees (roster, contact icons) | ✅ full |
| Contracts (data capture + document generation) | ✅ backend + UI — **generation needs your contract template**, see `templates/README.md` |
| Angebots (offers, auto numbering, line-item builder, auto-promotes firm to client when signed) | ✅ full, `.docx` generation working |
| Invoices (auto numbering, optional link to an Angebot, per-firm history) | ✅ full, `.docx` generation working |

## Stack & key decisions (from your answers)

- **Auth**: Supabase Auth, one login per person, restricted to whoever you add to the `app_users` table (CEO/CTO only — this is separate from the `employees` table, which is just HR data).
- **Documents**: generated in-app with [docxtemplater](https://docxtemplater.com/) from your real Angebot/Rechnung Word templates (see `templates/README.md`) — no Google account or API needed. Editing is a structured "builder" (firm, dates, line items) rather than a live Word-style editor, since that's more reliable than a free-tier rich text editor for this kind of merge-field document.
- **Design**: built directly in code (Tailwind, Dua Dev's navy/cyan brand pulled from dua-dev.com) rather than via Figma mockups. I wasn't able to pull your existing Figma draft into this pass — the Figma connection hit its plan's rate limit — so if anything here doesn't match what you had in mind visually, point me at specific screens and I'll adjust.
- **Countries/cities**: all 27 EU countries are built in as a static reference list (`src/lib/data/geo.ts` for the hand-curated core markets, `geo-generated.ts` for the rest) with real coordinates for the map. It covers every city and town of 15,000+ inhabitants (5,000+ for the smallest countries), from GeoNames. Regenerate with `npm run geo:build`; add individual towns by hand in `geo.ts` any time — no migration needed.

## Setup

### 1. Create a Supabase project

Create a project at [supabase.com](https://supabase.com), then in **Project Settings → API Keys** grab:
- Project URL
- **Publishable key** (Supabase's current name for the browser-safe key)

Copy `.env.example` to `.env.local` and fill both in (the secret key is needed for the Admin page — it creates member logins):

```bash
cp .env.example .env.local
```

### 2. Create / update the schema

In the Supabase dashboard open **SQL Editor**, paste the contents of `supabase/schema.sql` and run it.

It is **safe to re-run and safe on an existing project**: tables that exist are kept, missing columns are added,
old enum values are converted (`interested` → `negotiation`, offer `signed` → `accepted`), and functions, views,
triggers and policies are replaced with the current ones. Run it on a blank project, on a project that is a few
versions behind, or again after pulling changes — it never fails with "already exists".

`supabase/migrations/` holds the same changes as numbered steps for `supabase db push`. See what your live database
is missing at any time with `npm run db:diff`.

### 3. Create the workspace admin

Run `supabase/scripts/create_admin_saramalik.sql` (creates/promotes `saramalik@dua-dev.com` as the workspace **Admin**,
company role **CTO**), or on a blank project run `supabase/seed.sql`, which does the same and adds sample data.

### 4. Add members (User Management page)

Sign in as the admin and open **User Management** (`/user-management`) in the sidebar. There you add members with a **company role** (free text — CTO,
Designer, …), an **account role** (Admin or User) is fixed by the system, a temporary password, and per-page access:
**No access / Read only / Read & write** for each page. Pages a member can't open are hidden from their sidebar, and
the rules are enforced in the server actions *and* by the database (row level security). The User Management page itself can
never be granted to anyone but the admin. Members can be disabled, get a password reset, or be removed.

Member management needs the **secret key** in `.env` (`SUPABASE_SECRET_KEY`, server only — never exposed to the browser).

### 5. Outreach data (the two PDFs)

`supabase/seed.sql` (Parts 2 and 3) loads the real outreach data from the two PDFs in the project root:

| PDF | Firms | Emails sent |
|---|---|---|
| `Dua Dev UG-FirmContactList_DE_11092026.pdf` (lead-tracking register, S.No 1–1426) | 1,394 | 7 Aug – 14 Sep 2026 |
| `Dua Dev UG-FirmContactList_DE_11092026_1.pdf` (contact list, S.No 1427–1859) | 425 | 14 – 16 Sep 2026 |

That is 1,819 firms in Germany, Finland, Austria, the Netherlands, Belgium and Sweden across 202 cities. Firms are dated by the
day their email went out, so the timeline, recent activity and trends are real. Replies noted in the register set the status
(no interest → responded, offer sent → negotiation). A city is **in progress** automatically as soon as one of its firms has
been emailed; **completed** is set by hand — list those cities in `supabase/data/completed-cities.json`. The seed is safe to re-run.

To load a NEW list, put the PDF in the project root and run, in order:

```bash
npm run data:extract   # PDFs -> supabase/data/lead-register.json + firm-contact-list.json (needs: pip install pymupdf)
npm run data:import    # -> supabase/data/firms-import.json + any missing towns in src/lib/data/geo-custom.ts (prints what it matched/corrected)
npm run data:seed      # -> regenerates Parts 2 and 3 of supabase/seed.sql
npm run data:live      # dry run against your live database; add  -- --apply  to ADD the missing firms (never deletes)
```

`data:live -- --apply --replace` wipes firms/offers/invoices first (after saving a JSON backup) and reloads everything.

To add another person later, use the **Admin** page instead of SQL.

## Live updates

Every page updates by itself: the app listens to database changes (Supabase Realtime, enabled by `schema.sql` /
migration 0011) and refreshes the numbers when a firm, offer, invoice, etc. changes — plus once a minute and whenever
you return to the tab. All figures come straight from the database; nothing is hard-coded.

## Tests

```bash
npm test            # everything below
npm run test:unit   # permission model, password generator, redirect safety, rate limiter
npm run test:db     # runs the real migrations + schema.sql in an in-memory Postgres: RLS per role,
                    #   upgrade from every older schema state, re-running schema.sql, admin script
npm run test:live   # against YOUR Supabase project (needs .env): creates throwaway members, checks what
                    #   each can do, deletes them again
npm run db:diff     # what your live database is missing compared to the migrations and the app's types
npm run test:smoke  # with the app running (npm run dev): signs in as throwaway users and loads every page, looking for errors
```

Only accounts in `app_users` can sign in to the tool — everyone else gets rejected at login even with valid Supabase credentials.

### 6. Run it

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll land on `/login`.

### AI assistant and briefing

Set `OPENROUTER_KEY` (and optionally `OPENROUTER_MODEL`, default `anthropic/claude-haiku-5.5`) to turn on:

- **AI briefing** on the Overview page: a management summary with risks, wins and next steps, written from live data.
- **Dua Dev Assistant** (the "Ask AI" button next to each page title, or floating, or hidden: Settings -> AI assistant button, saved per account by `supabase/migrations/0012_assistant_placement.sql`). It answers questions from live data and can prepare changes (add a firm, update a firm/offer/invoice status, add an employee, set a city status, draft an offer). **Nothing is saved until the user clicks Confirm**, and every change goes through the same permission checks as the normal forms. It only sees pages the signed-in user can read.
- PDF export of offers and invoices converts the filled Word template through CloudConvert (`CLOUDCONVERT_API_KEY`).

### 7. Deploying

Any Node.js host works (Vercel, Railway, your own server). Set the same two env vars there. If you deploy somewhere serverless, `next.config.ts` already tells Next.js to bundle `/templates` with the functions that need it (`outputFileTracingIncludes`) — no extra config required.

## Adding the contract template

See `templates/README.md` — drop in `templates/contract-template.docx` with the listed tags and contract generation turns on automatically.

## Project structure

```
src/app/(app)/...        Authenticated pages (dashboard, firms, cities, employees, contracts, angebots, invoices)
src/app/login/            Public login page
src/components/           UI, organized by feature
src/lib/data/geo.ts       Country/state/city reference data + map coordinates
src/lib/documents/        docx generation (docxtemplater)
src/lib/supabase/         Supabase client/server/middleware helpers
supabase/migrations/      Database schema, RLS policies, storage bucket
templates/                The .docx merge templates (Angebot, Rechnung, contract)
```
