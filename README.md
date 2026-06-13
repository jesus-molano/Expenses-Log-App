# Expense Reminders PWA

Mobile-first recurring expense tracker inspired by iPhone Reminders.

## Features

- Smart lists: Hoy, Proximos, Todos, Realizados.
- Recurring expenses: mensual, trimestral, anual, custom and RRULE-ready.
- One-tap paid state with occurrence overrides.
- Weekend charge estimate for Spain/Canary defaults.
- Tags/categories, local persistence and Supabase sync.
- Bank import from CSV/XLS/XLSX with expense matching, merchant aliases,
  reviewed duplicates, one-off income and salary detection.
- Per-expense pre-charge reminders with optional Web Push fallback the day
  before the estimated charge.
- Optional AI quick entry through Gemini; local parser fallback if no key exists.
- PWA manifest, service worker and best-effort web notifications.
- Supabase SSR helpers, Next 16 `proxy.ts` session refresh and RLS schema.

## Setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Documentacion

- [Indice tecnico](./docs/README.md)
- [Arquitectura](./docs/architecture.md)
- [Modelo de dominio](./docs/domain-model.md)
- [Estado, persistencia y sincronizacion](./docs/state-persistence-sync.md)
- [Design system](./docs/design-system.md)
- [Plataforma](./docs/platform.md)
- [Testing y calidad](./docs/testing-quality.md)

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

Required for scheduled push reminders:

```bash
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:you@example.com
```

The Vercel cron in `vercel.json` calls `/api/push/daily-reminders` every day
at `08:00 UTC`. The endpoint sends one Web Push reminder to each saved
subscription when that user's synced store has an enabled, undismissed
pre-charge reminder one day before the estimated charge.

Apply `supabase/schema.sql` in the Supabase SQL editor to create tables and RLS policies.

## Verify

```bash
npm run lint
npm run test
npm run build
```
