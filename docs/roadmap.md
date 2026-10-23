# Roadmap 2026-10: offline, cambio de mes, IA v2, voz y mejoras

Plan acordado con el dueño tras un análisis completo de la app (estructura,
límites, UX, bugs) e investigación externa. Se ejecuta por fases, un PR por
bloque.

Peticiones de partida:
1. **Cambio de mes.** A final de mes ya hay cosas del mes siguiente pagadas, pero la app sigue anclada al mes natural; se quiere pasar al siguiente cuando no quede nada, con un aviso que lo pregunte.
2. **Gemini funciona mal.**
3. **Voz opcional.**
4. **Offline roto.** La PWA instalada en Android se queda siempre en el loading inicial.
5. Otras mejoras de lógica y producto.

Investigación de soporte, en `docs/research/`:
- [Informe de hallazgos](./research/2026-10-informe.md): bugs confirmados con `file:line`, diseño del cambio de mes, IA, voz y features. Cada hallazgo fue verificado adversarialmente.
- [Causa raíz del offline](./research/2026-10-offline.md)
- [Gemini API](./research/2026-10-gemini-api.md)
- [Voz en PWAs](./research/2026-10-voz-pwa.md)
- [Competencia y features](./research/2026-10-competencia.md)

Estado:
- **PR 0: hecho.** Hotfix del cambio de hora y passthrough de campos desconocidos (ver `docs/state-persistence-sync.md`).
- **PR 0b: hecho.**
  - `occurrencesDueBetween` y `monthPendingSummary`, compartidos por Gastos y Plan.
  - Sección "Pendiente de <mes>" (excluye los gastos borrados).
  - Refresco a medianoche.
- **PR 1a: hecho.**
  - Pantalla de arranque con ayuda y script `boot-guard`.
  - Fila "Uso sin conexión" en Ajustes y diagnóstico de instalación del precache.
  - Hidratación resistente a fallos de Supabase y `global-error`.
  - Ver `docs/platform.md`.
- **PR 1b: hecho.**
  - Navigation preload desactivado, cortes de red a los 6 s y `dpl` ignorado.
  - `/settings` estática y limpieza de cachés obsoletas.
  - `verify-sw.mjs` y harness `npm run e2e:offline`.
  - El harness reproduce el cuelgue con una red que acepta conexiones y no responde (el caso de los datos móviles sin cobertura real): falla antes de 1b y pasa con 1b.
- **PR 1c: hecho.**
  - `useOnlineStatus` (`src/shared/hooks`) y chip "Sin conexión" en las cabeceras de Gastos, Plan y Ajustes, con `role="status"` y sin mover la cabecera a 360 px (e2e con `setOffline`).
  - Harness: escenario con un build hecho con `NEXT_DEPLOYMENT_ID` (assets con `?dpl=`), compilado en `.e2e-builds/` y reutilizado mientras no cambie el build base. Falla si el precache deja de ignorar `dpl` y pasa con él. Antes de abrir sin red se vacía la caché HTTP de Chromium, para que todo salga de las cachés del service worker.
  - Proyecto `webkit-iphone` solo con `dead`/`blackhole`. Aquí se salta con el motivo: Playwright 1.62.1 y WebKit sin instalar.
  - `docs/platform.md`: qué se precachea y cómo responde cada petición, según `sw.ts` y `serwist.config.mjs`.
  - Pendiente de 1c:
    - Correr WebKit de verdad: subir `@playwright/test` a 1.64 o más e instalar WebKit, también en CI.
    - El build `dpl` solo cubre el arranque en frío con el servidor parado. La actualización entre dos builds `dpl` y la variante `blackhole` se dejan fuera por tiempo de ejecución; el cuelgue ya lo cubre el build base.
  - Pendiente de 1b, documentado: las woff2 de `next/font` y los iconos con `?v=5` no están en el precache. Se guardan en runtime en la primera visita con el service worker al mando; si faltan, la app abre con la fuente del sistema.
- **F0b-1, F0b-2 y F0b-3: hechos.**
  - Parser de importes y fechas imposibles (F0b-1).
  - Overrides con id determinista, upsert y rekey (F0b-2).
  - Sync duradero (F0b-3): cambios pendientes persistidos, fusión al hidratar, reintentos, flush al salir y tombstones de sueldo por versión.
- **F1a-1 y F1a-2: hechos.**
  - "Atrasado" según el día de cargo estimado.
  - `ActionToast` con deshacer, por encima del FAB.
  - Mes activo con `monthClosures`, tarjeta "Octubre al día · Pasar a noviembre", aviso al pagar el último recibo y "Volver a octubre".
  - Selector de mes en Gastos (un año atrás y el mes siguiente). Plan sigue al mes activo (desde F1a-3, al mes visto).
  - `monthClosures` se escribe sin esperar la semana de passthrough: si un build antiguo lo descarta, el mes activo vuelve al natural y no se pierde ningún dato.
- **F1a-3: hecho.**
  - `MonthCloseSheet`: tarjeta "Cierre de octubre · Quedan 2 recibos" tras el cobro (o en los 3 últimos días sin cobro) con resumen frente al plan, Pagado/Saltar/Mover por resto (con deshacer), ahorro real y "Empezar noviembre".
  - Timeline con mes en los días de otro mes, "Ya pagado de noviembre" al final y "Hoy" solo en el mes natural.
  - Plan sigue al mes visto, con su selector; la fase "actual" es el mes activo. Año siguiente en diciembre, pagar desde Revisión y "Hasta el cobro".
  - M17 (en meses registrados el libre resta el ahorro real, aviso "Objetivo de ahorro no registrado") y M18 (cobros anteriores de un gasto nuevo: pagados, saltados o pendientes).
- **F1b: hecho.**
  - Cliente Gemini con cabecera, esquema, thinking por modelo, respaldo y plazo de 10 s.
  - Normalizador común con el parser local, que se reescribe (NFD, día antes que importe, frecuencias y meses).
  - Captura con la IA primero, varios gastos con revisión y "Guardar N".
  - El script de evaluación con la clave real (`scripts/eval-ai-parse.mjs`) queda pendiente: no hay clave en este entorno.
- **F2a (voz y Atrás): hecho.**
  - Dictado del navegador en la captura (Chromium fuera de iOS): micrófono con `aria-pressed`, fin por toque, 30 s, 2 s de silencio o salir de la app, y un único análisis con revisión.
  - Errores y sin conexión con pista para usar el micrófono del teclado; en iOS/Safari solo la pista.
  - Atajos del manifest "Añadir gasto" y "Añadir por voz" (`/expenses/new?mode=voice`).
  - Atrás cierra la hoja abierta (`src/components/ui/sheet-history.ts`).
  - Pendiente de F2a: `OccurrenceActionSheet`, `ConfirmActionDialog` con `useDialogA11y` y M22.
- **Cambios de importe de una serie: hecho.** Al editar el importe, lo ya pasado y lo ya pagado no cambian (meses anteriores como registros; mes cerrado con "Pasar al mes siguiente", cobros pagados y adelantados con override) y el editor pregunta "Desde este mes" o "Desde el mes que viene" (`keepAmountBeforeSeriesChange`). Para un solo mes, se edita el cobro.
  - Tocar un gasto abre sus acciones (`OccurrenceActionSheet`, M19): pagar o deshacer, pagar con otro importe, mover solo este cobro (no a un mes cerrado), saltar este mes con "Deshacer" y editar la serie. Deslizar o arrastrar no cuentan como toque.
  - Hoja de acciones revisada: "Editar la serie" navega (sustituye la entrada de la hoja en el historial), "Pagado con otro importe" solo apunta lo pagado (la fila pagada muestra lo pagado), mover solo toca el cobro y no se ofrece para lo pagado de un mes cerrado ni más allá del mes siguiente, Intro la abre desde el teclado y los clicks de lector de pantalla cuentan.
  - Cada mes del listado muestra solo sus cobros (más lo pendiente que arrastra); al final, "Noviembre empieza con N cobros en sus primeros días" con "Ver noviembre".
  - Pendiente de F2a: `ConfirmActionDialog` con `useDialogA11y` y M22.
- **F0c-1 (seguridad sin migración): hecho.**
  - `/auth/callback` solo redirige a rutas de la app: rechaza controles, DEL y `\`, y comprueba el origen con `new URL` (M14).
  - El cron procesa cada usuario en su propio `try/catch`, cierra siempre sus leases y cuenta `errors`; el store pasa por `toReminderStore` (M11).
  - Lista de servicios push en `subscribe`, `test` y el propio envío, `{timeout: 5000, TTL}`, `Promise.allSettled` y máximo 10 suscripciones por usuario en la API (M13).
  - Salir libera la suscripción push antes del `signOut` y ofrece borrar los datos del dispositivo; los datos sin metadatos de sync se atribuyen por su `userId` (M15).
  - Diferido a F0c-2 (necesita migración): `claim_push_subscription`, el límite de 10 en la base de datos y quitar el INSERT directo en `push_subscriptions`.
  - Pendiente de F2a: `OccurrenceActionSheet` (va en su propio PR).
- **F2a (diálogos y M22): hecho.**
  - `useDialogA11y` (`src/components/ui/use-dialog-a11y.ts`), extraído de `Sheet`: foco inicial, Tab atrapado, foco devuelto al cerrar, Escape y bloqueo del scroll. Solo la capa de encima atiende el teclado (una confirmación sobre una hoja no cierra también la hoja).
  - `ConfirmActionDialog` (M21): centrado también en móvil, `alertdialog` con título y descripción, portal sobre `body`, foco en Cancelar, y Escape, Atrás o tocar fuera cancelan (nunca con la acción en curso). Tono `danger` con `app-button-danger`.
  - Todas las confirmaciones dicen "Cancelar" en lugar de "Volver", y borrar un gasto nombra el gasto en el título. Quitar un ingreso puntual (antes, un toque sin confirmación ni deshacer) también pregunta.
  - M22: el detalle cuenta los cambios sin guardar (`features/expenses/lib/expense-editor.ts`). Con cambios, Atrás y el control "Gastos" preguntan "¿Descartar los cambios en «Game Pass»?"; guardar, borrar o descartar salen sin preguntar. El control "Gastos" vuelve atrás en el historial en lugar de apilar otra vez la lista.
  - Salir justo después de cerrar un diálogo espera a que las capas quiten su entrada del historial (`afterLayerHistorySettles`); si no, esa vuelta atrás desharía la navegación.
  - Diferido: los selectores de fecha y de día de cobro siguen sin `useDialogA11y` (Escape con un selector abierto dentro de una hoja cierra la hoja, y el foco no queda atrapado en el selector). Se dejó fuera para no cambiar su comportamiento en este PR.
  - Diferido: al borrar, durante un instante se ve "Gasto no encontrado" antes de llegar a la lista, como antes de este PR.
- **F0c-2 (sync multi-dispositivo): hecho, falta aplicar la migración.**
  - Migración aditiva `20261023120000_app_store_revision_cas.sql`: `revision` con trigger, RPC `save_app_store` con CAS, máximo 10 suscripciones push por usuario y RPC `claim_push_subscription` (M15). Probada sobre PostgreSQL (PGlite) con los stubs de Supabase.
  - Cliente con CAS: ante un conflicto fusiona, hidrata y reintenta; sin la migración cae al upsert y lo registra una vez.
  - Pull al volver a la app (cada 30 s como mucho) y sincronización entre pestañas por el evento `storage`.
  - Overrides huérfanos reconciliados tras cada fusión y `updatedAt` en las categorías.
  - Diferido: `ai_usage`/`consume_ai_quota`, porque la cuota durable sigue diferida mientras solo use la app el dueño (F1b). El contract (revocar la escritura directa en `app_stores`) va en un PR posterior.
- **F3-1 (copias) y F3-15 (deuda técnica): hechos.**
  - Ajustes › Copias y datos: exportar JSON (store completo) y CSV (gastos, cobros e histórico), importar con vista previa y elección entre combinar y sustituir, copias automáticas en IndexedDB (7 diarias y 5 de seguridad) con restaurar, y estado de `storage.persist()` con botón para pedirlo. Ver `docs/state-persistence-sync.md`.
  - Sustituir aguanta una fusión posterior con la nube; los objetivos de ahorro, que no tienen tombstone, son el único dato que podría volver.
  - Código muerto borrado, `planCopy` y los ternarios de idioma en i18n, tildes en los textos y en las categorías (sin cambiar el nombre guardado) y `--app-text-subtle` con contraste AA en los ocho temas, con tests que lo vigilan.
- **Pendiente de confirmar en el dispositivo:** abrir con conexión, esperar a que "Uso sin conexión" diga "Lista", cerrar la app y abrirla sin conexión.
- La operación de Gemini (cambiar el modelo en Vercel) depende del dueño.

**Decisiones del dueño:**
- **Mes:** mes activo con aviso "¿Pasamos a noviembre?" y selector de mes compartido por Gastos y Plan. El ciclo anclado al cobro queda como opción futura.
- **Voz:** dictado del navegador (Web Speech API). Escribe en el textarea y luego se analiza como texto.
- **Entrega:** por fases, un PR por bloque, cada uno con tests.
- **Gemini:** nivel gratuito, modelo barato y sin enviar audio a Gemini.

---

## Diagnóstico clave

### Offline
- `ExpenseStoreProvider` (`src/stores/app/use-expense-store.ts:69-75`) pinta `null` hasta hidratar. Si el JS no carga, la pantalla queda vacía sobre #020617, que es el color del splash del manifest: parece un loading infinito.
- La hidratación local es síncrona y tiene try/catch, así que el fallo está en el SW o en la carga de chunks.
- **Causa más probable para "Android, siempre":**
  - El precache de Serwist es todo o nada: cualquier respuesta ≥400 aborta la instalación, con 10 peticiones concurrentes.
  - `PwaRegister` silencia los errores, y `register()` no rechaza aunque la instalación falle.
  - Si el SW nuevo nunca se instala, sigue activo el antiguo escrito a mano (`expense-reminders-v6`, anterior a 95c2f24). Ese SW sirve el HTML offline pero manda `/_next/*` a la red, así que la app no hidrata.
- **Agravantes:**
  - `navigationPreload: true` sin timeout.
  - `NetworkFirst`/`CacheFirst` pueden colgarse.
  - `?dpl=` (Skew Protection) no se ignora.
  - `/settings?from=*` se precachea como página dinámica.
  - Se precachea un PNG de 1,27 MB que no se usa.
  - Las woff2 no están en el glob.
- **El e2e da un falso verde:** `setOffline` no corta los fetch del SW, no hay arranque en frío y no se simula un deploy.

### Gemini
- `gemini-2.5-flash` figura como legacy (repo oficial `google-gemini/gemini-skills`, verificado). Los actuales son `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite` y `gemini-3.8-flash`.
- Prompt de una línea, sin fecha, categorías ni definiciones.
- Sin `responseJsonSchema` y con un zod de todo o nada.
- Thinking por defecto contra un timeout de 8 s.
- Clave en `?key=`. Los errores 4xx se etiquetan como `invalid_response` sin log.
- Solo se usa `expenses[0]`.
- El estado de la IA nunca se ve.
- El parser local está roto: `ano` casa con "hermano" y el importe coge el número del día.
- `dueDay` y `startDate` incoherentes generan un vencido fantasma (A9). Las fechas imposibles rompen la app (A3).

### Mes
- `use-expense-filters.ts`: la ventana empieza en `startOfMonth(new Date())` y añade 7 días del mes siguiente. Ninguna cabecera dice el mes.
- Lo prepagado del mes siguiente sube por encima de "Hoy".
- Lo impagado desaparece el día 1 (A8).
- Mover un recibo de un mes a otro lo saca de los totales de los dos meses (A10).
- El drag aplica el cambio a la serie por defecto (A7).
- `dayOfMonth` (día de cobro) y `paidAt` no se usan.
- Gastos no se refresca a medianoche (M2).
- Los dos "Por pagar" no cuadran (M1).

### Bugs que pierden o corrompen datos
- **A1.** La nube siempre gana: se pierden los cambios offline.
- **A2.** Gana el último en escribir, sobre el store entero.
- **A3.** Una fecha o rrule inválida rompe la app y borra localStorage.
- **A4.** Los inputs de dinero corrompen importes: 2.200 € → 2,20 €.
- **A5.** Pagar, despagar, mover o saltar reconstruye el override y se pierden ediciones.
- **A6.** Cambiar `dueDay` o la recurrencia deja overrides huérfanos.
- **M3.** `daysBetween` falla con el cambio de hora. **Ya está activo hasta el domingo 25-oct** y vuelve el 28-mar-2027.

---

## Fases (un PR por bloque, en este orden)

### PR 0 — Hotfix y operaciones (hecho el 23-oct, salvo la operación de Gemini)
- **M3.** En `src/domain/calendar.ts:67-71`, `daysBetween` pasa a `differenceInCalendarDays(parseISO(to), parseISO(from))`.
  - Nuevo `calendar.test.ts` con `process.env.TZ='Atlantic/Canary'`: 23→30-oct = 7; 25→26-oct = 1; 30-mar→27-mar-2027 = -3.
- **Passthrough de claves desconocidas** (compatibilidad hacia delante, condición para cualquier campo nuevo):
  - `normalizeExpenseStore`, `normalizeFinanceStore` y `normalizeDeletedIds` (`src/data/persistence/store-normalization.ts`) y `mergeExpenseStores` (`local-store.ts`) conservan las claves desconocidas en la raíz, en `finance` y en `deleted`.
  - Test: `finance.monthClosures` y `schemaVersion: 4` sobreviven a load → save → merge.
  - **Regla:** ningún campo nuevo se escribe hasta que este build lleve al menos 1 semana desplegado y abierto en todos los dispositivos.
- **Operaciones de Gemini (sin código):**
  - `GET https://generativelanguage.googleapis.com/v1beta/models` con la cabecera `x-goog-api-key` y la clave de producción, para ver qué modelos da el nivel gratuito.
  - Revisar las restricciones de la clave en AI Studio.
  - Fijar `GEMINI_API_MODEL=gemini-3.5-flash-lite` en Vercel y redesplegar. `route.ts:105` ya lee la variable, y el cuerpo actual es compatible.
- **Aceptado:** el paso de oct a nov ocurre con el comportamiento actual salvo lo que llegue en PR 0b.

### PR 0b — Frontera de mes (mergear antes del sáb 31-oct, en paralelo a PR 1a)
- **M2.** `useCurrentDate()` en Gastos; `useExpenseFilters(store, lang, now)` con un memo por `toDateOnly(now)`. Volver a enfocar el timeline cuando cambie `today`.
- **A8.** Selector puro `selectCarryOverOccurrences` (desde `max(inicio del mes anterior, último mes cerrado + 1)`, solo los `due`) y sección "Pendiente de octubre" con total propio, fuera de `pendingTotal`.
- **M1.** Selector único `monthPendingSummary` → {total, items, spillToNextMonth}, usado por la cabecera de Gastos y por Plan.
- **Tests:** `vi.setSystemTime` del 31-oct a las 23:59 al 1-nov, del sábado 31 al lunes 2, con TZ fija.

### PR 1a — Offline: diagnóstico en la app y nunca una pantalla vacía
- **Nunca pantalla vacía:**
  - `ExpenseStoreProvider` recibe `fallback`, y `layout.tsx` pasa un `AppBootShell` nuevo: skeleton con `app-page`/`app-section-card`, `role="status"`, y un bloque de ayuda con "Reintentar" y "Reparar" (`/?sw-reset=1`) que aparece por CSS a los 6 s.
  - En `use-store-persistence.ts`: hidratar en `try/finally` antes de `createClient()`, y `createClient` dentro de try/catch.
  - Nuevo `src/app/global-error.tsx`.
- **SW, solo cambios aditivos** (`src/pwa/sw.ts`, con la lógica pura en el nuevo `src/pwa/cache-policy.ts`):
  - `precacheOptions.concurrency: 4`.
  - Plugin de precache que reintenta ante 429/5xx (2 veces, a 1 s y a 3 s).
  - Plugin `reportPrecacheFailure` (`postMessage PRECACHE_FAILED {url,status}` a todos los clientes).
  - Handler `GET_OFFLINE_STATUS` → {esperadas, cacheadas, versión}.
- **`PwaRegister`:**
  - Escuchar `updatefound` → `statechange`. Si el SW pasa a `redundant` sin instalar, guardar `{at,url,status}` en localStorage `offline-diag-v1`.
  - Registrar los errores en log, llamar a `registration.update()` al volver a primer plano (throttle de 1 min) y a `navigator.storage.persist()`.
- **Fila de Ajustes "Uso sin conexión"** (`features/settings/lib/offline-readiness.ts` puro, más hook y `rows/OfflineRow.tsx`, con i18n). Estados:
  - "SW antiguo activo": el controller no responde a `GET_OFFLINE_STATUS` en 1 s, o existe la caché `expense-reminders-v6`.
  - "Instalación fallida: <url> <status>"
  - "Preparando"
  - "Listo"
- **`scripts/check-precache.mjs <origin>`:** lee el manifiesto de `/sw.js` y pide cada URL en ráfagas de 10; falla con cualquier respuesta distinta de 200. Se ejecuta tras cada deploy (no hay CI).
- **Puerta antes de PR 1b:**
  - El dueño abre Ajustes con conexión en su Android y comparte el estado de la fila. Opcional: `chrome://inspect` con depuración USB.
  - Responde Q5-Q7 de [el análisis offline](./research/2026-10-offline.md) §4: si el icono es anterior al 23-ago, en qué URL lo prueba, plan de Vercel/Skew Protection y regla de rate limit del Firewall.
  - Se documenta qué hipótesis descarta cada estado.

### PR 1b — Offline: estrategia del SW
- **Mismo PR obligatoriamente:** `navigationPreload: false` más `disableNavigationPreload()`, y el fix de `dpl`: `ignoreURLParametersMatching` con `/^utm_/, /^fbclid$/, /^dpl$/, /^from$/, /^mode$/, /^occurrence$/`, más `cacheKeyWillBeUsed` que quite `dpl` en `next-static`/`app-assets`.
- `abortIfNoResponse(6000)` **solo** en las 5 estrategias con caché (`next-static`, `pages`, `app-assets`, `pages-rsc`, `same-origin`). **Nunca** en `/api/*` ni en peticiones cross-origin; lo comprueba un test.
- En `activate`: borrar las cachés `expense-reminders-*`, `pages` y `pages-rsc`. Solo corre si la instalación termina; la instalación robusta viene de PR 1a.
- **`serwist.config.mjs`:**
  - Quitar las **tres** `additionalPrecacheEntries` de `/settings` y el `readFileSync` de BUILD_ID. Si queda `/settings` duplicado, Serwist lanza `add-to-cache-list-conflicting-entries` y el SW nunca se instala.
  - `globIgnores` del PNG que no se usa (o borrarlo); añadir las woff2 de `.next/static/media`.
- **`/settings` estático:** `page.tsx` no lee `searchParams`; `from` se lee en cliente (`useSearchParams` dentro de `<Suspense>`, o `sessionStorage['expense-last-tab']`, que ya escribe `DashboardShell.tsx:30`). Antes, consultar la guía en `node_modules/next/dist/docs`.
- **`scripts/verify-sw.mjs`** en `build`: falla si faltan `/`, `/money`, `/settings`, `/login`, `/expenses/new` o los chunks, si hay URLs duplicadas o si alguna lleva query.
- **Rollback:**
  - En `controllerchange`, recargar en el siguiente `visible` (una vez por versión).
  - Kill-switch `src/pwa/sw-kill.ts` que se compila con `SW_KILL_SWITCH=1`: borra cachés, `unregister()` y `navigate`.
  - `/?sw-reset=1` con un script inline en `AppBootShell`.
  - Procedimiento en `docs/platform.md`. El Instant Rollback de Vercel es seguro.
- **Harness:** `tests/e2e-offline/` con `playwright.offline.config.ts` (`workers:1`, sin webServer) y `npm run e2e:offline`.
  - Builds en `.e2e-builds/`, ignorado por git y excluido en `vitest.config.mts`.
  - Escenarios con contexto persistente relanzado (arranque en frío):
    - **S1-dead:** server parado, en `/`, `/money`, `/settings?from=money`, `/expenses/new?mode=voice`, `/?occurrence=x` y `/login`.
    - **S1-blackhole:** el server acepta y no responde.
    - **S2-update:** deploy simulado con `NEXT_HASH_SALT`.
    - **S4:** el spec actual con `context.route` abortando también las peticiones del SW.
  - Correr primero sobre `main` y anotar qué escenarios fallan. Tras el fix, todos deben arrancar en menos de 5 s y sin `requestfailed` en `/_next/static`. Proyecto Chromium Pixel 7.

### PR 1c — Offline: cierre (hecho, ver Estado)
- Hook `use-online-status` y chip "Sin conexión" en las cabeceras.
- Builds DPL (`NEXT_DEPLOYMENT_ID`) en el harness.
- Proyecto WebKit, solo con `dead`/`blackhole`. Requiere Playwright 1.64 o superior; si no, `test.skip` con el motivo.
- `docs/platform.md` actualizado. La sección actual describe mal el precache.

### F0b-1 — Entrada segura (sin cambio de modelo)
- **A3:**
  - `isValidDateOnly` en `src/domain/calendar.ts`.
  - Guards en `recurrence.ts`: devolver `[]` con fechas inválidas, try/catch por plantilla y alrededor de `RRule.fromString`.
  - `sanitizeTemplate` en la normalización.
  - Si la carga falla, no sobrescribir localStorage: copia `expense-log-store-v1.corrupt-<ts>`, más un guard en `use-store-persistence.ts:65-66`.
- **A4.** Nuevo `src/shared/money.ts` (parse → `number|null`, regla de miles, `useGrouping:false`) que sustituye a `features/plan/lib/money-input.ts` y `features/expenses/lib/euro-input.ts` en los ~10 editores. Error inline en lugar de `0,01`. Tests de ida y vuelta en es/en.
- La suite de Vitest se ejecuta en UTC y en `Atlantic/Canary`.

### F0b-2 — Overrides (antes de F0b-3)
- Ids deterministas `ovr:${templateId}:${occurrenceDate}`. `normalizeExpenseStore` y `mergeExpenseStores` deduplican por clave: gana el `updatedAt` mayor; si empatan, paid > skipped > due. El id determinista se reasigna al superviviente.
- **A5.** `upsertOccurrenceOverride(store, occurrence, patch)` busca **por clave** y hace spread del override existente (patrón de `dismissLastChanceReminderInStore`, `expense-commands.ts:78-116`).
  - Pagar, despagar, mover, saltar y `updateMonthly…` lo usan.
  - **Los overrides no se borran nunca:** despagar o restaurar es un patch a estado neutro (`status:'due'`, sin `paidAt`, `amountPaid` ni `dueDate`) con un `updatedAt` nuevo.
  - Nuevo `restoreOccurrenceInStore` (deshacer un salto).
- **A6.** `updateExpenseTemplateInStore` con `rekeyOverridesForTemplateChange`: solo meses abiertos, como patches y no como borrados; si chocan, gana el pagado. Lo usa `use-expense-editor.ts`.
- Mover `getInitialOccurrenceDate` y `normalizeDraftStartDate` (`expense-commands.ts:52-76`) a `src/domain/recurrence.ts`, porque el dominio no puede importar de stores.
- **Tests:** preservación de campos, merge de un id aleatorio con uno determinista, y rekey 5→10→5 con merge.

### F0b-3 — Sync duradero (A1)
- Metadatos `expense-log-sync-v1` = {ownerId, dirty, revision}. Si el local está sucio, `resolveHydratedStore` fusiona con `mergeExpenseStores` y guarda.
- Retry con backoff, reintento en `online` y flush en `visibilitychange:hidden`/`pagehide`.
- Estado "pendiente de sincronizar" visible.
- Tombstones de sueldo: sin ellos el merge resucita datos. Implementados como lista de versiones borradas (`deleted.monthlySalary: string[]` con `<mes>@<updatedAt>`), que los builds con passthrough fusionan por unión.
- Revertir es seguro: los builds anteriores ignoran los metadatos.

### F0c-1 — Seguridad (sin migración) — hecho
- **M14.** Open redirect en `/auth/callback`: rechazar `[\u0000-\u001F\u007F\\]` y comprobar el origen con `new URL`.
  - Hecho en `src/shared/safe-redirect.ts`: también cae al fallback una ruta que se normaliza a `//host` (`/.//evil.com`). Tests de `%09`/`%0A`/`%0D`, `//`, `/\`, URLs absolutas y segmentos `.`/`..`.
- **M11.** try/catch por usuario en el cron, liberando los leases.
  - Hecho: cada lease se cierra por separado (marcado o liberado) aunque falle una reclamación a medias o el envío, y la respuesta lleva `errors`, `invalidStoresSkipped` y `blockedEndpointsSkipped`.
  - `toReminderStore` sustituye a `isExpenseStore`: solo gastos activos con aviso y bien formados, y overrides legibles.
  - El `CRON_SECRET` se compara en tiempo constante.
- **M15.** En el sign-out, quitar la suscripción push y no fusionar los datos de otro owner.
  - Hecho: `DELETE` + `unsubscribe()` antes del `signOut` (plazo de 4 s) y hoja "Salir y conservar los datos aquí" / "Salir y borrar los datos de este dispositivo", con aviso si hay cambios sin subir. Borrar la cuenta también anula la suscripción del navegador.
  - Revisado el reparto de F0b-3 (`ownerId` y `localChangesFor`): faltaba el caso de los dispositivos sin metadatos de sync, que ahora se atribuyen por el `userId` de los datos (`inferStoreOwnerId`). Borrar los datos locales también borra los metadatos.
  - Un endpoint registrado a nombre de otra cuenta devuelve 409 `PUSH_SUBSCRIPTION_IN_USE`; Activar pide una suscripción nueva y la guarda.
  - **Diferido a F0c-2:** el RPC `claim_push_subscription`, que necesita migración.
- **M13** (parte de la app): lista de hosts push permitidos, `{timeout:5000, TTL}` y `Promise.allSettled`.
  - Hecho: FCM, autopush de Mozilla, `*.push.apple.com` y `*.notify.windows.com`, con forma estricta (`https`, sin usuario, puerto ni `\`) para que web-push, que usa `url.parse`, vea el mismo host. Se comprueba en `subscribe`, en `test` y en el envío, y el cron se salta las filas de otros hosts.
  - TTL de 24 h para el recordatorio y de 5 minutos para la prueba.
  - Máximo 10 suscripciones por usuario en la API (se borran las actualizadas hace más tiempo) y en el envío del cron.
  - **Diferido a F0c-2:** el límite en la base de datos y revocar el INSERT directo del rol `authenticated` en `push_subscriptions` (ambos son migración).
- Siguen diferidos, como bajos del informe: el error ignorado de `exchangeCodeForSession`, el sujeto VAPID por defecto y la paginación y `maxDuration` del cron.

### F0c-2 — Sync multi-dispositivo (A2, migración expand/contract)
**Estado: hecho (expand y cliente).** Falta aplicar la migración en producción; `ai_usage` y el contract quedan diferidos (ver "Estado" arriba). Detalle en `docs/state-persistence-sync.md`.

1. **Migración aditiva:**
   - `revision bigint default 0` y un trigger `BEFORE UPDATE` que incrementa `revision`, para que los upserts ciegos de clientes viejos invaliden el CAS.
   - RPC `save_app_store(p_store, p_expected_revision)`.
   - Máximo 10 suscripciones push por usuario (la API ya lo aplica desde F0c-1).
   - RPC `claim_push_subscription` para traspasar un endpoint que sigue a nombre de otra cuenta (M15), y revocar el INSERT/UPDATE directo del rol `authenticated` en `push_subscriptions` (M13). Viene de F0c-1.
   - Opcional: `ai_usage` con `consume_ai_quota` (ver F1b).
2. **Cliente:**
   - CAS; ante conflicto, merge, hidratar y reintentar.
   - Si el RPC no existe (PGRST202), caer a `upsert` y registrarlo. `isMissingAppStoresError` deja de tratar ese error como "sin nube".
   - Pull al volver a primer plano (throttle de 30-60 s) y `storage`/BroadcastChannel entre pestañas.
   - `updatedAt` en el resto de entidades fusionables.
   - Reconciliar overrides huérfanos tras fusionar: el rekey de un cambio de día solo corre en el dispositivo que edita, así que un pago hecho en otro con la fecha antigua queda en una clave que la plantilla ya no genera. Repetir el rekey de los meses abiertos contra las plantillas actuales después de `mergeExpenseStores`.
3. Aplicar la migración en producción **antes** de mergear: las previews comparten la base de datos.
4. **Contract** (revocar la escritura directa en `app_stores`) en un PR posterior. Revertir el cliente es seguro.

### F1a-1 — Prerrequisitos del mes activo
- **A10.** `occurrencesDueBetween(store, from, to)`:
  - Envuelve `generateStoreOccurrences` y filtra por `dueDate`.
  - Para los overrides con `dueDate` en el rango y `occurrenceDate` fuera, llama a `generateStoreOccurrences(store, occDate, occDate)` y filtra por `templateId`, para conservar `sortOrder`, `active` y los records. Deduplica por `id`.
  - Se usa en `use-expense-filters`, `plan-dashboard.occurrencesForMonth` y el resumen anual.
- **A7.**
  - El drag aplica "solo este cobro" por defecto. Si cambia el mes, o la frecuencia es yearly/quarterly/once, nunca toca la serie.
  - Las filas pagadas no se arrastran.
  - Anuncios de dnd-kit localizados.
- `isOccurrenceOverdue` basado en `estimatedChargeDate` (lo que vence en fin de semana no sale "Atrasado" el día del cobro).
- **Toast genérico con acciones** (`src/components/ui/ActionToast.tsx` más un hook en la feature, a partir de `.app-last-chance-toast`): `role=status`, deshacer con patch inverso y `--app-toast-offset` por encima del FAB (M20).

### F1a-2 — Mes activo
- **Regla de atribución:** una ocurrencia pertenece al mes de su `dueDate` en todos los totales de Gastos y Plan.
  - `paidAt` solo se muestra ("pagado el 28 oct · cubre noviembre").
  - "Hasta el cobro" excluye lo ya pagado.
  - Test: alquiler del 1-nov pagado el 28-oct → no suma en octubre y figura pagado en noviembre en las dos pestañas.
- **Dominio** en el nuevo `src/domain/budget-month.ts`:
  - `monthRange` y `addMonthId` (mover `nextMonthId` desde `finance-commands.ts:171-175`).
  - `monthCloseStatus` → {pendingCount, pendingTotal, leftovers, nextMonthPaidCount}.
  - `resolveActiveMonth(today, closures)`: el mes natural, más uno si está cerrado, con tope de +1. Caduca solo cuando el calendario alcanza al mes activo.
  - `shouldSuggestAdvance`: al menos 1 ocurrencia en el mes, sin pendientes, y (10 días o menos para fin de mes, o hoy ≥ día de cobro **solo si el sueldo está configurado explícitamente**), y no descartado.
  - `getNextPayday` y `buildPaydayOutlook`.
- **Estado:**
  - `monthClosures?: Record<MonthId, {closedAt, updatedAt, reopenedAt?}>` en `FinanceStore` (`domain/types.ts`) y en `emptyFinanceStore`.
  - Normalizado en `normalizeFinanceStore` (`^\d{4}-\d{2}$`, ISO). Merge con `mergeMonthlyRecord` en `mergeExpenseStores`.
  - Actualizar `store-normalization.test.ts:87`.
  - El "Ahora no" se guarda por dispositivo: `localStorage['plan-close-dismissed:YYYY-MM']`.
- **Comandos:** `closeMonthInStore`, `reopenMonthInStore` y `markOccurrencesPaidInStore`. Se exponen en `useExpenseStoreValue` y en el barrel `store-commands.ts`.
- **Hook:** `src/features/expenses/hooks/use-active-month.ts`, con la lógica pura en el dominio → {today, calendarMonthId, activeMonthId, viewMonthId, browse(±1), reset, close, reopen}. `viewMonthId` vive en `sessionStorage['expense-view-month']` (compartido entre `/` y `/money`, sin query).
- **UI:**
  - `MonthSwitcher` "‹ Noviembre ›". En Gastos, `headerAction` compone `MonthSwitcher` + `RecurringOverviewButton`; verificar a 360 px.
  - Cabecera "Por pagar · noviembre".
  - `MonthCloseCard`: "Octubre al día · 12 pagados · 1 de noviembre ya pagado", con [Pasar a noviembre] = `close()` + toast "Noviembre activo · Deshacer", y [Ahora no].
  - Toast cuando el último pago deja el mes a 0.
  - La pastilla ofrece "Volver a octubre" cuando el mes activo no es el natural.
  - Sin sueldo configurado: CTA "Configura tu día de cobro" → `PlanSettingsSheet`.
- **Tests:** store vacío; sin sueldo; cerrar → deshacer; caducidad; merge de `monthClosures`.

### F1a-3 — Cierre con restos, timeline y Plan (hecho)
- **Cómo quedó:**
  - La tarjeta de cierre con restos sale el día de cobro si cae en los últimos 10 días del mes (quien cobra a primeros financia ese mes) o, sin sueldo configurado, en los 3 últimos días (`shouldSuggestCloseWithLeftovers`). Comparte el "Ahora no" por mes con la de "al día".
  - La hoja muestra los cuatro pasos a la vez. Cada resto se guarda al momento (Pagado = `togglePaidInStore`, Saltar = `skipOccurrenceInStore`, Mover = al día 1 del mes siguiente) y se deshace en su fila; "Pagar todo" usa `markOccurrencesPaidInStore`. La lista y el mes se fijan al abrir: si pasa la medianoche con la hoja abierta no se cierra el mes nuevo.
  - Fila propia (`MonthCloseLeftoverRow`) con botones con texto en lugar de `MonthlyExpenseRow`: sus cuatro iconos no caben a 360 px dentro de la hoja.
  - El día de cobro se acota al último día del mes (un 31 cae el 30 en noviembre) también en `shouldSuggestAdvance`.
  - "Ya pagado de noviembre" incluye todo lo pagado del mes siguiente, no solo su primera semana.
  - "Hasta el cobro" cuenta lo pendiente que se carga antes del próximo sueldo (el día de cobro ya cuenta como cobrado), atrasos incluidos, solo en el mes activo y con sueldo configurado.
  - En Plan la base (sueldo, día de cobro, objetivo) se sigue guardando desde el mes activo; el ahorro real y los ingresos extra van al mes visto.
  - M18 pregunta también en la revisión de varios gastos y, por defecto, da los cobros anteriores por pagados (fechados el día de su cargo). El cobro de este mes que ya pasó se pregunta aunque el gasto empezara meses atrás.
  - El foco inicial del timeline no se mueve al cambiar de mes, para no desplazar la barra de mes bajo el dedo.
- `MonthCloseSheet`, cuando quedan restos tras el cobro:
  1. Resumen frente al plan.
  2. Restos con Pagado/Saltar/Mover (reutiliza `MonthlyExpenseRow`).
  3. Registrar el ahorro del mes.
  4. Empezar el mes.
- **Timeline:**
  - Títulos con mes cuando no es el mes visto.
  - "Ya pagado de noviembre" al final, no en la pila de prioridad 0.
  - "Hoy" solo en el mes actual; si no, "Noviembre empieza en 4 días".
- **Plan:**
  - Sigue a `viewMonthId`; la fase `current` es el mes activo.
  - `getAvailableYears` +1 en diciembre.
  - Botón de pagar en las filas de Revisión (`MonthlyExpenseBreakdown.tsx:57-67`).
  - Tarjeta "Hasta el cobro (mié 28 · 5 días): X €".
- **M17.** En la fase `registered`, usar `savingsActual`.
- **M18.** Al crear un gasto con `startDate` pasado: "¿Marcar los meses anteriores como pagados o saltados?" → `markOccurrencesPaidInStore`.
- **Puntos a parametrizar** (lista completa en el §4.3 del [informe](./research/2026-10-informe.md)): `use-expense-filters.ts`, `ExpenseList.tsx:39`, `timeline.ts`, `use-timeline-initial-focus.ts`, `MoneyDashboard.tsx:61-291`, `finance.ts:128,192-198` y `plan-dashboard.ts`.
- Se quedan con el `today` real: `createEmptyDraft`, el cierre de records por mes natural y los recordatorios.
- **e2e:** `page.clock.setFixedTime('2026-10-28T10:00')` y luego `2026-11-01T00:05`.

### F1b — Captura con IA v2
- **Nuevo `src/data/ai/gemini-client.ts`:**
  - Cabecera `x-goog-api-key` y `encodeURIComponent(model)`.
  - Modelo por defecto `gemini-3.5-flash-lite`, respaldo `gemini-3.1-flash-lite` ante 404/429/503.
  - **Thinking según el id:** `*-flash-lite` → MINIMAL; `gemini-3.6/3.7/3.8-flash` → LOW; `2.5` → `thinkingBudget:0`; desconocido → sin `thinkingConfig`. Ante un 400 sobre thinking, un reintento sin él.
  - Sin `temperature`; `maxOutputTokens: 1024`.
  - Comprobar `finishReason` y `blockReason`; ignorar las partes `thought`.
  - **Plazo total de 10 s** compartido entre el modelo primario y el de respaldo. Ante un 429, reintentar solo si `retryDelay` ≤ 2 s.
  - Motivos: `auth_failed`, `model_unavailable`, `quota`, `blocked`, `truncated`, `invalid_response`, `timeout`.
  - `console.error` estructurado, sin el texto del usuario.
- **`route.ts`:**
  - `systemInstruction` por petición:
    - Fecha ISO con día de la semana y zona: la envía el cliente y el servidor la acota a ±2 días.
    - Idioma es/en y EUR.
    - Categorías preset como enum.
    - Definiciones de `startDate`/`dueDay`/`annualMonth` y mapeos de frecuencia.
    - "12,99 = 12.99" y "desconocido → null, nunca inventes importes".
    - 4-6 ejemplos.
  - `responseJsonSchema` escrito a mano, con `anyOf` null y sin `rrule`, con snapshot test.
  - Nuevo `aiExpenseItemSchema` (campos `nullable`), separado de `draftExpenseSchema`. `safeParse` por ítem, con `droppedCount`.
  - Contexto opcional: hasta 50 recibos existentes para detectar duplicados.
  - Rate limit en memoria como guarda de ráfagas.
  - **Cuota:** documentar los RPM/RPD gratuitos en `docs/platform.md`. El límite diario durable (`ai_usage`) queda **diferido** mientras solo use la app el dueño. Mensaje "cuota agotada, vuelve a las 09:00": la cuota se reinicia a medianoche del Pacífico.
- **Dominio:**
  - Tipo `ParsedExpenseDraft` (amount `number|null`).
  - `normalizeParsedDraft(draft, {today, activeMonthId})` → {draft, inferredFields, missingFields}. Valida fechas, reconcilia `dueDay` con `startDate` usando el `getInitialOccurrenceDate` ya movido al dominio, normaliza categorías sin acentos (NFD) más alias es/en, y convierte un importe null en `missingFields` (nunca 1).
- **Parser local reescrito** (`src/domain/parser.ts`):
  - NFD y límites de palabra.
  - Quitar el día del texto antes de buscar el importe.
  - Prioridad del importe: €/eur, luego decimales; regla de miles.
  - Vocabulario: semanal, quincenal, bimestral, semestral y nombres de mes.
  - Recibe `today` como parámetro.
  - Tabla de 30-40 frases.
  - Una parte sin número se une a la siguiente ("luz y gas 80 y netflix 12,99"); el nombre conserva conectores y símbolos ("Seguro del coche", "Disney+").
  - Horas, fechas dd/mm y años no cuentan como importe; si quedan varios números, el importe se marca para revisar.
- **Cliente:**
  - `parse()` devuelve {drafts[], provider, reason}, con `AbortController` y aborto a 12 s, `cancel()` y `reset()`.
  - Sin conexión: parser local con el motivo `offline`.
  - `GET /api/ai/status`.
  - `QuickCapture` con la IA primero:
    - `<form>` con textarea autoajustable.
    - Con teclado físico, Enter envía (Shift+Enter salta de línea, respetando `isComposing`). En pantallas táctiles Enter salta de línea y se envía con el botón.
    - Cancelar y Manual descartan la respuesta en curso; la que llegue después se ignora.
    - Chips de ejemplo, estado visible y CTA de login.
    - "Manual" como opción secundaria.
  - `QuickCaptureReview`:
    - Tarjetas con frase resumen y avisos ("fecha inferida", "falta importe", "ya existe").
    - Incluir/editar por tarjeta.
    - No deja guardar un ítem sin importe.
    - "Guardar N" con `addExpensesToStore` (fold con un solo persist, solo `DraftExpense` completos).
    - La selección vive en el flujo, por id estable, y sobrevive a editar un ítem.
    - Si algún primer cobro ya pasó este mes, pregunta Pendiente/Pagado, como el formulario (`firstChargeAlreadyPassed`).
  - Banner de proveedor y motivo (con el enlace de login) en `ExpenseFormSheet` y en la revisión. La key del formulario pasa a ser un nonce de sesión.
- **Docs:** actualizar `.env.example`, README y `docs/platform.md`. Nota: en el nivel gratuito Google puede usar el contenido, y los términos piden nivel de pago para apps ofrecidas a usuarios del EEE.
- **Tests:**
  - `route.test.ts`: cabecera sin `key=`; esquema y thinking enviados (3.8 recibe LOW); parciales; 401/403/404; blocked; MAX_TOKENS; timeout.
  - El normalizador y el parser.
  - `scripts/eval-ai-parse.mjs --model` (opt-in, con la clave real). Umbrales: importe ≥95 %, frecuencia ≥90 %, día y fecha ≥90 %, p95 por debajo de 3 s, al ritmo del RPM gratuito.

### F2a — Voz por dictado, acciones por ocurrencia y accesibilidad
- **`features/expenses/lib/voice-support.ts`** (puro): `getDictationSupport()` solo es verdadero en Chromium que no sea WebKit. Queda oculto en cualquier navegador de iOS/iPadOS y en Safari.
- **`hooks/use-speech-dictation.ts`:**
  - Estados idle → listening → done | error. `lang` es-ES/en-US e `interimResults`.
  - En Android `continuous` no tiene efecto: se reinicia tras cada resultado final.
  - **Fin del dictado:** toque de parar, tope de 30 s, 2 s sin un resultado final nuevo, `no-speech` o `visibilitychange:hidden`. Entonces se lanza **un único** análisis y siempre hay revisión.
  - Sin conexión: micrófono desactivado con "El dictado necesita conexión; usa el micrófono del teclado".
  - **Errores:** `not-allowed` (en Android: "Mantén pulsado el icono › Información de la app › Permisos › Micrófono"), `no-speech`, `network`, `audio-capture`, `aborted`, `service-not-allowed` y `language-not-supported`.
  - Tras un `network`/`service-not-allowed` sin ningún resultado (por ejemplo en Brave): desactivar el micrófono durante la sesión y mostrar la pista.
- **UI:**
  - Micrófono `IconButton` de 44 px con `aria-pressed` y región `aria-live`, dentro del textarea de `QuickCapture`.
  - Sin soporte: pista "usa el micrófono del teclado".
  - Shortcut "Añadir por voz" → `/expenses/new?mode=voice`, con `mode` leído en cliente para que la página siga siendo estática. Arrancar exige un toque.
- **`OccurrenceActionSheet`** (al tocar un gasto; sobre `Sheet`): pagar, pagar con otro importe, mover solo este, saltar (restaurar desde el aviso "Deshacer") y editar la serie. Resuelve M19. Hecho; "finalizar la serie" queda en la pantalla de edición.
- **`useSheetBackButton`** en `Sheet`: pushState al abrir y `popstate` cierra la hoja (Atrás en Android). Con test e2e.
- **`ConfirmActionDialog`:** foco, Escape y bloqueo de scroll, con `useDialogA11y` extraído de `Sheet.tsx`.
- **M22.** `router.replace` tras guardar en el detalle, más una guarda de cambios sin guardar.
- Reutiliza el `ActionToast` de F1a-1.

### F2b — Avisos 2.0 y pulido PWA
- **Avisos:**
  - Aviso por defecto en Ajustes y campana en las filas.
  - Antelación de 7/14/30 días para anuales y trimestrales.
  - Etapas: antes, el día del cargo y "¿se cobró?".
  - Push localizado con importe, deep link `/?occurrence=` (leído en cliente) y TTL.
  - Tipos `month_close` y `payday`, reutilizando el RPC con `kind`.
  - Hora de push configurable.
- **M12.** `pushsubscriptionchange`, heartbeat de la suscripción y `failure_count` (migración aditiva, mismo patrón que F0c-2).
- **PWA:** shortcuts (Añadir gasto, Añadir por voz, Plan), `setAppBadge` con los vencidos y los de hoy, `theme-color` por tema, maskable con margen y guía de instalación en iOS.

### F3 — Backlog de valor (por impacto × esfuerzo)
1. **Exportar e importar JSON/CSV**, snapshots locales y `storage.persist()`. Reutiliza `normalizeImportedExpenseStore` y `mergeExpenseStores`. **Hecho.**
2. **Recibos variables:** previsto frente a real, sugerencia con la media de los 3 últimos y "¿Actualizar el importe desde ahora?".
3. **Finalizar o pausar una suscripción:** `endDate`; las pausas como rangos.
4. **Provisión mensual para anuales** y "próximos recibos grandes (90 días)".
5. **Cambios de precio programados** e historial de precio.
6. **Coste por categoría y anualizado.**
7. **Onboarding:** chips de alta rápida y checklist.
8. **Pagas extra y "¿Has cobrado?"**; ámbito "solo este mes" al editar el sueldo (M16).
9. **Catálogo "Todos"** con búsqueda y filtros.
10. **Campos nuevos:** notas, URL de baja, permanencia, categorías propias y método de pago.
11. **Comandos por voz o IA** ("marca la luz pagada 71,20").
12. **Resumen del mes** y **registro de saldo**.
13. **Ciclo anclado al día de cobro** (opción).
14. **Festivos** en `estimateChargeDate`.
15. **Deuda técnica (hecho):**
    - Borrar el código muerto (`use-current-month-plan.ts`, `annual-plan-summary.ts`, `timelineHorizons`).
    - Pasar `planCopy` y los ternarios a i18n.
    - Tildes.
    - Contraste de `--app-text-subtle`.
    - Además: los campos de compatibilidad de `MonthlyMoneyPlan`, `SectionCard`/`StatCard`, `createSupabaseBrowserClient`, `getMonthlySavingsTargetEntry`, `MONTHS_ES/EN`, `PlanEmptyLine` y el `recurrenceLabel` del dominio (solo en español). Quedan los ternarios del dominio (`estimateChargeDate`) y del prompt de la IA, que no son texto de la interfaz.

**Diferido conscientemente** (ver [el informe](./research/2026-10-informe.md) §2 "Baja" y §3):
- Navegación de Plan (selects y gráfico, §3.14).
- Feed ICS y hogar compartido.
- CSP y Permissions-Policy.
- Paginación del cron.
- Login con logo de Google.
- Re-render en scroll.
- El resto de bajos.

---

## Piezas a reutilizar
- **Dominio:**
  - `src/domain/finance.ts`: `generateStoreOccurrences`, `buildMonthlyMoneyPlan`, `materializeClosedOccurrenceRecords`, `latestRecordValue`, `getMonthlySalarySettings`, `toMonthId`.
  - `recurrence.ts`: `generateTemplateDates`.
  - `calendar.ts`: `buildDateWithDay`, `estimateChargeDate`, `toDateOnly`.
  - `categories.ts`: `PRESET_EXPENSE_CATEGORIES`, `resolvePresetCategory`.
- **Comandos:**
  - `src/stores/app/expense-commands.ts`: el patrón de `dismissLastChanceReminderInStore`, más `togglePaidInStore` y `skipOccurrenceInStore`.
  - `finance-commands.ts`: `nextMonthId` y `update*InStore`.
- **Persistencia:**
  - `src/data/persistence/local-store.ts`: `mergeExpenseStores`, `mergeMonthlyRecord`.
  - `merge-by-id.ts`: `mergeLatestById`.
  - `store-normalization.ts`: `normalizeExpenseStore`, `normalizeImportedExpenseStore`.
  - `sync-policy.ts`: `resolveHydratedStore`.
- **Hooks, lib y UI:**
  - `useCurrentDate`, `buildTimelineSections`, `buildRecurringOverview`, `localizedRecurrenceLabel`.
  - `MonthlyExpenseRow` + `use-monthly-expense-row-editor`, `SkipOccurrenceDialog`, `PlanPaydayField`.
  - `Sheet`, `IconButton` (touch), `Button`, `Field` (prop `error`), `DatePickerField` (i18n de mes anterior y siguiente), `OfflineLink`, `DashboardShell` (`headerAction`), CSS `.app-last-chance-toast`.
- **Plataforma:**
  - `claimReminderDelivery` + RPC con `kind`.
  - `push-notifications.ts`.
  - `notificationclick` con `data.url`.
  - `/expenses/new` con `initialNewExpense`.

## Verificación
- **En cada PR:** `npm install` (`node_modules` no está instalado), `npm run lint`, `npm test`, `npm run build`, y `npm run e2e` cuando toque UI.
- **PR 0:** test DST en `Atlantic/Canary`; test de passthrough. Comprobar en producción que "Analizar" responde con el proveedor Gemini.
- **PR 0b:** tests de frontera con `vi.setSystemTime`. En el navegador, el 1-nov (con el reloj simulado) sigue apareciendo "Pendiente de octubre".
- **PR 1a/1b/1c:**
  - `npm run e2e:offline` en rojo sobre `main` y en verde tras el fix.
  - `node scripts/check-precache.mjs <prod>` tras cada deploy.
  - **En el Android del dueño:**
    1. Abrir con conexión y esperar a que la fila diga "Listo".
    2. Quitar la app de recientes y hacer Forzar detención.
    3. Activar el modo avión y abrirla: debe cargar en menos de 2 s.
    4. Navegar a Ajustes, Plan y `/expenses/new`.
    5. Repetir tras un segundo deploy.
  - Si no pasa a "Listo" en 1 min: Chrome › Configuración de sitios › Borrar y restablecer, y capturar `chrome://inspect`.
- **F0b/F0c:**
  - Tests de preservación de campos, dinero es/en, fechas inválidas, merge con ids deterministas y rekey 5→10→5, y sync dirty/CAS.
  - Migración en un proyecto Supabase de prueba, más el fallback PGRST202.
- **F1a:** tests de dominio y e2e con `page.clock`. Flujo: pagar el último de octubre → tarjeta → "Pasar a noviembre" → deshacer → los totales cuadran entre pestañas → recargar mantiene el mes → caducidad.
- **F1a-3:** `tests/e2e/month-close-leftovers.spec.ts` con el reloj el 28-oct a las 10:00 y el 1-nov a las 00:05: cerrar con restos (pagar, mover, ahorro, empezar), resto sin resolver como "Pendiente de octubre", Plan siguiendo al mes visto, pagar desde Revisión, año siguiente en diciembre y cobros anteriores de un gasto nuevo.
- **F1b:** tests de la ruta; `scripts/eval-ai-parse.mjs` con los umbrales indicados. En el navegador: "Netflix 12,99 el 5 y gimnasio 35 al mes" → 2 tarjetas → guardar.
- **F2a:** en Chrome Android, dictar → texto en vivo → análisis → revisión. Probar también en modo avión, con el permiso denegado y en Brave. En iOS, el micrófono está oculto. Tests con `SpeechRecognition` mockeado.
- **F2b:** push de prueba y deep link a la ocurrencia.

## Pendiente de confirmar al implementar
- Qué modelos da el nivel gratuito con la clave del dueño (PR 0).
- Skew Protection y la regla del Firewall de Vercel (puerta de PR 1a).
- Guías de Next 16 en `node_modules/next/dist/docs` para `useSearchParams`/Suspense, `global-error` y el renderizado estático (AGENTS.md).
- Si la app la usa solo el dueño (decide la cuota durable de IA).
