# Arquitectura

Expense Reminders es una PWA mobile-first de gastos recurrentes construida con
Next App Router. La app separa composicion de ruta, UI, dominio, estado,
persistencia y servicios externos para que cada cambio tenga un lugar claro.

## Capas principales

- `src/app`: rutas, layouts, providers globales, API routes, manifest, loading y
  error states. Las paginas deben componer features y hacer wiring de alto
  nivel.
- `src/features/*`: funcionalidad por dominio de producto. `expenses` contiene
  dashboard, timeline, formularios, swipe y DnD; `plan` contiene la pantalla de
  dinero; `settings` contiene preferencias, auth, notificaciones e
  import/export; `auth` contiene login.
- `src/components/ui`: componentes base del design system. Son genericos,
  reutilizables y no deben conocer reglas de negocio.
- `src/domain`: tipos y logica pura compartida. No depende de React, DOM, Next
  ni Supabase.
- `src/stores/app`: provider global, comandos de mutacion, cola de guardado,
  politica de sincronizacion y estado de sync.
- `src/data`: persistencia local/cloud, normalizacion de stores y tipos de
  Supabase.
- `src/shared`: utilidades transversales: i18n, tema, estilos compartidos y
  helpers UI.
- `src/utils/supabase`: clientes Supabase separados para browser, server y
  proxy.

## Rutas y composicion

- `/` renderiza `ExpenseDashboard`, la experiencia principal de gastos.
- `/money` renderiza `MoneyDashboard`, el plan mensual, ingresos y cuentas.
- `/settings` renderiza `SettingsView`, preferencias, import/export, auth y
  notificaciones.
- `/login` renderiza `LoginView`.
- `/expenses/new` y `/expenses/[id]` cubren creacion y detalle/edicion de
  gastos.
- `/auth/callback` completa el intercambio de codigo Supabase y redirige solo a
  rutas internas seguras.
- `/api/*` agrupa endpoints internos y queda fuera del matcher de `proxy.ts`
  para no refrescar Supabase Auth en cada request API.

## Server/client boundaries

El `RootLayout` es la shell global: carga fuentes, metadata PWA, `ThemeApplier`,
`PwaRegister` y `ExpenseStoreProvider`. Las paginas son finas y delegan la UI a
features.

Los componentes con estado interactivo usan `"use client"`. La logica pura,
normalizacion, calculos financieros, recurrencias y parseo se mantienen fuera
de React para poder testearlos con Vitest.

Supabase se consume con clientes especificos:

- Browser: componentes/hooks cliente.
- Server: route handlers y auth callback.
- Proxy: refresco de sesion en rutas de app, no en `/api`.

## Reglas de ownership

- Una pantalla puede orquestar, pero no debe esconder reglas complejas en JSX.
- Las mutaciones del store se hacen mediante comandos en `src/stores/app`.
- El acceso a localStorage o Supabase vive en `src/data` o hooks de
  persistencia, no en componentes de UI.
- Los componentes de `src/components/ui` no deben importar features ni store.
- Los helpers de dominio deben ser puros y recibir datos explicitos.
- Si una regla necesita tests unitarios, debe vivir en `src/domain`,
  `src/features/*/lib` o `src/stores/app`, no dentro de un handler largo.

## Flujos principales

Dashboard de gastos:

1. La pantalla lee el store desde `useExpenseStore`.
2. El dominio genera ocurrencias desde templates, reglas recurrentes y
   overrides.
3. La UI agrupa por timeline y permite pagar, mover, saltar o editar.
4. Los comandos actualizan el store y disparan persistencia.

Pantalla de dinero:

1. Combina ingresos, salario mensual, objetivos, cuentas y gastos previstos.
2. Calcula contribuciones, shortfall y tendencias.
3. Guarda cambios mediante comandos financieros del store.

Ajustes:

1. Cambia tema/idioma aplicando DOM/cookies y persistiendo preferencias.
2. Gestiona login, sync cloud, import/export y notificaciones.
3. Puede reparar metadata antigua con endpoint POST autenticado.
