# Lead Intake System

A small full-stack lead intake application built with Next.js, Supabase, and TypeScript. Users can submit leads through a public form, leads are persisted to Postgres, and each submission is forwarded to an external webhook for downstream processing.

- **Live app:** https://lead-intake-system-pearl-rho.vercel.app/
- **Repo:** https://github.com/rebeccarwang/lead-intake-system

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS v4
- Supabase (Postgres)
- Deployed on Vercel

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Lead form with client-side validation. |
| `/leads` | Server-rendered table of all leads, newest first. |
| `/api/leads` (POST) | Validates input, inserts the lead, calls the webhook, records the webhook outcome. |

## Running locally

### 1. Install

```bash
git clone https://github.com/rebeccarwang/lead-intake-system.git
cd lead-intake-system
npm install
```

### 2. Set up Supabase

Create a Supabase project and run this in the SQL editor:

```sql
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null unique,
  company text,
  source text not null,
  check (source in ('Google', 'Referral', 'Social', 'Other')),
  message text,
  webhook_status text not null default 'pending',
  webhook_error text,
  created_at timestamptz not null default now()
);

alter table public.leads enable row level security;

grant select, insert, update on public.leads to service_role;
```

RLS is enabled with no policies for `anon`, so anonymous clients can't read or write the table. All access happens server-side via the service role key.

### 3. Environment variables

Create `.env.local` in the project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role key from Project Settings → API>
WEBHOOK_URL=<URL the API route forwards each lead to>
```

| Variable | Notes |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret** — server-only. Bypasses RLS, so never expose it to the client. |
| `WEBHOOK_URL` | Endpoint each new lead is forwarded to. If unset, leads are still saved but recorded with a `webhook_error` so they can be retried. |

When deploying to Vercel, set all three in the project's environment variables — `SUPABASE_SERVICE_ROLE_KEY` and `WEBHOOK_URL` should not be exposed to the browser.

### 4. Run

```bash
npm run dev
```

Open <http://localhost:3000> for the form and <http://localhost:3000/leads> for the leads list.

## Design notes

- **All Supabase access is server-side**, using the service role key. The browser never sees a Supabase key, which makes it impossible for an anonymous client to query `leads` directly.
- **Validation happens on both sides.** Client-side validation provides fast feedback in the UI; the API route re-validates everything before touching the database — the server is the real boundary.
- **Webhook is a side effect.** The lead is saved first, then forwarded to the webhook. If the webhook fails (or times out), the user still gets a successful response and the failure is logged and recorded on the lead row in the database (`webhook_status`, `webhook_error`).
- **Timeouts.** Supabase calls and the webhook fetch all use a 10-second `AbortSignal.timeout` so a hung dependency can't pin the function open.
- **Webhook payload is minimal.** Only `full_name`, `email`, `company`, `source`, and `message` are forwarded, not the full DB row.

## Things to know

- Duplicate emails return `409`, driven by the `unique` constraint on `email`.
- `/leads` uses `export const dynamic = "force-dynamic"` so the table always reflects the latest data.
- The leads table is kept minimal for now — no pagination, search, or filtering yet.
