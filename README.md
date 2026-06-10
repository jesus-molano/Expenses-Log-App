# Expense Reminders PWA

Mobile-first recurring expense tracker inspired by iPhone Reminders.

## Features

- Smart lists: Hoy, Proximos, Todos, Realizados.
- Recurring expenses: mensual, trimestral, anual, custom and RRULE-ready.
- One-tap paid state with occurrence overrides.
- Weekend charge estimate for Spain/Canary defaults.
- Tags/categories, local persistence, JSON import/export.
- Optional AI quick entry through Gemini; local parser fallback if no key exists.
- PWA manifest, service worker and best-effort web notifications.
- Supabase SSR helpers, Next 16 `proxy.ts` session refresh and RLS schema.

## Setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment

`.env.local` is intentionally ignored by git.

Required for Supabase login/sync:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Optional for AI:

```bash
GEMINI_API_KEY=
GEMINI_API_MODEL=gemini-2.5-flash
```

Apply `supabase/schema.sql` in the Supabase SQL editor to create tables and RLS policies.

## Verify

```bash
npm run lint
npm run test
npm run build
```
