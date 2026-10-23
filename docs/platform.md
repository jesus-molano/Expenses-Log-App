# Plataforma

Esta app combina Next App Router, PWA, Supabase Auth, Supabase cloud sync,
notificaciones web y un endpoint de parseo AI con fallback local.

## PWA

La metadata PWA se define en `src/app/layout.tsx` y `src/app/manifest.ts`.

La app usa:

- `manifest.webmanifest`.
- Iconos versionados en `public/`.
- `display: standalone`.
- `orientation: portrait`.
- `start_url` y `scope` en `/`.
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

- `push`: muestra notificacion con titulo, cuerpo, icono y URL.
- `notificationclick`: cierra la notificacion y abre la URL asociada.
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

## APIs internas

Endpoints principales:

- `/api/ai/parse-expenses`: parsea texto de gastos. Si no hay key, no hay
  sesion, se agota cuota, hay timeout o la respuesta es invalida, usa parser
  local. Solo llama a Gemini cuando el usuario esta autenticado.
- `/api/auth/clear-sync-metadata`: POST autenticado para limpiar metadata legacy
  sobredimensionada de Supabase Auth. GET responde 405.
- `/api/push/subscribe`: guarda suscripciones push.
- `/api/push/test`: prueba notificaciones.
- `/api/push/status`: verifica que el endpoint actual sigue registrado y muestra
  el ultimo envio programado completado.
- `/api/push/daily-reminders`: endpoint llamado por cron para recordatorios.
- `/api/account`: borra el usuario autenticado; las filas dependientes se
  eliminan mediante claves foraneas `ON DELETE CASCADE`.

## AI y rate limit

El parseo AI usa `GEMINI_API_KEY` y `GEMINI_API_MODEL`, con modelo por defecto
`gemini-2.5-flash`.

Capas de proteccion actuales:

- Validacion de request con Zod.
- Longitud maxima de texto.
- Requisito de usuario autenticado para llamar a Gemini.
- Timeout de 8 segundos.
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

El cron envia recordatorios pendientes cuando:

- El gasto tiene `reminder.enabled`.
- La ocurrencia sigue `due`.
- Faltan entre 0 y `daysBeforeCharge` dias para `estimatedChargeDate`; esta
  ventana permite recuperar una ejecucion diaria perdida.
- El usuario no descarto el aviso para esa `estimatedChargeDate`.
- Hay al menos una suscripcion push guardada para el usuario.

El endpoint reclama cada ocurrencia en `push_reminder_deliveries` con una clave
por usuario, template y fechas. La reclamacion es un lease atomico de 15 minutos:
otra ejecucion no puede enviar a la vez, pero puede recuperar el trabajo si el
proceso anterior cae. La fila solo pasa a `delivered` cuando al menos un
dispositivo acepta el push. Si todos fallan, se libera inmediatamente. Esta
estrategia prioriza no perder avisos; una caida posterior a la aceptacion del
proveedor y anterior al marcado final puede producir un duplicado excepcional.

La funcion SQL `claim_push_reminder_delivery` usa `security invoker`. Solo
`service_role` tiene permiso de ejecucion. La migracion
`20260823215337_push_delivery_leases.sql` añade estado, token y tiempo de claim;
debe aplicarse antes de desplegar el route handler nuevo.

## Variables de entorno

Publicas para cliente/Supabase:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Privadas/opcionales:

- `GEMINI_API_KEY`
- `GEMINI_API_MODEL`
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
