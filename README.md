# Expense Reminders PWA

Mobile-first recurring expense tracker inspired by iPhone Reminders.

## Features

- Smart lists: Hoy, Proximos, Todos, Realizados.
- Recurring expenses: mensual, trimestral, anual, custom and RRULE-ready.
- One-tap paid state with occurrence overrides.
- Weekend charge estimate for Spain/Canary defaults.
- Tags/categories, local persistence and Supabase sync.
- Manual-first expense capture; text analysis remains an optional secondary
  shortcut.
- Plan split into current month, annual projection and monthly review. It keeps
  fixed salary/payday, habitual savings goal, actual monthly savings and
  one-off income as separate concepts.
- No bank aggregation or spreadsheet import: the app intentionally tracks
  recurring commitments and manual payments, not every small transaction.
- Per-expense Web Push reminders in the configured pre-charge window, with
  catch-up, device health/test controls and recoverable delivery leases.
- Optional AI quick entry through Gemini; local parser fallback if no key exists.
- Build-aware offline PWA after the first production visit, including internal
  navigation between Expenses, Plan and Settings.
- Eight Noctalia-aligned themes with semantic chart and UI colors.
- Supabase SSR helpers, Next 16 `proxy.ts` session refresh and RLS schema.

## Setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

The development server intentionally does not keep a service worker registered.
Test the real offline flow with the production build used by Playwright:

```bash
npm run e2e
```

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
subscription when that user's synced store has an enabled, undismissed charge
inside its configured reminder window. A 15-minute per-occurrence lease avoids
concurrent duplicate deliveries and lets a later cron recover work abandoned by
a crash. A row is marked delivered only after one device accepts the push.

For a new Supabase project, apply `supabase/schema.sql`. Existing projects must
also apply the pending files in `supabase/migrations/`, including the push lease
migration. No migration is applied automatically by the web build.

`public/sw.js` is generated from `src/pwa/sw.ts` by `npm run build` and is
intentionally ignored by Git.

## Verify

```bash
npm run lint
npm run test
npm run build
npm run e2e
```
