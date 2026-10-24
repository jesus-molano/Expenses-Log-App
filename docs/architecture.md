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
  dinero; `settings` contiene preferencias, auth y notificaciones; `auth`
  contiene login.
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

- La navegacion inferior tiene cuatro pestañas (`src/shared/app-tabs.ts`),
  cada una con su cifra en la cabecera de `DashboardShell`:
  - `/` (Gastos) renderiza `ExpenseDashboard`, la experiencia principal de
    gastos: "Por pagar · <mes>".
  - `/money` (Mes) renderiza `MonthDashboard`: "Libre · <mes>", la barra de
    mes compartida con Gastos, la ecuacion del mes, los recibos del mes
    plegados y el resumen del mes (`MonthSummaryLayer`, que tambien abre
    "Ver resumen" en Gastos) con las acciones de revision.
  - `/accounts` (Cuentas) renderiza `AccountsDashboard`: los saldos y si la
    cuenta de recibos llega a lo pendiente del mes activo.
  - `/forecast` (Prevision) renderiza `ForecastDashboard`: recibos grandes,
    provision, coste por categoria y plan anual.
  Cuentas y Prevision miran siempre el mes activo y no tienen barra de mes.
- `/settings` renderiza `SettingsView`, preferencias, auth y notificaciones,
  y la fila "Sueldo y ahorro" con la misma hoja "Base del plan" que Mes.
  `?from=<pestaña>` decide adonde vuelve "Atras".
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
3. La UI agrupa por timeline y permite pagar, mover, saltar o editar. El
   timeline es el del mes que se mira (`useActiveMonth`): los dias de otro mes
   llevan el mes, lo pagado por adelantado del siguiente va al final ("Ya
   pagado de noviembre") y "Hoy" solo existe en el mes natural.
4. Los comandos actualizan el store y disparan persistencia.
5. Cierre de mes: si el mes natural esta al dia, `MonthCloseCard` propone
   pasar al siguiente; si tras el cobro quedan recibos, abre `MonthCloseSheet`
   (resumen frente al plan, Pagado/Saltar/Mover por resto, ahorro real y
   "Empezar noviembre"). La logica vive en `domain/budget-month.ts`,
   `features/expenses/lib/month-close.ts` y `use-month-close-sheet.ts`.

Pestañas del plan (Mes, Cuentas y Prevision):

1. `MonthDashboard` (Mes) responde cuanto queda libre segun el plan del mes
   que se mira en Gastos (con la misma barra de mes, `useMonthPlan`), que
   falta por pagar y lo ya pagado. La fase "actual" es el mes activo; en el,
   "Hasta el cobro" suma lo pendiente antes del proximo sueldo. "Recibos de
   <mes>" (`MonthReceiptsList`) es la unica lista para pagar, corregir lo
   pagado o quitar del mes cada recibo.
2. `MonthSummaryLayer` abre "Resumen de <mes>" con lo que antes era la
   revision mensual: editar el ingreso fijo y el ahorro, el aviso del ahorro
   sin registrar y los ingresos puntuales. Lo abren la fila del resumen en Mes
   y "Ver resumen" en Gastos.
3. `AccountsDashboard` (Cuentas) y `ForecastDashboard` (Prevision) miran el
   mes activo (`useActiveBudgetMonth`); Prevision tiene `AnnualPlanSection`
   con gasto recurrente, pagado, ahorro real y capacidad maxima de los doce
   meses del año elegido (`useAnnualPlan`).
4. Los calculos puros viven en dominio y `features/plan/lib`; el estado y las
   hojas compartidas, en `features/plan/hooks` y en componentes pequeños.
5. La base del plan guarda sueldo fijo, dia de cobro y objetivo habitual
   (`usePlanBaseSettings`, la misma hoja desde Mes, la guia de Gastos y
   Ajustes). La transferencia real de ahorro pertenece a cada mes y no cambia
   ese objetivo.

Ajustes:

1. Cambia tema/idioma aplicando DOM/cookies y persistiendo preferencias.
2. Gestiona login, sync cloud y notificaciones.
3. Puede reparar metadata antigua con endpoint POST autenticado.

PWA y avisos:

1. Serwist genera el service worker desde `src/pwa/sw.ts` durante el build.
2. La shell principal queda disponible sin red. Las rutas centrales fuerzan una
   navegación de documento cuando el navegador está offline; las respuestas RSC
   GET usan `NetworkFirst`. API, origenes externos y peticiones no GET nunca se
   guardan en cache.
3. Ajustes registra y verifica la suscripcion push del dispositivo.
4. El cron usa un lease atomico por ocurrencia, marca `delivered` tras el primer
   envio aceptado y permite recuperar claims abandonados.
5. `public/sw.js` es un artefacto generado e ignorado; la fuente mantenida es
   `src/pwa/sw.ts`.
