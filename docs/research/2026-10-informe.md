# Informe de hallazgos: Expenses-Log-App (2026-10-23)

## 1. Arquitectura actual en 15 líneas

1. **Stack.** Next 16 App Router, React 19 y TypeScript. Tokens CSS con clases `app-*`. Service worker Serwist (`src/pwa/sw.ts`). Supabase para el login con Google y para `app_stores.store` (un único jsonb por usuario). web-push para avisos y Gemini por REST para la IA. Tests con Vitest y Playwright, **sin CI** (no hay `.github/`).
2. **Rutas.**
   - Páginas: `/` y `/expenses/new` → `ExpenseDashboard`; `/expenses/[id]` → `ExpenseDetail`; `/money` → `MoneyDashboard`; `/settings`; `/login`; `/auth/callback`.
   - API: `/api/ai/parse-expenses`, `/api/push/{subscribe,status,test,daily-reminders}`, `/api/account`, `/api/auth/clear-sync-metadata`.
3. **Dominio puro (`src/domain`).**
   - `types.ts`: `ExpenseStore`, `ExpenseTemplate` con importe fijo, `currency:"EUR"` y `dueDay`.
   - `recurrence.ts`: `generateTemplateDates`, `generateOccurrences`.
   - `finance.ts`: `generateStoreOccurrences`, `buildMonthlyMoneyPlan`, `materializeClosedOccurrenceRecords`, `latestRecordValue`, `toMonthId`.
   - `calendar.ts`: `estimateChargeDate`, `daysBetween`, `buildDateWithDay`. `APP_TIME_ZONE` existe pero no se usa.
   - `categories.ts`: 15 categorías preset. `parser.ts`: esquemas zod más el parser regex local. `seed.ts`.
4. **Modelo de ocurrencias.**
   - Nunca se guardan; se derivan de las plantillas.
   - Los overrides se emparejan por `templateId:occurrenceDate` (con ids aleatorios).
   - Los meses cerrados (hasta el fin del mes anterior) se congelan en `occurrenceRecords` en cada carga y en cada persist.
5. **Comandos (`src/stores/app`).** Funciones puras store→store en `expense-commands.ts`, `finance-commands.ts` y `preference-commands.ts`. Se exponen desde `use-expense-store.ts`, que lee el `store` del render (closure) → `persist()` → `store-history.ts` (preserva los records).
6. **Persistencia y sync.**
   - `src/data/persistence/`: `local-store.ts` (localStorage `expense-log-store-v1`, `mergeExpenseStores`), `store-normalization.ts`, `merge-by-id.ts` (last-write-wins por id), `cloud-store.ts`.
   - `use-store-persistence.ts` más `sync-policy.ts`: la nube gana salvo que haya ediciones durante la hidratación.
   - `use-cloud-save-queue.ts`: upsert ciego del documento entero con debounce de 350 ms.
7. **UI de Gastos (`src/features/expenses`).**
   - `ExpenseDashboard` → `DashboardShell` (cabecera "Por pagar" y nav inferior de 2 tabs, compartidos con Plan).
   - `ExpenseList` (dnd-kit) → `ExpenseRow` (swipe).
   - `lib/timeline.ts`; `hooks/use-expense-filters.ts` (ventana = mes natural + 7 días).
   - `QuickCapture` + `use-quick-expense-parser`; `ExpenseFormSheet`/`ExpenseForm`; `RecurringOverviewSheet`; `LastChanceReminderToast`.
8. **UI de Plan (`src/features/plan`).**
   - `MoneyDashboard` → `CurrentMonthPlanSection`, `AnnualPlanSection` y `MonthlyReviewSection` (la única navegación por meses de toda la app).
   - `lib/plan-dashboard.ts` (`occurrencesForMonth`, `buildSeriesItem`, `planCopy`); `PlanSettingsSheet` (sueldo, día de cobro, objetivo de ahorro); `MonthlyExpenseRow`.
9. **Settings y auth.** `useSettingsController` → `useNotificationSettings` (`lib/push-notifications.ts`), `NotificationsRow`, `AccountRow` (el único sitio donde se ve el estado de sync). `features/auth/LoginView`.
10. **Push.** El cron de `vercel.json` (`0 8 * * *` UTC) llama a `daily-reminders/route.ts`, que usa el service role, carga todos los `app_stores` y aplica el lease RPC `claim_push_reminder_delivery` (kind `last_chance`). El SW solo tiene los listeners `push` y `notificationclick`.
11. **IA.** `api/ai/parse-expenses/route.ts`: exige login, rate limit en memoria de 20/min, modelo por defecto `gemini-2.5-flash`, clave en `?key=`, sin esquema ni systemInstruction, timeout de 8 s. Si falla, cae al parser local.
12. **Design system.** `src/components/ui` (Button, IconButton, Sheet con focus-trap, ConfirmActionDialog, Field, SelectMenu, DatePickerField, OfflineLink). `src/app/styles/tokens.css` (8 temas, todos oscuros) y `components.css`.
13. **i18n.** `src/shared/i18n.ts` con `i18n-messages.ts` (es/en, test de paridad de claves). Conviven sistemas paralelos: `planCopy()`, ternarios inline y `recurrenceLabel` solo en español.
14. **Hooks compartidos.** `src/shared/hooks/use-current-date.ts` refresca a medianoche y en `visibilitychange`, pero **solo lo usa Plan**.
15. **Base de datos.** `supabase/schema.sql` y migraciones con RLS por fila propia. El rol `authenticated` puede escribir directamente en `app_stores`, `push_subscriptions` y `push_reminder_deliveries`. Vitest no fija TZ; Playwright solo tiene un proyecto Pixel 7 con reloj real.

---

## 2. Bugs confirmados (por severidad)

### Alta

| # | Bug | Evidencia | Impacto | Fix |
|---|---|---|---|---|
| A1 | **Los cambios locales sin sincronizar se pierden** porque la nube siempre gana, y no hay retry ni flush | `sync-policy.ts:23-34`; `use-store-persistence.ts:32,105,131-134,187` (el cleanup llama a `clearQueuedSave`); `use-cloud-save-queue.ts:56-75` | Los pagos marcados offline, o menos de 350 ms antes de cerrar la app, se revierten. Pasa también en la misma sesión al reconectar (cambio de pathname o evento de auth). El cron recuerda recibos que ya están pagados | Meta persistida (`expense-log-sync-v1` = {ownerId, dirty, revision}). `resolveHydratedStore(localDirty)` → `mergeExpenseStores` + guardar. Backoff, retry en `online`, flush en `visibilitychange:hidden`/`pagehide`. Estado de sync "pendiente" |
| A2 | **Multi-dispositivo: un tab abierto desde hace días sobrescribe todo el documento** | `use-store-persistence.ts:98-103` (no vuelve a leer la nube); `cloud-store.ts:56-60` (upsert ciego); `app_stores` sin revisión; solo `ThemeApplier.tsx:24` escucha `storage` | Pérdida silenciosa entre móvil y escritorio, y entre dos tabs | Columna `revision` + RPC `save_app_store(p_store, p_expected_revision)` con compare-and-swap. Ante conflicto: merge, hidratar y reintentar. Pull-on-resume con throttle de 30-60 s. Listener `storage`/BroadcastChannel. **Requiere B-merge antes** |
| A3 | **Una plantilla con fecha imposible o un rrule inválido rompe la app y en el reload borra localStorage** | `parser.ts:10` (`startDate` sin validar); `expense-commands.ts:23,61` (`new Date` hace rollover); `recurrence.ts:50,87,92-93,116` (lanza `RangeError`); `store-normalization.ts:217-220,240`; `local-store.ts:18-20` → `use-store-persistence.ts:65-66` guarda el store vacío | Una respuesta mala de la IA deja la app en la página de error, borra los datos locales y hace ilegible la copia en la nube en todos los dispositivos. `error.tsx` afirma lo contrario | Capas: `isValidDateOnly` en `calendar.ts`; `generateTemplateDates` devuelve `[]` si la fecha no es válida; try/catch por plantilla y alrededor de `RRule.fromString`; `sanitizeTemplate` antes de materializar; **no sobrescribir localStorage tras una carga fallida** (guardar una copia `.corrupt-<ts>`); regex más refine en el esquema de la IA; quitar `rrule` del esquema de la IA |
| A4 | **Los inputs de dinero corrompen importes** | `features/plan/lib/money-input.ts:10-24` y `features/expenses/lib/euro-input.ts:3-17` (el último separador se toma como decimal; el formateo agrupa miles); placeholder `PlanSettingsSheet.tsx:51` "2.200,00"; ida y vuelta en `use-plan-settings-form.ts:31-37,61-70`, `use-monthly-salary-editor.ts:37/52`, `MoneyDashboard.tsx:208/221`, `use-monthly-expense-row-editor.ts:36/62`, `use-income-event-row-editor.ts:26/40`, `use-expense-editor.ts:35/57`, `ExpenseFormSheet.tsx:36/56` | En inglés, abrir Ajustes y pulsar Guardar convierte 2.200 € en 2,20 €. En español, importes de 10.000 o más pasan a 12. "2.200" tecleado da 2,2. "abc" o "0" se guardan como 0,01 €. Se sincroniza | Un único parser en `src/shared` que devuelva `number \| null`. `useGrouping:false` en los inputs. Regla de miles: un solo separador seguido de exactamente 3 dígitos. Error inline en lugar de `Math.max(...,0.01)`. Borrar `money-input.ts`. Tests de ida y vuelta para es y en |
| A5 | **Pagar, despagar, mover y saltar reconstruyen el override desde cero** | `expense-commands.ts:195-216` (al pagar se pierden name, amount, categoryId, sortOrder, note y reminder*; `userId:"demo"`); `:194` (despagar borra el override entero sin tombstone); skip `:242-255` (nota en inglés fija); move `:269-281`; `updateMonthly…` pierde los reminder*. El patrón correcto ya existe en `dismissLastChanceReminderInStore :78-116` | Editar la luz a 74,30 € y marcarla pagada devuelve el previsto a 60 €. Despagar devuelve un recibo movido a su fecha original. Se pierde el orden del drag | Helper `upsertOccurrenceOverride(store, occ, patch)` que haga spread del existente. Despagar = patch `{status:'due', paidAt:undefined, amountPaid:undefined}`. Tests de preservación de campos |
| A6 | **Cambiar dueDay, startDate o recurrencia deja overrides huérfanos** | `moveOccurrenceSeriesInStore` `expense-commands.ts:319-338` (solo toca `dueDay`); `use-expense-editor.ts:59-78`; emparejamiento por clave exacta en `recurrence.ts:132-143` | El pago de este mes desaparece (riesgo de pagar dos veces). La vista de recurrentes muestra como "overdue" un anual que se pagó el año pasado | `rekeyOverridesForTemplateChange` en el dominio: solo meses abiertos, mismo YYYY-MM, y si colisionan gana el pagado. Nuevo comando `updateExpenseTemplateInStore` |
| A7 | **Al arrastrar se aplica la serie antes de preguntar. Si se suelta en otro mes el resultado cae en un mes equivocado** | `use-expense-dnd.ts:71-84,105-116`; `expense-commands.ts:324` (usa solo `getDate`); `TimelineMovePrompt.tsx:45-51` (el botón principal es "Mantener serie"); también `recurrence.ts:38-45,70,91-95` (once y custom día/semana ignoran dueDay; anual con `candidate>=startDate`) | Arrastrar el alquiler del 1-nov al 28-oct ("lo pago ya") pone dueDay=28 y el pago de octubre queda huérfano, así que vuelve a salir impagado. El 30-oct soltado sobre el 2-nov genera el 2-oct en atraso. En one-off y semanales es un no-op que dice "Movido" | Por defecto "solo este cobro". Si cambia el mes o la frecuencia es yearly/quarterly/once, nunca tocar la serie. Toast con "Aplicar a la serie" y "Deshacer" (`role=status`). Desactivar el drag de filas pagadas. Anuncios dnd localizados |
| A8 | **Los impagados del mes anterior desaparecen el día 1**, igual que el sábado 31 cuyo cobro es el lunes 2 | `use-expense-filters.ts:14,23-28`; `finance.ts:264-272`; `recurrence.ts:142`; los recordatorios descartan `daysUntilCharge<0` (`last-chance-reminders.ts:34`); `recurring-overview.ts:50-55` solo cubre quarterly/yearly | El 31-oct de 2026 es sábado. Un recibo impagado desaparece del timeline y de los totales el 1-nov, antes del cargo. Solo queda en Plan → Revisión → octubre | Selector puro `selectCarryOverOccurrences` limitado a desde `max(inicio del mes anterior, último mes cerrado + 1)` y solo `status==='due'`. Sección "Pendiente de octubre" con total propio, fuera de `pendingTotal`. Tests en las fronteras 1-oct y 1-nov |
| A9 | **Los borradores IA o locales llevan un `dueDay` distinto de `startDate`**, lo que crea una ocurrencia fantasma ya vencida | `parser.ts:81-90` (`startDate`=hoy); `recurrence.ts:105-120` (monthly no comprueba `cursor>=start`); `ExpenseSchedulePicker` no tiene campo dueDay; `ExpenseFormSheet.tsx:41-47` (el "¿ya pagado?" se basa en startDate); `parser.test.ts:29-39` fija el comportamiento incorrecto de "once" | "Netflix 15,99 el día 12" escrito el 23-oct crea un cargo el 12-oct "atrasado hace 11 días", sin preguntar | `normalizeParsedDraft` puro (ver §5). Exportar `getInitialOccurrenceDate` y usarlo en el prompt del formulario. Mostrar "Cobro: día 12 de cada mes". Guard opcional `cursor>=startOfMonth(start)` |
| A10 | **Una ocurrencia movida a otro mes desaparece de los totales del plan en ambos meses**: se genera por `occurrenceDate` pero se asigna al mes por `dueDate` | `recurrence.ts:139-145`; `finance.ts:152-158`; `plan-dashboard.ts:12-23`; `MoneyDashboard.tsx:80` más `CurrentMonthPlanSection.tsx:215` (el contador incluye el ítem y el total no) | Mover el 3-nov al 30-oct lo saca de octubre y de noviembre hasta el 1-dic. "Libre según el plan" queda inflado y las dos pestañas no cuadran | `occurrencesDueBetween(store, from, to)`: genera y luego añade los overrides cuyo dueDate cae en el rango aunque la occurrenceDate quede fuera (validados con `generateTemplateDates`), y filtra por dueDate. Usarlo en `occurrencesForMonth`, `use-expense-filters` y `annual-plan-summary` |

### Media

| # | Bug | Evidencia | Fix |
|---|---|---|---|
| M1 | Los dos "Por pagar" dan cifras distintas | Gastos `use-expense-filters.ts:45-54` (exige `estimatedChargeDate<=finMes` y usa ventana +7 días) frente a Plan `finance.ts:162-177` / `MoneyDashboard.tsx:232` | Selector único `monthPendingSummary` → `{total, items, spillToNextMonth}`, con la sublínea "incl. 45 € que se cobra lun 2 nov". Sigue mal el sábado 31-oct |
| M2 | Gastos no se refresca a medianoche ni al reanudar la PWA | `use-expense-filters.ts:13-21` (`new Date()` cuatro veces en el render); `ExpenseDashboard.tsx:40,49`; `use-timeline-initial-focus.ts:11,25-26` | `useCurrentDate()` → `useExpenseFilters(store, lang, now)`. Memo por `toDateOnly(now)`. Volver a enfocar cuando cambie `today` |
| M3 | `daysBetween` se desvía un día en el cambio de hora (**ocurre el 25-oct**) | `calendar.ts:67-71` (`Math.ceil` sobre medianoche local); `expense-actions.ts:92`; `last-chance-reminders.ts:29,34`; Vitest sin TZ | `differenceInCalendarDays(parseISO(to), parseISO(from))`. Tests con `TZ=Atlantic/Canary` (23→30-oct = 7; 30→27-mar-2027 = -3) |
| M4 | Gemini probablemente no responde en producción y los errores se etiquetan mal y no se registran | `route.ts:105` (`gemini-2.5-flash`), `:107` (`?key=`), `:54-58` (400/401/403/404 → `invalid_response`); no hay logs | Ver §5 (P0 de operaciones) |
| M5 | El estado o motivo de la IA nunca se ve | `ExpenseDashboard.tsx:59-66` cierra la hoja; `QuickCapture.tsx:56,126-139` | Banner en `ExpenseFormSheet` con proveedor y motivo, más CTA de login. `reset()` |
| M6 | El prompt no lleva fecha, categorías ni definiciones; dice "Spanish" | `route.ts:26-28` | §5 |
| M7 | Sin esquema estructurado, con zod estricto de todo o nada | `route.ts:118-121,144-148`; `parser.ts:5-23` | §5 |
| M8 | Cualquier categoría fuera de los 15 nombres exactos se convierte en "General" ("Alimentación", "Vehículo", inglés) | `categories.ts:27-34`; `expense-actions.ts:23`; `CategoryPicker.tsx:30` (ningún chip seleccionado); `docs/domain-model.md` incorrecto | Clave sin acentos (NFD), mapa de alias es/en, enum en el esquema, normalizar en servidor |
| M9 | Solo se usa el primero de hasta 10 gastos | `use-quick-expense-parser.ts:50`; `parser.ts:22`; `use-expense-store.ts:103-105` (en bucle se pisarían) | `parse()` devuelve `DraftExpense[]`. Revisión multi-gasto. `addExpensesToStore` como fold con un solo persist |
| M10 | El parser local falla con su propio placeholder | `parser.ts:81` ("día" acentuado no casa; `el` casa dentro de Miguel o Hotel); `:80` (toma el primer número; "1.250" → 1,25); `:45` (`ano` casa con piano o verano; "año" no se detecta); `:67-74`; `:104` (`amount\|\|1`) | Reescritura (§5). Tests con tablas de casos |
| M11 | Un store o un error de RPC malformado aborta el cron diario para todos los usuarios | `daily-reminders/route.ts:140-218,247,270,288`; `isExpenseStore` es una comprobación débil | try/catch por usuario, liberar leases, contador `errors`. Guardas en la generación |
| M12 | Las suscripciones push mueren en silencio | `sw.ts` sin `pushsubscriptionchange`; `push-notifications.ts:84-85` reutiliza la suscripción aunque cambie la VAPID; el cron no poda los 403 (`route.ts:68-69`); el re-sync solo ocurre en Settings | Heartbeat a nivel raíz (1/día y al volver a primer plano). Handler en el SW. Comparar `applicationServerKey`. `failure_count` |
| M13 | Se aceptan endpoints push arbitrarios: SSRF ciego y ralentización del cron | `subscribe/route.ts:6-12` (`z.string().url()`); `test/route.ts:81-115` (oráculo 200/409/502); grant de INSERT directo; envío secuencial sin timeout | `isAllowedPushEndpoint` (https, hosts FCM/Mozilla/Apple/WNS). Máximo 10 por usuario en BD. `{timeout:5000, TTL}`. `Promise.allSettled` |
| M14 | Open redirect en `/auth/callback` con `%09`, `%0A` o `%0D` | `auth/callback/route.ts:4-16,28` | Rechazar `[\u0000-\u001F\u007F\\]`, comprobar el origen con `new URL`, tests. Corregir `docs/platform.md:49-55` |
| M15 | El sign-out deja la suscripción push y los datos locales. La siguiente cuenta sube los datos de la anterior o falla con 500 al activar push | `use-settings-auth.ts:29-34`; `subscribe/route.ts:64-73` (bloqueo por RLS); `sync-policy.ts:37-41` + `assignExpenseStoreOwner` `store-normalization.ts:267-307` | Antes del signOut: `DELETE` + `unsubscribe()` de push, ofrecer limpiar datos. Guardar el owner en localStorage y no fusionar datos de otro usuario. RPC `claim_push_subscription` |
| M16 | "Editar sueldo del mes" en un mes actual o futuro se propaga a todos los siguientes (trampa con pagas extra) | `finance-commands.ts:145-153` (solo fija el mes siguiente si es pasado); igual `updateMonthlySavingsTargetInStore` | Ámbito "Solo este mes" o "Desde este mes". Sugerir "ingreso puntual" para la paga extra |
| M17 | En meses cerrados, "Libre" resta el objetivo de ahorro aunque no se ahorrara | `finance.ts:181` | En fase `registered` usar `savingsActual`. Mostrar "Objetivo no registrado" con CTA |
| M18 | Un `startDate` en un mes pasado crea recibos impagados fantasma en cada mes | `finance.ts:301,346,424-431`; `ExpenseFormSheet.tsx:40-47` solo ofrece "pagado" para el mes actual | Prompt "¿Marcar los meses anteriores como pagados o saltados?" → `markOccurrencesPaidInStore`. Opcional: `trackedFrom` |
| M19 | En móvil las filas no tienen acciones visibles ni tocables (solo swipe) e inaccesibles a lector de pantalla | `ExpenseRow.tsx:134` (`hidden sm:flex`), `:113-127` (sin onClick), `:119` (aria-label sin importe ni fecha) | OccurrenceActionSheet al tocar (§7) |
| M20 | El toast de recordatorio tapa el FAB | `components.css:812-830` frente a `:842-861` (z 35 > 30) | `--app-toast-offset` por encima del FAB y padding extra en la lista |
| M21 | `ConfirmActionDialog` sin gestión de foco, Escape ni bloqueo de scroll (borrar gasto o cuenta) | `ConfirmActionDialog.tsx:34-40,84` | Extraer `useDialogA11y` de `Sheet.tsx:48-110`. Foco en Cancelar |
| M22 | Detalle de gasto: tras guardar, `router.push("/")` hace que Atrás reabra el editor; sin guarda de cambios | `use-expense-editor.ts:79`; `ExpenseDetail.tsx:77-83,133` | `router.replace`, estado "dirty", nombre en el título del diálogo |

### Baja (resumen)

**Lógica y fechas**
- Lo que vence en fin de semana sale "Atrasado" el domingo y también el lunes, día del cobro (`expense-visual-state.ts:9-11`, `timeline.ts:41-51`, `expense-actions.ts:94-98`, `MonthlyExpenseRow.tsx:152`, `finance.ts:209`). Fix: helper `isOccurrenceOverdue` basado en `estimatedChargeDate`.
- `TimelineEmptyState` nunca se muestra, porque siempre se inyecta "today" (`timeline.ts:122-133`, `ExpenseList.tsx:67,88-90`).
- No se puede abrir el año siguiente en Plan desde diciembre (`plan-dashboard.ts:60-66`).
- Lo saltado no se puede restaurar (no existe comando; los filtros están en `MoneyDashboard.tsx:145` y `use-expense-filters.ts:40`).
- Ingresos extra futuros aparecen listados pero no cuentan en el total (`plan-dashboard.ts:38`).
- El guard de 500 pasos emite fechas fuera de la ventana en recurrencias diarias largas, y yearly ignora `interval` (`recurrence.ts:56-76,109-120`).
- La vista de recurrentes ignora los records (`recurring-overview.ts:55`).
- Reminders usan `generateOccurrences` y la UI usa `generateStoreOccurrences`.

**Concurrencia y merge**
- Comandos rápidos seguidos pueden pisarse por el closure obsoleto y la view transition (`use-expense-store.ts:96-101`, `use-view-transition-action.ts:19-21`).
- Ids de override aleatorios, `updatedAt` ausente y borrados de sueldo sin tombstone (`merge-by-id.ts:13-27`, `expense-commands.ts:33-41`, `finance-commands.ts:235`). **Hay que arreglarlo antes de A2.**
- `isMissingAppStoresError` trata errores de RLS como "sin nube" (`cloud-store.ts:82-88`).

**IA**
- Cerrar la hoja durante el parseo abre igualmente el formulario y, si se pulsó Manual, pisa lo tecleado (`use-quick-expense-parser.ts:41-45`, `ExpenseDashboard.tsx:59-66,124`).
- El rate limit vive en memoria por instancia y el Map nunca se vacía (`route.ts:22-52`).
- No se comprueba `finishReason` ni `blockReason` (`route.ts:135-138`).

**Plan**
- El formulario de ingreso puntual: Enter envía el formulario de alta en lugar de guardar la edición (`OneOffIncomePanel.tsx:38`), el nombre por defecto es "Bizum", la fecha sale en ISO crudo (`IncomeEventRow.tsx:85`) y el nombre de reserva está en español (`finance.ts:443`).
- El editor de fila solo ofrece categorías preset y fija `amountPaid=amount` (`MonthlyExpenseRow.tsx:52,188`, `expense-commands.ts:363,371`).
- "Vencido" frente a "Atrasado".
- Si una transferencia recurrente usa la categoría "Ahorro", se cuenta como gasto y además como ahorro.

**Plataforma**
- `notificationclick` navega antes de enfocar y siempre recarga (`sw.ts:171-185`).
- El badge es un PNG RGB sin alfa (`sw.ts:155`).
- El cron carga todos los stores sin paginar (`route.ts:99-112`), no fija `maxDuration` y nunca poda filas de entregas.
- `app_stores.store` no tiene límite de tamaño.
- No hay CSP, frame-ancestors ni Permissions-Policy (`next.config.ts`).
- `authorizeCron` compara con `===`; el sujeto VAPID por defecto es example.com; hay grants de escritura sobre `push_reminder_deliveries`.
- `/auth/callback` ignora el error de `exchangeCodeForSession` (`:25`).
- Login: letra "G" en lugar de logo, sin estado pendiente, `prompt:"consent"` forzado.
- Flash de tema e idioma al cargar (`layout.tsx:62-66`), sin `color-scheme` ni `theme-color` por tema.
- Re-render del dashboard en cada frame de scroll (`use-scroll-chrome.ts:54-69`) y variables CSS que nada consume.

**Accesibilidad y copy**
- Contraste por debajo de AA en `--app-text-subtle` (`tokens.css:182`), agravado por opacidades apiladas.
- Objetivos táctiles de 32-40 px.
- La nav no tiene `aria-current`; los anuncios de dnd-kit salen en inglés; `ListItem` trunca las descripciones.
- Faltan tildes ("repeticion", "Pago unico", "Proximo"…).

**Deuda técnica**
- Código muerto: `use-current-month-plan.ts`, `annual-plan-summary.ts`, campos de compatibilidad, `timelineHorizons`.
- Parsers e i18n duplicados.

---

## 3. Limitaciones de producto y UX (por prioridad)

1. **No existe el concepto de "mes activo" ni el paso al mes siguiente.** Todo está atado a `new Date()`. No hay prompt, estado ni preferencia; el estado "mes completado" no se puede alcanzar (§4).
2. **Lo del mes siguiente después del día 7 no se ve ni se puede pagar desde Gastos.** Las filas de Revisión no tienen botón de pagar (`MonthlyExpenseBreakdown.tsx:57-67`); hay que hacer editar → estado → guardar.
3. **Ni el timeline ni la cabecera dicen en qué mes estás.** Los títulos usan `EEEE d` sin mes. Lo pagado por adelantado del mes siguiente sube a la pila de pagados, por encima de "Hoy".
4. **El día de cobro (`dayOfMonth`) se pide pero no se usa.** No hay vista "hasta el cobro" ni "qué cubre el sueldo". `paidAt` tampoco se usa en ninguna agregación, así que lo prepagado es invisible en el mes en curso.
5. **La captura con IA está escondida.** Va dentro de un `<details>` cerrado, es un input de una línea, Enter no hace nada, el botón principal es "Manual", el foco cae en la X y no hay ejemplos. Los usuarios anónimos reciben la regex sin aviso y el cliente no sabe de antemano si hay IA disponible.
6. **No hay hoja de acciones al tocar un gasto.** Editar una ocurrencia concreta (importe real, fecha, saltar) solo es posible en Plan.
7. **No hay toast ni deshacer en ningún sitio.** Saltar es irreversible y borrar un ingreso se hace con un solo toque.
8. **El estado de sync y la conexión solo se ven en Settings → AccountRow.**
9. **Los avisos:**
   - Están desactivados por defecto en cada gasto y no se ven en las filas. El máximo es 5 días, insuficiente para cancelar un anual.
   - Llega como mucho un push por ocurrencia: nada el día del cargo ni si queda atrasado.
   - El push va solo en español, sin importe ni fecha, enlaza a `/` y caduca a las 4 semanas.
   - Se envía a las 08:00 UTC fijas.
   - En iOS dice "no soportado" en lugar de explicar cómo instalar la app.
10. **Sin onboarding.** El estado vacío no se alcanza, `demoStore` no se usa y, sin sueldo configurado, Plan muestra el aviso "Faltan para pagar recibos".
11. **No hay recibos variables ni "previsto frente a real".** Cambiar el precio sobrescribe la serie y no hay historial en el detalle.
12. **Esquema limitado:** categorías fijas y solo EUR; sin notas, URL de baja, permanencia, aviso de renovación ni método de pago. "Finalizar" queda escondido como `endDate` del formulario y lo visible es "Borrar", que también elimina el pago de este mes.
13. **No hay exportar, importar ni copia de seguridad.** `normalizeImportedExpenseStore` existe sin uso y no se llama a `storage.persist()`.
14. **Navegación de Plan fragmentada:** dos selects de año independientes, selects nativos, gráfico no clicable, lo proyectado se ve como dato real, `ReviewDelta` sin color de bueno o malo, sin fila de ingresos, progreso por número de recibos y no por importe.
15. **Las pagas extra no se modelan** y la ecuación es difícil de entender: el clamp a 0 oculta el sobrecompromiso y la cifra anual "Recurrente previsto" no cuadra con el gráfico.
16. **Hojas:** el asa no se puede arrastrar, el Atrás de Android sale de la página y en iOS el teclado puede tapar el botón Guardar.
17. **No hay búsqueda ni catálogo.** "Recurrentes" solo muestra trimestrales y anuales, y el README promete listas inteligentes que no existen.
18. **Pulido PWA:** sin shortcuts, share_target, badge ni theme-color dinámico, y el maskable no tiene margen propio.

---

## 4. El problema del "cambio de mes"

### 4.1 Comportamiento actual (hoy es viernes 23-oct-2026)

**Gastos**
- `use-expense-filters.ts:10-21` calcula en el render, a partir de `new Date()`: `today`, `windowStart` = 1-oct y `timelineWindowEnd` = 7-nov (`NEXT_MONTH_VISIBLE_DAYS=7`).
- `generateStoreOccurrences` filtra las ocurrencias dinámicas por `occurrenceDate` y los records por `dueDate`.
- `visibleOccurrences` mantiene `occurrenceDate<=31-oct || dueDate<=7-nov`.
- `pendingTotal` solo cuenta lo de octubre con `estimatedChargeDate<=31-oct` y se muestra como "Por pagar" sin nombre de mes.
- `buildTimelineSections` agrupa por estado visual con estas prioridades: paid 0 (siempre arriba), overdue 1, today 2 (siempre se inyecta) y future 3.

**Plan**
- `currentMonthDate = startOfMonth(useCurrentDate())`, así que la sección actual queda fija en el mes natural.
- La única navegación es la de `MonthlyReviewSection`, y en diciembre no ofrece el año siguiente.

**Historial y cobro**
- Se cierra por mes natural: `materializeClosedOccurrenceRecords` se ejecuta en cada carga y en cada persist.
- `dayOfMonth` (día de cobro) y `paidAt` no los lee ningún cálculo.

**Escenarios**

| Escenario | Resultado hoy |
|---|---|
| El 25-oct pago el alquiler del 1-nov (visible en la ventana) | El override pasa a pagado. La sección `paid-2026-11-01` (prioridad 0) aparece **por encima de Hoy** titulada "domingo 1", sin mes y sin atenuar. El total de Gastos no cambia. Cuenta como pagado en Revisión → noviembre |
| Recibo del 15-nov o seguro anual del 20-nov | No se genera nunca en Gastos. Solo Plan → Revisión → nov → editar → estado → guardar |
| Movistar del 30-oct sin marcar | El 1-nov desaparece del timeline, del total y del plan actual. Queda como "Vencido" en Revisión → oct. Los recordatorios dejan de avisar (A8) |
| Recibo del día 31 (sáb 31-oct, cobro estimado lun 2-nov) | En octubre no entra en el total de Gastos pero sí en el de Plan (M1). El 1-nov desaparece antes del cobro |
| Mover el 1-nov al 28-oct con "Solo este mes" | Cuenta en el total de Gastos de octubre, pero no en el plan de octubre ni en el de noviembre hasta el 1-dic (A10) |
| Arrastrar el 1-nov al 28-oct con "Mantener serie" (opción por defecto) | dueDay=28; el pago de octubre queda huérfano y el alquiler de octubre vuelve a salir impagado (A7) |
| Mes completamente pagado | Solo se ve "Sin cargos previstos hoy" y 0 €. No hay CTA ni celebración |
| PWA reanudada el 1-nov | Sigue mostrando octubre hasta que algo provoque un re-render (M2) |
| Diciembre | En Plan no se puede abrir enero de 2027 |

### 4.2 Diseños candidatos

**A. Ciclo financiero anclado al día de cobro** (periodo del 28 al 27)
- Pros:
  - Encaja con el flujo de caja real.
  - Tiene precedentes: Emma, Monzo, Finary, Goodbudget y Wallet. GoHoardly "cierra el periodo cuando entra el sueldo".
- Contras:
  - Sueldo, ahorro y records van por claves `YYYY-MM`, y la materialización es por mes natural. Habría que refactorizar `buildMonthlyMoneyPlan` a `{start, end, id}` con una regla de asignación (el ciclo pertenece al mes en que cae su cobro).
  - Febrero obliga a acotar el día a 1-28 o a usar "último día laborable".
  - Riesgo alto en tests y datos.
  - Variante ligera: el toggle opt-in `salaryFundsNextMonth` (el sueldo de M financia M+1, con reserva para el primer mes).

**B. Prompt explícito de "cerrar mes" o "pasar al siguiente" con mes activo persistido**
- Pros:
  - Responde exactamente a lo pedido y mantiene las claves `YYYY-MM`.
  - Riesgo bajo en el modelo.
  - Caduca solo cuando el calendario alcanza al mes activo.
  - Da un ritual (resumen, resolución de lo que queda y ahorro del mes).
- Contras:
  - Conviven dos nociones ("mes natural" y "mes activo"), así que `today` debe seguir siendo el día real.
  - Necesita estado sincronizado: `preferences` se fusiona dando prioridad a lo local y sin `updatedAt` (`local-store.ts:97-106`), así que no sirve.
  - Exige arreglar antes A8, A10 y A7.

**C. Navegador de meses** (pastilla con ‹ › en la cabecera, compartida por las dos pestañas)
- Pros:
  - Prepagar cualquier recibo del mes siguiente.
  - Arregla el paso de diciembre a enero.
  - Coste moderado.
  - Obliga a parametrizar las ventanas, cosa que B necesita igualmente.
- Contras:
  - Por sí solo no da el momento "mes completado, ¿pasamos?".
  - Navegar es efímero.

**Recomendación: B más C como un único sistema.** C es el mecanismo para navegar y B la vista por defecto persistida más el prompt. El día de cobro funciona como disparador (A ligera), y A completa queda como opción posterior.

- **Estado:** `finance.monthClosures?: Record<MonthId, {closedAt, updatedAt, reopenedAt?}>`, normalizado en `store-normalization.ts` y fusionado con `mergeMonthlyRecord` (`local-store.ts:138`). Los descartes del prompt se guardan por dispositivo en localStorage (`plan-close-dismissed:YYYY-MM`).
- **Dominio puro**, en `src/domain/budget-month.ts` (nuevo):
  - `monthRange` y `addMonthId` (mover `nextMonthId` desde `finance-commands.ts:171-175`).
  - `occurrencesDueBetween`, que también resuelve A10.
  - `selectCarryOverOccurrences`.
  - `monthPendingSummary`, que también resuelve M1.
  - `monthCloseStatus` → `{pendingCount, pendingTotal, leftovers[], nextMonthPaidCount}`.
  - `resolveActiveMonth(today, closures)`: el mes natural, más uno si ese mes está cerrado (tope +1).
  - `shouldSuggestAdvance({status, today, payday, dismissed})` = sin pendientes y (quedan 10 días o menos, o hoy ≥ cobro efectivo acotado al mes) y no descartado.
  - `getNextPayday` y `buildPaydayOutlook`.
- **Comandos:**
  - `closeMonthInStore(store, monthId, resolutions)`: pagado, saltar o mover; opcionalmente congela antes con `materializeClosedOccurrenceRecords({closedThrough})`.
  - `reopenMonthInStore`.
  - `markOccurrencesPaidInStore` en bloque.
  - `restoreOccurrenceInStore`.
- **Hook:** `useActiveMonth(store)` sobre `useCurrentDate()` → `{today, calendarMonthId, activeMonthId, viewMonthId, browse(±1), reset(), close(), reopen()}`.
- **UI:**
  - Pastilla de mes en el slot `headerAction` de `DashboardShell`. La cabecera pasa a "Por pagar · noviembre".
  - `MonthCloseCard` en lugar de la línea "Sin cargos previstos hoy": "Octubre al día · 12 pagados · ¿Pasamos a noviembre?" con [Ver noviembre] [Ahora no].
  - Toast cuando un `togglePaid` deja los pendientes del mes de 1 a 0.
  - Si después del cobro quedan recibos, `MonthCloseSheet` en pasos:
    1. Resumen frente al plan.
    2. Lo que queda, cada uno con [Pagado | Saltar | Mover a noviembre] reutilizando `MonthlyExpenseRow`.
    3. "Registrar ahorro de octubre".
    4. "Empezar noviembre".
  - Sección "Pendiente de octubre" con total propio y separadores de mes en el timeline.
  - Lo prepagado del mes siguiente se agrupa en "Ya pagado de noviembre" al final del timeline (no en la pila de prioridad 0).
  - Si el mes visto no es el natural, no se inyecta "Hoy"; en su lugar, "Noviembre empieza en 4 días".
  - Push opcional `month_close`.

### 4.3 Puntos del código que tocan la fecha actual

**Hay que parametrizarlos con `today` y `viewMonthId`:**
- `use-expense-filters.ts:10` (`NEXT_MONTH_VISIBLE_DAYS`), `:13-21` (cuatro `new Date()`), `:30-36` (ventana de la vista de recurrentes), `:38-43` (`visibleOccurrences`, pasar a dueDate), `:45-54` (`pendingTotal` → `monthPendingSummary`).
- `ExpenseDashboard.tsx:40` (llamada) y `:49` (`buildLastChanceReminders(store)` con `new Date()` por defecto).
- `ExpenseList.tsx:39` (`currentMonth=today.slice(0,7)`) → `timeline-expanded-month.ts:20-24,55-76`.
- `timeline.ts:28` (formato de título con mes si no es el mes visto), `:31-38` (prioridad de pagados), `:65` (subtítulo), `:122-133` (inyección de "Hoy" → `{showToday}`), `:146` (orden).
- `use-timeline-initial-focus.ts:12-26`, `TimelineSectionHeader.tsx:16` (atenuado), `expense-actions.ts:104` (formato de `statusLabel`).
- `DashboardShell.tsx:52-57`: cabecera sin mes; solo hay que añadir la etiqueta.
- `MoneyDashboard.tsx:61-65` (`currentMonthDate`), `:66`, `:80`, `:100-104` (`selectedMonthId` por defecto), `:141`, `:145`, `:176` (`savingsMonthId`), `:249` (`openSavings`), `:286-291`; `CurrentMonthPlanSection.tsx:61` (título).
- `finance.ts:128` (`today` por defecto), `:192-198` (fase: `current` para el mes activo; `registered` y `projected` siguen anclados al calendario real), `:60,64` (valores de reserva de `toMonthId`).
- `plan-dashboard.ts:12-23` (`occurrencesForMonth` → `occurrencesDueBetween`), `:38` (`includeExtraIncome`), `:60-66` (`getAvailableYears` +1).
- `use-current-month-plan.ts`: código muerto; borrarlo o reconvertirlo en `useMonthPlan(store, monthId, today)`.

**Deben seguir con el `today` real:**
- `expense-commands.ts:23` (inicio por defecto).
- `dashboard-config.ts:37-48` (`createEmptyDraft`).
- `ExpenseFormSheet.tsx:40-47` (`isPastCurrentMonthDay`; pasar a `getInitialOccurrenceDate`).
- `parser.ts:87-90`.
- `receivedAt` del ingreso puntual (`use-one-off-income-form.ts:30`, `MoneyDashboard.tsx:180`).
- `finance-commands.ts:56,146` (guardas de congelado).
- `store-history.ts:8` y `store-normalization.ts:201,240` (cierre por mes natural).
- `last-chance-reminders.ts:13` y `daily-reminders.ts:12`.

**Secuencia**
1. Prerrequisitos: A5 (helper upsert), A7, A8, A10, M1 y M2.
2. C: ventanas parametrizadas, etiquetas de mes, pastilla y `getAvailableYears` +1.
3. B: `monthClosures`, tarjeta, hoja y toast.
4. Disparador por día de cobro y "Hasta el cobro".
5. A opt-in.

Tests: `vi.setSystemTime` el 31-oct a las 23:59 y avance de los fake timers al 1-nov con TZ fija. Casos: sábado 31 → lunes 2, cierre con lo que queda, caducidad del mes activo.

---

## 5. Gemini: causas del mal resultado y diseño objetivo

### 5.1 Causas raíz (de mayor a menor peso probable)

1. **Operaciones (hipótesis a verificar).**
   - Desde el 18-sep-2026 `gemini-2.5-flash` solo se sirve a cuentas que ya lo usaban; los proyectos nuevos reciben 404.
   - Google rechaza las claves sin restricción desde el 19-jun-2026, según el foro de Google.
   - `reasonFromGeminiStatus` (`route.ts:54-58`) convierte 400, 401, 403 y 404 en `invalid_response` y no hay ningún log, así que todo cae en silencio a la regex.
   - Comprobación: `curl -H "x-goog-api-key: $KEY" https://generativelanguage.googleapis.com/v1beta/models` con la clave de producción, más revisar `GEMINI_API_MODEL` en Vercel.
2. **El resultado nunca se ve** (M5). Un fallback local (`missing_key`, `unauthenticated`, `timeout`…) parece "Gemini lo hace mal".
3. **Barreras previas:** primero `missing_key` y después `unauthenticated` (`route.ts:79-95`), sin CTA. El rate limit está en memoria.
4. **Prompt pobre** (`route.ts:26-28`): sin fecha ni zona horaria, sin lista de categorías, sin definir `dueDay`, `startDate` ni `annualMonth`, sin reglas para datos ausentes, "Spanish text", sin `systemInstruction` ni ejemplos.
5. **Sin esquema estructurado y con zod de todo o nada** (`parser.ts:5-23`): un `amount` null, un `dueDay` null en "once", `description` null, una descripción de más de 240 caracteres o un array vacío descartan la respuesta entera (`route.ts:144-148`).
6. **Latencia:** el razonamiento por defecto de 2.5 Flash contra un timeout de 8 s, sin `maxOutputTokens` ni comprobación de `finishReason` (MAX_TOKENS o SAFETY también acaban como `invalid_response`). `temperature` se ignora a partir de 3.6.
7. **Solo se usa `expenses[0]`** (M9).
8. **No hay post-proceso:** incoherencia entre dueDay y startDate que genera un vencido fantasma (A9), categorías que acaban en General (M8) y fechas imposibles que rompen la app (A3).
9. **El fallback local es débil** (M10), así que cada fallo silencioso se nota mucho.

### 5.2 Diseño objetivo

**Modelo**
- `GEMINI_API_MODEL` configurable, con valor por defecto **`gemini-3.5-flash-lite`** (GA el 21-jul-2026; razonamiento mínimo por defecto).
- Respaldo `gemini-3.1-flash-lite` ante 404, 429 o 503.
- Si la calidad no basta, `gemini-3.8-flash` con `thinkingLevel:"LOW"` (rechaza MINIMAL).
- Sin alias `-latest`. Verificar los ids con `GET /v1beta/models`. Actualizar `.env.example`, README y `docs/platform.md`.

**Autenticación y cumplimiento**
- Cabecera `x-goog-api-key` y `encodeURIComponent(model)`.
- Comprobar el tipo y las restricciones de la clave en AI Studio.
- **Billing activo:** según los términos de la Gemini API, una app usada en EEE, Suiza o Reino Unido solo puede usar servicios de pago. En el plan gratuito el contenido además puede usarse para mejorar los productos de Google.

**Petición**
- `systemInstruction` (reglas) separado del contenido `user` (texto delimitado).
- `generationConfig`: `{responseMimeType:"application/json", responseJsonSchema, thinkingConfig, maxOutputTokens:1024-2048}`, **sin temperature**.
- `thinkingConfig` según el prefijo del modelo: 3.x → `{thinkingLevel:"MINIMAL"}`; 2.5 → `{thinkingBudget:0}`. Mandar `thinkingLevel` a 2.5 devuelve 400.
- Nota: en la revisión REST 20261019, `responseSchema` y `responseJsonSchema` están marcados como obsoletos a favor de `responseFormat`, pero el SDK 2.31 aún expone `responseJsonSchema`. Se mantiene y se planifica la migración.

**Esquema**, escrito a mano y no con `z.toJSONSchema` tal cual (emite `exclusiveMinimum`, `$schema` y `pattern`). Snapshot test.
- Raíz: `{transcript?, expenses[0..10], notAnExpense?}`.
- Cada ítem:
  - `name`
  - `amount: number|null`
  - `categoryName`: enum de `PRESET_EXPENSE_CATEGORIES`
  - `frequency`: enum `once|monthly|quarterly|yearly|custom` (sin rrule)
  - `interval|null`, `unit|null`, `dueDay 1-31|null`, `annualMonth 1-12|null`, `startDate: date|null`
  - después: `endDate`, `reminder`, `status:'paid'`, `currency`, `intent`
- Los nulos se expresan con `anyOf:[…,{type:"null"}]`; probar contra el modelo elegido.
- `minLength` y `maxLength` se ignoran; `minItems` y `maxItems` sí se aplican.

**Prompt**
- Hoy en ISO con día de la semana y zona IANA. Los envía el cliente; el servidor los acota a ±2 días de su hora y si no, usa Atlantic/Canary.
- Idioma es/en, EUR, los presets con una pista de una línea cada uno.
- Definiciones:
  - `startDate` = primer cargo, igual o posterior a hoy salvo pasado explícito.
  - `dueDay` = día del mes.
  - `annualMonth` = mes de los anuales.
- Correspondencias: mensual, trimestral, anual, "cada N meses" → custom, puntual → once.
- "12,99" = 12.99. "Dato desconocido → null; nunca inventes importes". Un ítem por cada recibo mencionado.
- 4-6 ejemplos en es y en.
- Contexto acotado: hasta 50 recibos existentes `{name, amount, dueDay, frequency}` para detectar duplicados. El servidor no lee la nube.

**Post-proceso en servidor y cliente**
- `safeParse` por ítem: se conservan los válidos y se devuelve `droppedCount`. Solo si no queda ninguno se cae al parser local.
- `normalizeParsedDraft(draft, {today})` puro en `src/domain`:
  - Valida la fecha.
  - Reconcilia dueDay y startDate: si existe startDate, manda su día. Si falta, `buildDateWithDay(today, dueDay)` en el mes actual y el formulario pregunta "¿ya pagado?". Con el mes activo adelantado o a final de mes, se propone el mes siguiente.
  - Deriva `annualMonth`.
  - Categoría sin acentos más alias.
  - `amount` null → `missingFields`; nunca 1.
  - Recorta la descripción.
  - Devuelve `inferredFields` y `missingFields`.
- Se aplica también a la salida del parser local y dentro de `addExpenseToStore`.

**Errores**

| Respuesta | Motivo | Acción |
|---|---|---|
| 400 API_KEY_INVALID, 401, 403 | `auth_failed` | No reintentar |
| 404 | `model_unavailable` | Pasar al modelo de respaldo y alertar |
| Otros 400 | `bad_request` | No reintentar |
| 429 | quota/rate | Reintentar una vez solo si `retryDelay` ≤ 2 s; si no, respaldo |
| 5xx o 504 | — | Un reintento con jitter y después respaldo |
| `blockReason` o SAFETY | `blocked` | — |
| MAX_TOKENS | `truncated` | — |
| JSON o esquema inválido | `invalid_response` | — |

- `console.error` estructurado con status, modelo, latencia y motivo, nunca con el texto del usuario.
- Timeout de 10 s para texto y 15 s para audio, que cubra solo el fetch.
- Extraer `src/data/ai/gemini-client.ts`, compartido por texto y voz.

**Cuota**
- Antes de la voz: límite diario durable con tabla `ai_usage(user_id, day, count)` y RPC `consume_ai_quota`.
- Tope de presupuesto en GCP.
- El Map en memoria queda como guarda de ráfagas, eliminando las claves vacías.

**UX**
- `parse()` devuelve `{drafts[], provider, reason, transcript}`, con `AbortController` + `cancel()` y `reset()`.
- `GET /api/ai/status` → `{available, reason}`.
- QuickCapture pensado primero para la IA: `<form>` con textarea autoajustable, Enter envía (Shift+Enter salta de línea, respetando `isComposing`), `enterKeyHint`, autofocus, chips de ejemplo, micrófono, y "Manual" como opción secundaria.
- Banner en `ExpenseFormSheet`: "Interpretado con IA" o "Análisis básico: <motivo>" con CTA de login.
- Con 2 o más ítems, `QuickCaptureReview`: tarjetas con frase resumen (`localizedRecurrenceLabel`), chips de aviso ("fecha inferida", "falta importe", "ya existe Netflix"), toggle de incluir, editar y "Guardar N" con `addExpensesToStore`.
- La key del formulario pasa a ser un nonce de sesión (`draftSession`).
- Importe vacío en lugar de 1, con error de validación.

**Parser local reescrito**
- Normaliza NFD y quita diacríticos.
- Límites de palabra Unicode.
- Quita el día del texto antes de buscar el importe.
- Prioridad del importe: número junto a € o eur, luego número con decimales, luego el resto. Regla de miles.
- Vocabulario: semanal, quincenal, bimestral, semestral, "cada año", nombres de mes, marcas comerciales.
- Parámetro `today`.

**Tests**
- Fixtures con 30-40 frases en es y en, incluidos ambos placeholders.
- Route tests:
  - Éxito.
  - URL sin `key=` y cabecera presente.
  - `thinkingConfig` y esquema enviados.
  - Respuesta inválida según el esquema y array parcialmente válido.
  - AbortError, 5xx, 401/403/404, blocked y MAX_TOKENS.
  - `rate_limited` (con `vi.resetModules`) y 400 por entrada inválida.
- Tests del normalizador y del esquema.
- Script de evaluación opt-in con la clave real.

---

## 6. Voz

### 6.1 Arquitectura recomendada (un único botón de micrófono, por niveles)

**Nivel B, principal** (usuario con sesión y IA disponible)
- `getUserMedia` mono con `echoCancellation`, `noiseSuppression` y `autoGainControl`.
- `MediaRecorder` a `audioBitsPerSecond:32000`.
- Tipo MIME elegido con `isTypeSupported`, en este orden: `audio/webm;codecs=opus` → `audio/mp4;codecs=mp4a.40.2` → `audio/mp4` → `audio/ogg;codecs=opus`.
- Tope de 30 s y mínimo de 0,7 s.
- Tocar para empezar y tocar para parar (no mantener pulsado, por WCAG 2.5.2), con Cancelar, cronómetro y medidor de nivel (estático con reduced-motion). Se detiene en `visibilitychange`.
- POST a la misma ruta:
  - El esquema de petición pasa a ser la unión `{text} | {audio:{mimeType, data}}` (o multipart), con un máximo aproximado de 1 MB y lista de MIME permitidos.
  - El servidor envía `inlineData` con el mismo `systemInstruction` y esquema, con `transcript` como primer campo, y devuelve `{transcript, expenses}`.
- La transcripción se muestra editable y se puede volver a analizar como texto. **La revisión antes de guardar es obligatoria.**
- Si Gemini rechaza `audio/mp4`, transcodificar en el cliente a WAV de 16 kHz mono con AudioContext (unos 32 KB/s; 30 s ≈ 1 MB, por debajo del límite de 4,5 MB de body en Vercel).
- El audio exige sesión, no tiene fallback local y cuenta como varias unidades de la cuota.

**Nivel A, mejora progresiva**
- `SpeechRecognition` o `webkitSpeechRecognition` solo en Chromium (escritorio y Android), con `lang` es-ES/en-US y `interimResults`, escribiendo en el textarea → pipeline de texto.
- Funciona sin sesión, porque cae al parser local.
- **Nunca en WebKit ni a la vez que `getUserMedia`.**

**Nivel 0, base**
- Textarea con la pista "usa el micrófono del teclado". El dictado del sistema funciona en todas partes, también offline y sin sesión.

### 6.2 Matriz de soporte

| Contexto | Web Speech | MediaRecorder | Ruta |
|---|---|---|---|
| Chrome/Edge escritorio | Sin prefijo desde 139; usa servidor de Google; `processLocally` solo escritorio 139+ | webm/opus | A → texto; B como respaldo |
| Chrome Android (tab o instalada) | Sí; `continuous` se ignora; usa servidor | webm/opus | B por defecto; A opcional |
| Safari macOS / iOS en pestaña | `webkit` 14.1+; requiere Siri; falla junto a `getUserMedia` | 14.1+: mp4/aac; webm/opus desde 18.4 | B |
| **iOS PWA en pantalla de inicio** | **No disponible o poco fiable** (WebKit 225298 RESOLVED LATER; cuelgues en 26.6/27) | Sí; **el permiso de micrófono se vuelve a pedir en cada arranque en frío** | B (explicar el permiso antes; mantener el stream mientras la hoja esté abierta) |
| Firefox | No (solo preview) | ogg/webm opus | B |
| Brave | Bloqueado | Sí | B |
| Sin MediaRecorder, sin sesión o sin clave | — | — | Ocultar o desactivar el micrófono con el motivo; nivel 0 |

### 6.3 Errores, privacidad y archivos

**Estados de error**

| Situación | Mensaje o comportamiento |
|---|---|
| `NotAllowedError` | Cómo reactivarlo: iOS Ajustes › Safari › Micrófono |
| `NotFoundError` | No se ha encontrado micrófono |
| `NotReadableError` | El micrófono está en uso por otra app |
| Clip demasiado corto | Pedir que se intente de nuevo |
| Resultado vacío | "No te he entendido" |
| Offline | Conservar el clip en memoria y ofrecer Reintentar |
| Timeout o cuota | Usar la transcripción si la hay; si no, entrada manual |

Los cambios de estado se anuncian en una región `aria-live`.

**Privacidad**
- Aviso único: "El audio se envía a Google Gemini para interpretarlo; no se guarda".
- Billing activo y no almacenar los clips.
- `Permissions-Policy: microphone=(self)` en `next.config.ts`.

**Coste**
- 32 tokens/s (25 en Gemini 3): 20-30 s son unos 640-960 tokens, alrededor de 0,0005 $ por clip. Las cifras de precio son de terceros; verificarlas.

**Archivos**
- `features/expenses/lib/voice-support.ts` (puro, testeado): `pickRecorderMimeType` y `getVoiceCapability` → `record | dictate | unavailable`.
- `hooks/use-voice-capture.ts`: máquina de estados idle → permission → recording → processing → done | error.
- `hooks/use-live-dictation.ts`: solo Chromium.
- Extensión de `route.ts` y `route.test.ts`.
- Textos nuevos en i18n.

**Pruebas en dispositivo real**
- iPhone con iOS 26.x y 27.x, en pestaña y en pantalla de inicio.
- Android Chrome, en pestaña e instalada.
- Escritorio Chrome.
- En cada uno: tipo MIME elegido, aceptación de webm y mp4 por Gemini, y frases como "doce con noventa y nueve" o "mil doscientos".

---

## 7. Nuevas funcionalidades de valor (impacto × esfuerzo × encaje)

Fundamentos que van antes que cualquier feature (P0): A1-A10, M2-M4 y el merge con ids deterministas.

| # | Funcionalidad | Qué y por qué | Dónde vive (qué reutiliza) | I | E | Encaje |
|---|---|---|---|---|---|---|
| 1 | **Mes activo y "Cerrar mes / ¿Pasamos a noviembre?"** | Lo que el dueño pidió primero. No encontré ninguna app que lo pregunte de forma explícita: es una diferencia | `src/domain/budget-month.ts`, `finance.monthClosures`, `useActiveMonth`, `MonthCloseCard`/`MonthCloseSheet` (`MonthlyExpenseRow`, `Sheet`, comandos existentes) | Alto | M | Alto |
| 2 | **"Pendiente de <mes>" y etiquetas o separadores de mes** | Lo que quedó sin pagar no desaparece; lo prepagado se entiende | `selectCarryOverOccurrences`, `timeline.ts` con `{viewMonth}` | Alto | S | Alto |
| 3 | **Captura inteligente v2** | Arregla "funciona fatal"; varios gastos con revisión | §5; `QuickCaptureReview`, `addExpensesToStore`, `gemini-client.ts` | Alto | M | Alto |
| 4 | **Hoja de acciones al tocar un gasto y toast genérico con Deshacer** | Pagar, pagar con otro importe, mover solo este, saltar, editar serie, finalizar. Accesible y descubrible | `Sheet`, `useMonthlyExpenseRowEditor`, `Toast` (a partir de `.app-last-chance-toast`), deshacer con patch inverso | Alto | M | Alto |
| 5 | **"Hasta el cobro (mié 28 · 5 días): X €"** | Usa `dayOfMonth`, que ya existe; responde a la pregunta real de liquidez | `buildPaydayOutlook` en el dominio, tarjeta en `CurrentMonthPlanSection` | Alto | S-M | Alto |
| 6 | **Entrada por voz** | Pedida explícitamente; Copilot y Monarch no la tienen | §6; depende de #3 | Alto | M | Alto |
| 7 | **Avisos 2.0** | Aviso por defecto en Ajustes, campana en las filas, 7/14/30 días para anuales y trimestrales, etapas (antes, día del cargo, "¿se cobró?"), push localizado con importe y deep link `/?occurrence=`, TTL, tipos `month_close`, `payday`, `renewal`, `weekly_digest` | `last-chance-reminders.ts` → `reminder-schedule.ts`; columna `kind` del RPC sin cambio de esquema; `buildMonthlyMoneyPlan` | Alto | M | Alto |
| 8 | **Exportar e importar JSON/CSV, snapshots locales y `storage.persist()`** | Confianza y recuperación ante A1-A3 | `normalizeImportedExpenseStore`, `mergeExpenseStores`, filas de Settings | Medio-alto | S | Alto |
| 9 | **Recibos variables** | "Pagado con otro importe", estimación con la media de los 3 últimos, delta "72,40 € (previsto 64,75)" | `updateMonthlyExpenseOccurrenceInStore` separando previsto y pagado; `amountKind` en la plantilla | Medio-alto | S-M | Alto |
| 10 | **Finalizar o pausar suscripción** | "Finalizar" como acción principal (usa `endDate`, conserva el pago del mes); pausa como rangos `pauses[]`, no `active` | `ExpenseDetail`, `use-expense-editor` | Medio | S | Alto |
| 11 | **Provisión para recibos no mensuales y "próximos recibos grandes (90 días)"** | Evita el susto del seguro o el IBI ("aparta 42,86 €/mes") | `buildRecurringOverview`, `generateTemplateDates` | Medio-alto | S | Alto |
| 12 | **Cambios de precio programados y detección de subidas** | `amountChanges[]` con efecto desde una fecha; "¿Desde cuándo?" al editar; línea temporal de precio en el detalle | Patrón de `latestRecordValue`; `plannedAmount` de los records | Medio | M | Alto |
| 13 | **Coste por categoría y anualizado** | "Suscripciones: 47,97 €/mes · 575,64 €/año", % del sueldo | `buildRecurringCostInsights` en `plan/lib`, `PlanSectionList` | Medio | S | Alto |
| 14 | **Onboarding inicial** | Chips de alta rápida (Alquiler, Luz, Netflix…), checklist (sueldo y cobro, avisos, instalar, iniciar sesión), datos demo relativos a hoy | `createEmptyDraft`, `PlanSettingsSheet`, `seed.ts` (no reutilizar fechas fijas) | Medio | S-M | Alto |
| 15 | **Pagas extra y "¿Has cobrado?"** | Habitual en España; corrige M16 | `extraPayments` en el sueldo, `salaryReceipts` (`mergeMonthlyRecord`) | Medio | M | Alto |
| 16 | **Catálogo "Suscripciones" o "Todos"** | Búsqueda, filtros por categoría y estado, total en €/mes y €/año | Generalizar `buildRecurringOverview` y `RecurringOverviewCard`, tercera tab | Medio | M | Medio |
| 17 | **Campos nuevos**: notas, URL de baja, permanencia, aviso de renovación, categorías propias, método de pago | Gestión real de contratos | `ExpenseTemplate` opcionales más normalización y merge; `CategoryPicker` con "+ nueva" | Medio | M | Medio |
| 18 | **Comandos por IA y voz** ("marca la luz pagada 71,20", "salta el gimnasio") y detección de duplicados | Atajo de fin de mes | `intent` en el esquema; `togglePaidInStore`, `updateMonthly…`, `skip…`; `normalizeMerchantKey` (recuperable con `git show 95c2f24^`) | Medio | M | Medio |
| 19 | **Pulido PWA** | Shortcuts (Añadir gasto, Añadir por voz `?mode=voice`, Plan), `share_target`, `setAppBadge`, guía de instalación en iOS, `theme-color` por tema, maskable con margen, badge monocromo | `manifest.ts`, `/expenses/new`, `ThemeApplier`, `NotificationsRow` | Medio | S | Alto |
| 20 | **Resumen del mes** ("Octubre: 12/12 · X € frente al plan") | Ritual ligero sin rachas | Paso 1 de `MonthCloseSheet` | Medio | S | Medio |
| 21 | **Registro de saldo** ("¿Cuánto tienes ahora?") | "Te quedan ~426 € hasta el cobro (≈85 €/día)"; encaja con la voz | `finance.balanceCheckins[]` | Medio | S | Medio |
| 22 | **Ciclo anclado al cobro, opt-in** (opción A) | Para quien cobra a final de mes | `budget-month.ts` con `{start,end,id}` | Medio | L | Medio |
| 23 | **Festivos en `estimateChargeDate`** | Fechas de cobro reales | `src/domain/holidays.ts` | Bajo | S | Alto |
| 24 | Feed ICS / hogar compartido | Piden servidor o cambios de RLS | — | Bajo | M-L | Bajo |

**Fases**
- **P0:** fundamentos, operaciones de Gemini, M3 (DST esta semana) y M1 antes del 31-oct.
- **P1:** #1, #2, #3, #4, #5, #8.
- **P2:** #6, #7, #9-#14, #19.
- **P3:** el resto.

---

## 8. Piezas reutilizables

**Dominio**
- `finance.ts`: `generateStoreOccurrences` (:245; aquí se arregla la ventana), `buildMonthlyMoneyPlan` (:124; ya separa pagado y pendiente), `materializeClosedOccurrenceRecords` (:292; añadir `closedThrough`), `latestRecordValue` (:112; patrón de vigencia), `getMonthlySalarySettings` (:70; payday), `toMonthId` (:50), `occurrenceRecordId` (:370).
- `recurrence.ts`: `generateTemplateDates` (:78) y `generateOccurrences` (:125, extraer el mapper).
- `calendar.ts`: `buildDateWithDay`, `estimateChargeDate` y `estimatedChargeLabel`, `toDateOnly`, `formatCurrency`, `APP_TIME_ZONE`.
- `categories.ts`: `PRESET_EXPENSE_CATEGORIES` y `resolvePresetCategory` (añadir NFD y alias).
- `parser.ts`: esquemas y `categoryHints`. `seed.ts`: `demoStore`.

**Comandos y store**
- `expense-commands.ts`:
  - `dismissLastChanceReminderInStore` (:78-116): patrón correcto de spread, base para `upsertOccurrenceOverride`.
  - `togglePaidInStore`, `skipOccurrenceInStore`, `moveOccurrenceOnlyInStore`, `updateMonthlyExpenseOccurrenceInStore`.
  - `persistableDueDate` (:392).
  - `getInitialOccurrenceDate`: exportarla.
- `finance-commands.ts`: `nextMonthId` (:171-175; mover a `addMonthId`), `updateMonthlySavingsContributionInStore`, patrón `update*InStore`.
- `preference-commands.ts` y `use-expense-store.ts` (`persist`, exposición de comandos, `syncStatus`); `store-history.ts`.

**Persistencia**
- `local-store.ts`: `mergeExpenseStores` (:43), `mergeMonthlyRecord` (:138), `clearExpenseLocalData`.
- `merge-by-id.ts`: `mergeLatestById`, `latestUpdated`.
- `store-normalization.ts`: `normalizeExpenseStore` (:199), `normalizeImportedExpenseStore` (:259, sin uso), `assignExpenseStoreOwner` (:267).
- `sync-policy.ts`: `resolveHydratedStore`. `use-cloud-save-queue.ts`: `saveImmediately`. `cloud-store.ts`: `loadCloudStore`.

**Hooks y lib de features**
- `shared/hooks/use-current-date.ts`: `useCurrentDate` y `millisecondsUntilNextDay`.
- `use-expense-filters.ts` (parametrizar) y su harness de tests con `vi.setSystemTime`.
- `timeline.ts`: `buildTimelineSections` y `sortSections`. `expense-visual-state.ts`: `resolveExpenseVisualState`. `expense-actions.ts`: `statusLabel`, `findOrCreateCategory`, `buildTemplateFromDraft`, `categoryToneClass`.
- `expense-schedule.ts`: `updateDraftStartDate` y `updateDraftRecurrence`. `recurrence-label.ts`: `localizedRecurrenceLabel`. `euro-input.ts`, a consolidar.
- `recurring-overview.ts`: `buildRecurringOverview`. `last-chance-reminders.ts` y `daily-reminders.ts`.
- `use-swipe-action.ts` y `swipe-state.ts` (reductor de gestos, reutilizable para cerrar hojas arrastrando). `use-view-transition-action.ts`.
- Plan: `plan-dashboard.ts` (`occurrencesForMonth`, `buildSeriesItem`, `getAvailableYears`, `formatShortDate`, `phaseLabel`); `MonthlyExpenseRow` + `use-monthly-expense-row-editor`; `SkipOccurrenceDialog` + `use-skip-occurrence-confirmation`; `PlanPaydayField`; `MonthlyTrendChart` (añadir onClick y estilo por fase); `use-current-month-plan.ts` (reconvertir).

**UI**
- `Sheet` (focus-trap, Escape, scroll lock: base de `OccurrenceActionSheet`, `MonthCloseSheet` y `QuickCaptureReview`).
- `IconButton` (tamaño `touch` = 44 px), `Button` (`leadingIcon`), `Field` (prop `error` sin uso), `DatePickerField` (claves de i18n `previousMonth`/`nextMonth` para la pastilla de mes), `SelectMenu`, `ConfirmActionDialog`, `OfflineLink`, `ListItem`/`SettingRow`.
- `DashboardShell` (slot `headerAction`, título y etiqueta de cabecera), `LastChanceReminderToast` y el CSS `.app-last-chance-toast` (`components.css:842-861`) como base de `Toast`.
- `ExpenseFormSheet` y `ExpenseForm` (editar cada ítem desde la revisión), `ReminderControls`.

**Plataforma**
- `daily-reminders/route.ts`: `claimReminderDelivery`, `markReminderDelivered`, `releaseReminderDelivery`, `buildReminderDeliveryKey`, `isExpiredPushSubscription`. RPC `claim_push_reminder_delivery` con `kind`.
- `push-notifications.ts` (subscribe, save, delete, health, `urlBase64ToUint8Array`); `use-notification-settings` (`synchronizeSubscription` → heartbeat a nivel raíz).
- `sw.ts` `notificationclick` (ya respeta `data.url`); `/expenses/new` con `initialNewExpense` (shortcuts, share_target, `?mode=voice`).
- `resolveSafeRedirectPath`, una vez arreglado. `admin-client.ts` (`createSupabaseServiceClient`), `utils/supabase/server.ts`.
- i18n: `t()` y `i18n-messages.ts`, que debe absorber `planCopy` y los ternarios.
- Recuperables con `git show 95c2f24^`: `normalizeText` y `normalizeMerchantKey` (`bank-import.ts`), y el patrón de tarjeta incluir/emparejar-o-crear de `BankImportCandidateCard`/`Controls`.

---

**Datos externos sin confirmar.** Verificarlos antes de comprometerse:
- La fecha de apagado de 2.5 Flash en la Gemini API (las fuentes se contradicen).
- La migración de claves a "auth keys".
- Los precios exactos.
- Si Gemini acepta `audio/mp4` de Safari.
- El límite de 4,5 MB de body en Vercel.
