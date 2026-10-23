# Plataforma

Esta app combina Next App Router, PWA, Supabase Auth, Supabase cloud sync,
notificaciones web y un endpoint de parseo AI con fallback local.

## PWA

La metadata PWA se define en `src/app/layout.tsx` y `src/app/manifest.ts`.

La app usa:

- `manifest.webmanifest`.
- Iconos versionados en `public/`. Los maskable (`icon-maskable-192.png` y
  `icon-maskable-512.png`) llevan el dibujo dentro de la zona segura y el
  badge de las notificaciones (`badge-96.png`) es una silueta blanca con
  transparencia; los genera `scripts/generate-pwa-icons.mjs` (sharp) a partir
  de `app-icon-1024.png`.
- `display: standalone`.
- `orientation: portrait`.
- `start_url` y `scope` en `/`.
- Atajos al mantener pulsado el icono (Android): "Añadir gasto"
  (`/expenses/new`), "Añadir por voz" (`/expenses/new?mode=voice`) y "Plan"
  (`/money`).
- `theme-color` del tema elegido (`THEME_COLORS` en `src/shared/theme.ts`, que
  un test compara con `--noctalia-background` de cada tema): el layout pone el
  del tema por defecto, `boot-guard` el de la cookie al cargar y
  `setThemeDom` el del tema al cambiarlo.
- Número en el icono (`navigator.setAppBadge`) con los recibos vencidos y los
  que vencen hoy desde el mes anterior (`countAttentionOccurrences`):
  `AppBadgeSync` lo actualiza en cualquier pantalla y cada push trae el suyo.
- Ajustes muestra en iPhone/iPad sin instalar la fila "Instalar en el iPhone"
  con los pasos (Compartir › Añadir a pantalla de inicio): en iOS los push
  solo funcionan con la app instalada (16.4 o posterior).
- Registro del service worker desde `PwaRegister`.

## Service worker

Serwist genera `public/sw.js` desde `src/pwa/sw.ts` durante el build. El archivo
generado no se versiona.

La app precachea los recursos del build y las rutas prerenderizadas (`/`,
`/money`, `/settings`, `/login`, `/expenses/new`).

Navegacion y red:

- Las rutas precacheadas se sirven desde cache sin esperar a la red. El
  navigation preload esta desactivado (`navigationPreload: false` mas
  `disableNavigationPreload()`, porque la preferencia vive en el registro).
  Con preload, una red que acepta la conexion pero no responde dejaba la app
  colgada al abrirla sin cobertura real.
- `ignoreURLParametersMatching` ignora `utm_*`, `fbclid`, `dpl` (Skew
  Protection de Vercel), `from`, `mode` y `occurrence`. Asi
  `/settings?from=money` usa `/settings`. Esos parametros se leen siempre en
  cliente: una pagina que lea `searchParams` en servidor deja de ser estatica y
  sale del precache.
- El resto de navegaciones usan `NetworkFirst` (3 s) y caen a `/`.
- Las estrategias con cache (`next-static`, `pages`, `app-assets`,
  `same-origin`) abortan la peticion si no llegan cabeceras en 6 s. `pages-rsc`
  corta a los 3 s: si el RSC de un cambio de pestaña no llega, Next recarga el
  documento y lo sirve el precache al momento. `/api`, `/auth/` (callback de
  OAuth con codigo de un solo uso) y los origenes externos usan solo red, sin
  corte.
- `next-static` y `app-assets` guardan los assets sin el parametro `dpl`.
- Al activar una version nueva se borran las caches `pages`, `pages-rsc` y la
  antigua `expense-reminders-*`.
- `scripts/verify-sw.mjs` corre al final de `npm run build`. Falla si falta una
  ruta principal, hay entradas duplicadas o con query, o no hay assets de
  `/_next/static`.
- Los enlaces entre Gastos, Plan y Ajustes hacen una navegacion de documento si
  el navegador esta offline, por lo que no dependen de una respuesta RSC nueva.
- API, origenes externos y peticiones no GET usan solo red.

El service worker tambien maneja:

- `push`: valida el payload (`src/pwa/push-payload.ts`) y muestra la
  notificacion con titulo, cuerpo, icono, badge monocromo, idioma, `tag` (una
  nueva con la misma etiqueta sustituye a la anterior) y URL. Si trae
  `badgeCount`, actualiza el numero del icono.
- `notificationclick`: cierra la notificacion, enfoca la ventana abierta y la
  lleva a la URL (solo rutas del mismo origen); si la ventana no esta
  controlada o no hay ninguna, abre otra.
- `pushsubscriptionchange`: el navegador renueva o invalida la suscripcion.
  Se vuelve a suscribir con la misma clave (o la pide a
  `/api/push/subscribe`) y la manda al servidor con `previousEndpoint`, que
  borra la antigua. Sin sesion responde 401 y el latido de la app la registra
  al abrirla.
- `message` `GET_OFFLINE_STATUS`: responde por `MessageChannel` cuantas
  entradas del precache espera y cuantas tiene ya en cache.

### Instalacion del precache y diagnostico

La instalacion del precache es todo o nada: una sola URL que responde con
error deja activo el service worker anterior. Para que ese caso se pueda ver y
reparar:

- El precache usa `concurrency: 4`. Durante `install`, los 429 y 5xx se
  reintentan dos veces (a 1 s y a 3 s).
- Si una URL sigue fallando, la instalacion se rechaza en el acto. Serwist 9.5
  deja colgada la promesa de su precache cuando una entrada falla, y Chromium
  no da la instalacion por fallida hasta que se resuelven todas las promesas
  de `waitUntil`. Por eso `sw.ts` registra los listeners de Serwist a mano y le
  pasa un evento cuyo `waitUntil` no registra esa promesa. La unica promesa
  registrada compite entre el exito de Serwist y el rechazo del plugin de
  diagnostico.
- Si una URL sigue fallando, el service worker envia `PRECACHE_FAILED` con la
  ruta y el status a todas las ventanas. `PwaRegister` lo guarda en
  `localStorage['offline-diag-v1']`, igual que una instalacion que acaba en
  `redundant`.
- Ajustes muestra la fila "Uso sin conexion" con estos estados:
  - Lista: todo el precache esta en cache.
  - Preparando: el worker se esta instalando o la cache aun esta incompleta.
  - Fallo: muestra la URL y el status del ultimo error.
  - Version antigua: hay un worker activo que no responde al estado, como el
    `sw.js` escrito a mano anterior a Serwist (cache `expense-reminders-*`).
  - No preparada / no soportado.
- `PwaRegister` llama a `registration.update()` al volver a primer plano (como
  mucho una vez por minuto) y pide `navigator.storage.persist()`.
- Sin navigation preload, abrir la app con conexion arranca el build que ya
  estaba en cache; el nuevo se instala y activa en segundo plano. Cuando cambia
  el controlador, `PwaRegister` recarga la pagina la siguiente vez que pasa a
  segundo plano, salvo que haya una hoja abierta o un campo con foco.

La logica pura comun vive en `src/pwa/cache-policy.ts` y
`src/features/settings/lib/offline-readiness.ts`. El diagnostico guardado vive
en `src/data/persistence/offline-diagnostic-store.ts`. Un fallo generico (sin
URL) no sustituye a uno con URL de la misma instalacion, y no se borra mientras
haya una instalacion nueva en curso.

### Arranque sin pantalla vacia

`ExpenseStoreProvider` pinta un `fallback` hasta hidratar el store local. El
layout le pasa `AppBootShell`, un componente de servidor sin hooks que queda en
el HTML prerenderizado:

- Muestra un skeleton y, a los 6 s (por CSS, tambien sin JavaScript), un bloque
  de ayuda con "Reintentar" y "Reparar (con conexion)".
- Lista los recursos que no cargaron, si los hay.

El script inline `boot-guard` del `<head>` (`src/app/providers/boot-guard-script.ts`)
no depende del runtime de Next. `next/script` con `beforeInteractive` no sirve
aqui, porque lo ejecuta el propio runtime. Next coloca antes sus preloads, CSS
y chunks. El script:

- Aplica idioma y tema desde cookies.
- Recoge los errores de carga posteriores y, al cargar el documento, recupera
  de `performance` los anteriores.
- Escribe solo en nodos que React no compara al hidratar
  (`dangerouslySetInnerHTML` mas `suppressHydrationWarning`).
- A los 6 s anuncia la ayuda en la region `role="status"`.
- Con `?sw-reset=1`, y solo si una peticion real a la red responde, desregistra
  el service worker y borra sus caches (nunca `localStorage`).

`src/app/global-error.tsx` cubre los errores del layout raiz.

## Supabase Auth

`proxy.ts` refresca sesion mediante `updateSession`, pero excluye:

- `/api`
- assets de Next
- imagenes
- manifest
- service worker
- favicon

Esto evita meter Supabase Auth en cada request API.

`/auth/callback` intercambia el codigo por sesion y sanitiza `next`:

- Acepta solo rutas internas relativas que empiezan por `/`.
- Rechaza URLs absolutas externas.
- Rechaza valores tipo `//evil.com`.
- Rechaza backslashes y caracteres nulos.
- Usa `/settings` como fallback.

## Voz y atajos

- Dictado con el reconocimiento del navegador (Web Speech API) en la hoja de
  captura, solo en Chromium fuera de iOS (`features/expenses/lib/voice-support.ts`).
  En iOS y Safari falta o se cuelga en apps instaladas: alli se muestra una pista
  para usar el microfono del teclado.
- Lo dictado se suma a lo ya escrito; mientras se dicta, el campo es de solo
  lectura hasta que llega lo ultimo dictado (si lo escrito acaba en salto de
  linea, lo dictado va en otra linea). El dictado termina al tocar de nuevo, a los 30 s, tras 2 s sin oir
  nada nuevo (tambien parcial) o al salir de la app: pide al reconocedor lo que
  aun procesa (`stop`, no `abort`) y lanza un unico analisis. Analizar mientras
  se dicta lo termina y analiza el texto completo.
- En Android `continuous` no tiene efecto: se reinicia la misma instancia tras
  cada frase, conservando lo aun parcial. Los resultados acumulados que repite
  Chrome en Android no duplican palabras (`sessionTranscript`).
- El reconocimiento de Chrome envia el audio a Google y necesita conexion; sin
  ella el microfono avisa. Un error (red, permiso) deja lo oido en el campo sin
  analizarlo. Solo un "servicio no permitido" sin resultados (por ejemplo en
  Brave) oculta el microfono durante la sesion.
- El manifest tiene atajos "Añadir gasto" (`/expenses/new`), "Añadir por voz"
  (`/expenses/new?mode=voice`) y "Plan" (`/money`). `mode` se lee en cliente y el precache lo ignora,
  asi que la pagina sigue siendo estatica. Dictar siempre exige un toque. El
  atajo abre el formulario o la captura una sola vez por entrada del historial
  (`lib/new-expense-intent.ts`): volver a la pantalla con Atras no lo repite.
- Atras (boton o gesto de Android) cierra la capa de encima: hojas y selectores
  de fecha o de dia de cobro (`src/components/ui/sheet-history.ts` y
  `use-history-layer.ts`). Cada capa añade una entrada al historial con la
  misma URL; las que se cierran a la vez se deshacen con un solo
  `history.go(-n)`, una entrada sin dueño (tras recargar o navegar con una hoja
  abierta) se salta al llegar a ella o al arrancar la app en ella
  (`OrphanLayerGuard`) y, mientras hay capas, el scroll no se restaura al
  volver.

## APIs internas

Endpoints principales:

- `/api/ai/parse-expenses`: parsea texto de gastos. Si no hay key, no hay
  sesion, se agota cuota, hay timeout o la respuesta es invalida, usa parser
  local. Solo llama a Gemini cuando el usuario esta autenticado.
- `/api/auth/clear-sync-metadata`: POST autenticado para limpiar metadata legacy
  sobredimensionada de Supabase Auth. GET responde 405.
- `/api/push/subscribe`: guarda suscripciones push (tambien es el latido del
  dispositivo: renueva `updated_at` y pone `failure_count` a 0). Con
  `previousEndpoint` borra la suscripcion que sustituye.
- `/api/push/test`: prueba notificaciones, en el idioma que manda la app y con
  TTL de 5 minutos.
- `/api/push/status`: verifica que el endpoint actual sigue registrado y muestra
  el ultimo envio programado completado (de cualquier tipo) y los fallos
  seguidos del dispositivo.
- `/api/push/daily-reminders`: endpoint llamado por cron para recordatorios.
- `/api/account`: borra el usuario autenticado; las filas dependientes se
  eliminan mediante claves foraneas `ON DELETE CASCADE`.

## AI y rate limit

El parseo AI usa `GEMINI_API_KEY`, `GEMINI_API_MODEL` (por defecto
`gemini-3.5-flash-lite`) y `GEMINI_FALLBACK_MODEL` (por defecto
`gemini-3.1-flash-lite`). `gemini-2.5-*` es legacy: Google lo marca como
obsoleto y en Vertex ya esta retirado.

Peticion (`src/data/ai/gemini-client.ts`, REST `generateContent`):

- Clave en la cabecera `x-goog-api-key`, nunca en la URL.
- `systemInstruction` por peticion (`src/data/ai/expense-capture-prompt.ts`):
  fecha de hoy con dia de la semana (la manda el cliente y se acepta a ±2 dias
  de la del servidor), idioma, categorias permitidas, reglas y ejemplos.
- `responseJsonSchema` escrito a mano (categorias como enum, campos `null`
  cuando no aparecen), sin `temperature`, `maxOutputTokens: 1024`.
- Razonamiento por modelo: Flash-Lite con `MINIMAL`, Flash 3.x con `LOW`
  (rechazan `MINIMAL`), 2.5 con `thinkingBudget: 0`. Si el modelo rechaza el
  ajuste, se repite sin el.
- Plazo total de 10 s para los dos modelos. 404, 429 y 5xx pasan al modelo de
  respaldo; un 429 se reintenta solo si `retryDelay` es de 2 s o menos. 401/403
  (clave), bloqueos, respuestas truncadas o JSON invalido no se reintentan.
- Se comprueban `promptFeedback.blockReason` y `finishReason`, y se ignoran las
  partes `thought`.
- Los errores se registran con modelo y motivo, sin el texto del usuario.

Respuesta: cada gasto pasa por `normalizeCapturedExpense`
(`src/domain/expense-capture.ts`), igual que el parser local. Un importe que
no aparece queda a 0 y se marca como pendiente (nunca se inventa); el dia, la
fecha, la frecuencia o la categoria deducidos se marcan para revisar. Un
elemento invalido se descarta sin perder el resto (`droppedCount`). El cliente
abre el formulario si hay un gasto o una revision con todos si hay varios.

Motivos de fallback (`reason`): `missing_key`, `unauthenticated`,
`rate_limited`, `auth_failed`, `model_unavailable`, `quota_exhausted`,
`blocked`, `truncated`, `invalid_response`, `timeout`, `ai_unavailable` y, en
el cliente, `offline` (sin conexion se usa el parser local directamente).

Cuota: el nivel gratuito tiene limites por minuto y por dia que solo se ven en
AI Studio; el diario se reinicia a medianoche del Pacifico (las 09:00 en
Espana). En el nivel gratuito Google puede usar el contenido para mejorar sus
productos, y sus terminos piden el nivel de pago para apps ofrecidas a usuarios
del EEE. El limite diario propio (`ai_usage`) queda diferido mientras solo use
la app su dueño.

Capas de proteccion actuales:

- Validacion de request con Zod.
- Longitud maxima de texto.
- Requisito de usuario autenticado para llamar a Gemini.
- Plazo de 10 segundos en el servidor y 12 en el cliente.
- Fallback local por error o respuesta invalida.
- Rate limit en memoria por usuario dentro del endpoint.
- Rate limit externo configurado en Vercel Firewall para proteger el endpoint.

El fallback local mantiene la UX funcional para usuarios anonimos y cuando AI no
esta disponible.

## Notificaciones y cron

Las notificaciones usan Web Push con VAPID. `vercel.json` programa
`/api/push/daily-reminders` cada dia a las `08:00 UTC`. El endpoint usa
credenciales server-side y debe protegerse con `CRON_SECRET`.

Las suscripciones push se guardan en Supabase y el cron consulta stores de
usuario para enviar recordatorios de cobro.

Ajustes diferencia permiso local, suscripcion del navegador y registro remoto.
Puede resincronizar el dispositivo y enviar una notificacion de prueba. La
configuracion se considera disponible solo cuando existen las dos claves VAPID.

### Que se avisa

Los ajustes viven en `preferences.reminders` (Ajustes › Recordatorios) y la
logica pura en `src/domain/reminder-schedule.ts`:

- Aviso de cada gasto: el suyo (`template.reminder`, la campana de la fila o
  el formulario) o, sin el, el aviso por defecto. La antelacion por defecto
  es de 1 a 5 dias para mensuales y de 7, 14 o 30 para trimestrales, anuales
  y personalizados de 3 meses o mas.
- Etapas de un cobro `due` con aviso:
  - Antes (`last_chance`): faltan entre 1 y la antelacion dias para
    `estimatedChargeDate` (desde 0 si la etapa del dia del cargo esta
    apagada). La ventana recupera una ejecucion perdida. "Entendido" en el
    aviso de la app la calla para ese cargo.
  - El dia del cargo (`charge_day`).
  - "¿Se cobro?" (`charge_check`): el cargo paso hace 1 a 3 dias y sigue
    pendiente. No la calla "Entendido".
- Avisos del mes (apagados por defecto): `month_close` con el criterio de la
  tarjeta "Octubre al dia" (una vez por mes) y `payday` el dia de cobro
  configurado (el ultimo del mes si es mas corto) con lo que queda por pagar.
  El "Ahora no" de la tarjeta es por dispositivo y el push no lo ve.
- Se usan las mismas ocurrencias que la app (`occurrencesDueBetween`, con
  registros de meses cerrados y recibos movidos). Un gasto borrado o inactivo
  no avisa.

### Cuando y como se envia

- El dia y la hora se calculan en la zona guardada en los ajustes (la del
  dispositivo que los cambio; por defecto Atlantic/Canary). Un usuario recibe
  lo del dia en la primera ejecucion a partir de su hora (por defecto las 8).
- Con el cron diario de Vercel (08:00 UTC, las 8 o las 9 en Canarias) solo se
  respetan horas de hasta esa ejecucion. Para cualquier hora, el cron tiene
  que correr cada hora: en Vercel Pro, `0 * * * *` en `vercel.json`; en Hobby
  (solo un cron diario), el workflow `.github/workflows/push-reminders.yml`,
  que no hace nada hasta definir la variable `PUSH_CRON_URL`
  (`https://<dominio>/api/push/daily-reminders`) y el secreto `CRON_SECRET`
  en GitHub.
- Una notificacion por etapa, en el idioma del usuario
  (`src/features/expenses/lib/reminder-notifications.ts`). Un cobro suelto
  dice nombre, importe y fecha y abre `/?occurrence=<id>`; varios se resumen
  ("Hoy se cobran 2 recibos · Luz y Agua · 80,00 €") y abren el primero.
  `month_close` abre `/` y `payday`, `/money`.
- `/?occurrence=<id>` se lee en cliente (el precache ignora el parametro):
  cambia al mes en que se ve el cobro, lo resalta y abre su hoja de acciones;
  si ya no existe, lo dice. El parametro se quita de la URL.
- TTL por tipo (20 h los avisos previos, la pregunta y el mes al dia; 12 h el
  dia del cargo y el de cobro), `timeout` de 5 s y envio en paralelo a todos
  los dispositivos.
- El store pasa por `normalizeExpenseStore` y cada usuario va en su propio
  try/catch: un store ilegible o un error de base de datos se cuenta en
  `errors`, libera lo que habia reclamado y no corta el envio al resto.

### Entregas

El endpoint reclama cada aviso en `push_reminder_deliveries` con una clave
por usuario, tipo (`kind`) y aviso: para un cobro, template y fechas (cambia
si se mueve el cargo); para los del mes, el mes. Los cinco tipos usan el mismo
RPC `claim_push_reminder_delivery`, sin cambio de esquema, y `last_chance`
mantiene el nombre anterior para no repetir lo ya entregado. La reclamacion es
un lease atomico de 15 minutos: otra ejecucion no puede enviar a la vez, pero
puede recuperar el trabajo si el proceso anterior cae. La fila solo pasa a
`delivered` cuando al menos un dispositivo acepta el push. Si todos fallan, se
libera inmediatamente. Esta estrategia prioriza no perder avisos; una caida
posterior a la aceptacion del proveedor y anterior al marcado final puede
producir un duplicado excepcional.

La funcion SQL `claim_push_reminder_delivery` usa `security invoker`. Solo
`service_role` tiene permiso de ejecucion. La migracion
`20260823215337_push_delivery_leases.sql` añade estado, token y tiempo de claim;
debe aplicarse antes de desplegar el route handler nuevo.

### Salud de las suscripciones (M12)

- Latido (`PushHeartbeat` en el layout, `src/features/settings/lib/push-heartbeat.ts`):
  con permiso y suscripcion, una vez al dia por dispositivo (o si cambia el
  endpoint) y al volver a la app, confirma la suscripcion en
  `/api/push/subscribe`. Si la suscripcion se creo con otra clave VAPID, crea
  otra y borra la antigua. Nunca pide permiso.
- Activar los avisos tampoco reutiliza una suscripcion de otra clave VAPID.
- `failure_count` (migracion `20261023120000_push_subscription_health.sql`,
  solo aditiva): un 404/410 borra la suscripcion al momento; otros fallos
  (403 de clave, 5xx, tiempo agotado) suman uno y al quinto se borra. Un envio
  correcto lo pone a 0. Ajustes avisa si los ultimos envios a ese dispositivo
  fallaron. Sin la migracion, el cron y la app siguen funcionando: el cron lee
  las filas con `select("*")` y no cuenta fallos, y el alta repite el upsert
  sin las columnas nuevas.

## Variables de entorno

Publicas para cliente/Supabase:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Privadas/opcionales:

- `GEMINI_API_KEY`
- `GEMINI_API_MODEL`
- `GEMINI_FALLBACK_MODEL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`

No documentar valores reales de `.env.local`. Mantener ejemplos en
`.env.example`.

## Seguridad a preservar

- No permitir open redirects en auth callback.
- No aceptar GET para acciones que mutan estado server-side.
- No llamar AI externa para usuarios anonimos.
- Mantener `/api` fuera del proxy matcher salvo razon explicita.
- No exponer service role key ni secrets al cliente.
- Mantener RLS en Supabase para datos de usuario.
