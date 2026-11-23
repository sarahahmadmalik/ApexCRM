# Apex CRM

An enterprise CRM and operations suite built with **Next.js 16**, **React 19**, **Tailwind CSS v4**, and **Supabase** (Auth, Postgres with RLS, and Storage). Designed as a complete agency & operations platform covering outbound sales, offers, invoicing, hiring/ATS, project delivery, employee time & leave self-service, payroll & expenses, and an AI workspace assistant.

---

## Core Modules

### Revenue & Outbound CRM
- **Dashboard**: Pipeline KPIs, revenue & outreach trend sparklines, stage distribution, and activity feed.
- **Pipeline & Firms**: End-to-end outbound CRM (`Lead` -> `Contacted` -> `Proposal` -> `Won` / `Lost`), firm profiles, city & market filtering, and call/email touchpoints.
- **Cities**: Territory management with company counts, active pipeline value, and market coverage.
- **Offers & Invoices**: Commercial proposal builder, line-item invoicing, status tracking (`Draft`, `Sent`, `Paid`, `Overdue`), and PDF generation (`@react-pdf/renderer`).

### Talent, Delivery & Operations
- **Hiring & ATS**: Job requisitions, Kanban/stage candidate tracking, and **resume upload & auto-extraction** (parses contact info, skills, and experience into candidate records with linked resume files).
- **Employees & Contracts**: Staff directory, role & compensation records, and digital employment contracts.
- **Projects & Tasks**: Project milestones, task boards, priority/status tracking, and team assignments.
- **Time & Leave**:
  - **Employee Portal**: Personal work timer, leave request submission (Annual, Sick, Remote, Unpaid) with approval status, and personal salary/payslip summary.
  - **Manager / Boss View**: Team timesheet oversight and one-click leave request approvals/rejections.
- **Expenses & Payroll**: Expense claim submissions, receipt tracking, approval workflows, and monthly payroll runs.

### Platform & AI
- **AI Assistant**: Workspace-aware assistant powered by OpenRouter with automatic silent fallback (`OPENROUTER_FALLBACK_KEY`) and dockable/floating placement.
- **Role-Based Access Control (RBAC)**: Distinct views and permissions for `Boss / Admin`, `Manager`, and `Employee` roles enforced via Supabase Auth and Row-Level Security (RLS).
- **Theme & Profile**: Light/dark/system theme toggle, profile avatar upload, and instant **Demo** role switcher on `/login`.

---

## Tech Stack

- **Framework**: Next.js 16 (App Router, Server Actions) + TypeScript
- **UI**: React 19, Tailwind CSS v4, Lucide Icons
- **Backend & Auth**: Supabase (`@supabase/supabase-js`, `@supabase/ssr`)
- **PDF Generation**: `@react-pdf/renderer`
- **AI**: OpenRouter API (with silent fallback key support)
- **Testing**: Vitest (unit tests) + Playwright (E2E)

---

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-or-publishable-key
SUPABASE_SECRET_KEY=your-supabase-service-role-key

# AI Assistant (OpenRouter)
OPENROUTER_KEY=sk-or-v1-...
OPENROUTER_FALLBACK_KEY=sk-or-v1-...
```

> **Note**: `.env.local` overrides `.env` locally without modifying shared defaults. If `OPENROUTER_KEY` fails or hits a rate limit, the assistant silently retries with `OPENROUTER_FALLBACK_KEY`.

### 3. Database Schema & Seed Data

Run the all-in-one setup script in your **Supabase SQL Editor**:

- [`supabase/sample-setup.sql`](supabase/sample-setup.sql) — Creates all schema tables, RLS policies, storage buckets, realistic CRM/HR/Projects/Time/Expenses seed data, and the 3 demo user accounts:
  - **Boss / Admin**: `demo@apexcrm.io` / `ApexDemo2026!` (`Alex Vance`)
  - **Manager**: `team@apexcrm.io` / `ApexTeam2026!` (`Maya Lin`)
  - **Employee**: `employee@apexcrm.io` / `ApexStaff2026!` (`Lukas Weber`)

Individual incremental migrations are also available in [`supabase/migrations/`](supabase/migrations/).

### 4. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and click **Demo** in the login header to sign in with any role immediately.

---

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npx next build --webpack` | Production build via Webpack (recommended on Windows) |
| `npm run lint` | Run ESLint |
| `npx tsc --noEmit` | TypeScript typecheck |
| `npm run test:unit` | Run Vitest unit tests |
| `npm run test:e2e` | Run Playwright end-to-end tests |
