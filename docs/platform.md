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

`npm run build` ejecuta `serwist build serwist.config.mjs`, que compila
`src/pwa/sw.ts` en `public/sw.js` e inyecta el manifiesto del precache. El
archivo generado no se versiona. Las reglas puras (parametros ignorados, cortes
de red, mensajes y caches obsoletas) viven en `src/pwa/cache-policy.ts`.

### Que se precachea

`serwist.config.mjs` usa los valores por defecto de `@serwist/next`:

- Los assets del build en `.next/static/` con extension js, css, html, ico,
  imagen, json o webmanifest. Llevan el hash en el nombre y entran sin
  `__WB_REVISION__`.
- Todo `public/`, salvo `public/app-icon-1024.png` (no se usa) y el propio
  `sw.js`.
- El HTML de las rutas prerenderizadas, con revision: `/`, `/money`,
  `/settings`, `/login` y `/expenses/new`. No entran `_not-found`,
  `_global-error` ni las rutas dinamicas (`/expenses/[id]`, `/auth/callback`,
  `/api/*`).
- Como mucho 5 MB por archivo. Hoy son unas 38 URLs (2,4 MB).

No entran las fuentes de `next/font` (`.next/static/media/*.woff2`, fuera del
glob), `/manifest.webmanifest` (lo genera una ruta, no es HTML) ni los iconos
pedidos con `?v=5`. Se guardan en las caches de runtime la primera vez que se
piden con el service worker al mando. Si se abre sin red antes de eso (justo
tras la primera visita), la app carga igual, con la fuente del sistema y sin
esos iconos.

`scripts/verify-sw.mjs` corre al final de `npm run build` y falla si falta una
ruta principal, hay entradas duplicadas o con query, o no hay assets de
`/_next/static`.

### Como responde

Serwist prueba primero el precache y despues las reglas de `runtimeCaching` en
orden; responde la primera que encaja. Solo intercepta GET: el resto va a la
red sin pasar por el.

| Peticion | Estrategia | Cache |
| --- | --- | --- |
| URL del precache | Cache, sin esperar a la red (solo pide a la red si falta la copia) | `serwist-precache-v2-*` |
| `/api/*` | Solo red, sin corte | ninguna |
| `/auth/*` (callback de OAuth, codigo de un solo uso) | Solo red, sin corte | ninguna |
| Otro origen (Supabase) | Solo red, sin corte | ninguna |
| `/_next/static/*` fuera del precache | `CacheFirst`, corte a 6 s | `next-static` (128, 30 dias) |
| Navegacion | `NetworkFirst`: 3 s de red y luego la copia; corte a 6 s | `pages` (16, 7 dias) |
| Fuente, imagen, script o estilo | `StaleWhileRevalidate`, corte a 6 s | `app-assets` (128, 30 dias) |
| RSC (`?_rsc` o cabecera `RSC: 1`) | `NetworkFirst`: 3 s y corte a 3 s | `pages-rsc` (32, 1 dia) |
| Resto del mismo origen | `NetworkFirst`: 3 s; corte a 6 s | `same-origin` (64, 1 dia) |

Las caducidades cuentan desde el ultimo uso.

- **Precache sin esperas.** El navigation preload esta desactivado
  (`navigationPreload: false` mas `disableNavigationPreload()`, porque la
  preferencia vive en el registro). Con preload, una ruta precacheada esperaba
  la respuesta de red precargada y una red que acepta la conexion pero no
  responde dejaba la app colgada.
- **Parametros ignorados.** Al buscar en el precache se quitan `utm_*`,
  `fbclid`, `dpl`, `from`, `mode` y `occurrence`. Asi `/settings?from=money`
  usa `/settings` y `chunk.js?dpl=<id>` usa `chunk.js`. `from`, `mode` y
  `occurrence` se leen siempre en cliente: una pagina que lea `searchParams` en
  servidor deja de ser estatica y sale del precache.
- **`dpl`.** Con Skew Protection, Vercel compila con `NEXT_DEPLOYMENT_ID` y Next
  pide todos los assets (chunks, CSS y fuentes) con `?dpl=<id>`, mientras que
  el precache los guarda sin el. Ademas de ignorarlo en el precache,
  `next-static` y `app-assets` lo quitan de la clave con que guardan.
- **Cortes.** `abortIfNoResponse` aborta la peticion si no llegan cabeceras a
  tiempo; un cuerpo lento no se corta. En `NetworkFirst` sin copia en cache se
  sigue esperando a la red tras los 3 s, hasta el corte. `pages-rsc` corta a
  los 3 s: si el RSC de un cambio de pestaña no llega, Next recarga el
  documento y lo sirve el precache al momento.
- **Fallback a `/`.** Si una regla de runtime falla en una peticion de
  documento (sin red y sin copia), responde el `/` precacheado. Serwist añade
  el fallback a todas las reglas de runtime, tambien a `/auth/*`: un callback
  de OAuth sin red abre la app en `/` sin iniciar sesion. Las peticiones de
  datos (`/api`, RSC) no tienen fallback.
- **Ciclo de vida.** `skipWaiting` y `clientsClaim`: una version nueva se activa
  en cuanto termina de instalarse y toma el control de las pestañas abiertas.
  Al activarse quita del precache las entradas que ya no estan en su manifiesto
  (`cleanupOutdatedCaches` borra ademas las caches de formatos de precache
  antiguos) y borra las caches `pages`, `pages-rsc` y la antigua
  `expense-reminders-*`, que pueden apuntar a chunks de otro build.
- Los enlaces entre Gastos, Plan y Ajustes (`OfflineLink`) hacen una
  navegacion de documento si el navegador esta offline, por lo que no dependen
  de una respuesta RSC nueva.

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
  mucho una vez por minuto) y pide `navigator.storage.persist()`. Ajustes ›
  Copias y datos ensena si el navegador lo ha concedido y permite pedirlo a
  mano; las copias automaticas del store van a IndexedDB (ver
  `docs/state-persistence-sync.md`, "Copias, exportar e importar").
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

### Aviso "Sin conexion"

Las cabeceras de Gastos y Plan (`DashboardShell`) y de Ajustes muestran el chip
"Sin conexion" (`src/components/ui/OfflineStatusChip.tsx`) mientras el
navegador esta offline:

- `useOnlineStatus` (`src/shared/hooks/use-online-status.ts`) escucha `online` y
  `offline` con `useSyncExternalStore`. En el servidor y al hidratar devuelve
  `true`, asi que el HTML prerenderizado nunca lleva el chip.
- Es solo un aviso: `navigator.onLine` dice si hay red local, no si llega a
  internet. En iOS, o en una red sin salida, puede seguir en `true` sin
  conexion real; nada decide si guardar o sincronizar a partir de el.
- La region `role="status"` existe siempre (vacia y sin ancho con conexion),
  para que el lector de pantalla anuncie el chip al perder la conexion.
- No mueve la cabecera: en Gastos y Plan va en la linea del titulo, de alto
  fijo, y a 360 px recorta el titulo (el mes sigue en la barra de mes); en
  Ajustes va junto al `h1`.

### Pruebas del modo sin conexion

`npm run e2e:offline` (ver `docs/testing-quality.md`) abre cada ruta principal
en un arranque en frio contra un `next start` real: con el servidor parado, con
un servidor que acepta conexiones y nunca responde, y desde un build con
`NEXT_DEPLOYMENT_ID` cuyos assets llevan `?dpl=`. Antes de volver a abrir sin
red vacia la cache HTTP de Chromium, como cuando iOS la libera: todo lo que
carga tiene que salir de las caches del service worker.

## Supabase Auth

`proxy.ts` refresca sesion mediante `updateSession`, pero excluye:

- `/api`
- assets de Next
- imagenes
- manifest
- service worker
- favicon

Esto evita meter Supabase Auth en cada request API.

`/auth/callback` intercambia el codigo por sesion y valida `next` con
`resolveSafeRedirectPath` (`src/shared/safe-redirect.ts`):

- Rechaza cualquier caracter de control (tab, saltos de linea, NUL...), DEL y
  la barra invertida. El parser de URL quita los controles sin avisar y trata
  `\` como `/`: antes `/%09/evil.com`, `/%0A/evil.com` o `/\evil.com`
  pasaban el filtro y acababan en `//evil.com`, otro host.
- Solo acepta valores que empiezan por `/`. Los resuelve con `new URL` contra
  el origen de la peticion, exige el mismo origen y devuelve la ruta
  normalizada, que nunca empieza por `//` (`/.//evil.com` tambien cae al
  fallback).
- `next` llega decodificado una vez por `URLSearchParams` y no se vuelve a
  decodificar.
- Usa `/settings` como fallback.

### Cerrar sesion y datos de otra cuenta

Ajustes › Salir abre una hoja con dos opciones: salir y conservar los datos en
el dispositivo, o salir y borrarlos (un equipo compartido). Si quedan cambios
sin subir, la hoja avisa de que borrar los datos los perderia.

- Antes del `signOut`, siempre: `DELETE /api/push/subscribe` del endpoint del
  navegador (necesita la sesion; plazo de 4 s) y `unsubscribe()`. Anular la
  suscripcion invalida el endpoint aunque falle el borrado remoto, y el cron
  poda esa fila con el 404/410. Asi la siguiente cuenta no hereda los avisos
  ni choca con la fila de la anterior.
- Borrar los datos quita `expense-log-store-v1`, sus copias `.corrupt`, los
  metadatos `expense-log-sync-v1` y las copias automaticas de IndexedDB
  (`clearDeviceData`), y recarga para descartar el store en memoria. Borrar
  la cuenta hace lo mismo y tambien anula la suscripcion del navegador.
- Sin red, `signOut` quita igualmente la sesion local; solo se da por fallido
  si la sesion sigue ahi.
- Los datos locales de una cuenta nunca se fusionan ni se suben a otra: el
  dueño es `expense-log-sync-v1.ownerId` y, en dispositivos sin esos metadatos
  (sincronizados antes de F0b-3), el `userId` que llevan los propios datos
  (`inferStoreOwnerId`; `demo` es lo creado sin sesion). Lo creado sin sesion
  despues de salir sigue siendo de la cuenta anterior. La cuenta que entra
  carga su nube, o empieza vacia si no tiene.
- Si un navegador quedo registrado a nombre de otra cuenta (salio antes de
  este cambio), guardar la suscripcion devuelve 409
  `PUSH_SUBSCRIPTION_IN_USE`. Al pulsar Activar, la app pide una suscripcion
  nueva (otro endpoint) y la guarda. El traspaso en el servidor
  (`claim_push_subscription`) necesita una migracion y queda para F0c-2.

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
- Las confirmaciones (`ConfirmActionDialog`) también son capas: Atrás cancela.
  Hojas y diálogos comparten `useDialogA11y` (foco, Tab, Escape y bloqueo del
  scroll); solo la capa de encima atiende el teclado.
- Para navegar justo después de cerrar capas (salir del detalle tras guardar,
  borrar o descartar) se usa `afterLayerHistorySettles`: navega cuando las
  capas cerradas han quitado su entrada del historial, porque esa vuelta atrás
  pendiente desharía la navegación.
- Detalle de un gasto (`/expenses/[id]`): mientras hay cambios sin guardar, una
  capa intercepta Atrás y pregunta si descartarlos; el control "Gastos" también
  pregunta (`use-leave-guard.ts`). Guardar y borrar sustituyen la entrada por la
  lista (Atrás no reabre el editor); el control "Gastos" y descartar tras Atrás
  vuelven a la entrada anterior, o a la lista si se abrió el detalle desde un
  enlace directo.

## APIs internas

Endpoints principales:

- `/api/ai/parse-expenses`: parsea texto de gastos. Si no hay key, no hay
  sesion, se agota cuota, hay timeout o la respuesta es invalida, usa parser
  local. Solo llama a Gemini cuando el usuario esta autenticado.
- `/api/auth/clear-sync-metadata`: POST autenticado para limpiar metadata legacy
  sobredimensionada de Supabase Auth. GET responde 405.
- `/api/push/subscribe`: guarda suscripciones push (solo de los servicios
  permitidos, como mucho 10 por usuario) y las borra con `DELETE`. Guarda con
  el RPC `claim_push_subscription`, que pasa el endpoint a la cuenta actual
  aunque lo registrara otra en el mismo navegador; sin la migracion usa el
  upsert directo. Tambien es el latido del dispositivo: renueva `updated_at` y
  pone `failure_count` a 0. Con `previousEndpoint` borra la suscripcion que
  sustituye, que no cuenta para el limite de 10.
- `/api/push/test`: envia una notificacion de prueba a una suscripcion
  guardada del propio usuario, en el idioma que manda la app y con TTL de 5
  minutos.
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
  de la del servidor), idioma, categorias permitidas, nombres de los gastos del
  usuario (`expenseNames`, hasta 50, solo como pista), reglas y ejemplos.
- `responseJsonSchema` escrito a mano (categorias como enum, campos `null`
  cuando no aparecen, `intent` en cada elemento), sin `temperature`,
  `maxOutputTokens: 1024`.
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

Ordenes sobre gastos existentes: cada elemento lleva `intent` (`create`,
`pay`, `skip` o `move`). Sin `intent` (modelos o respuestas anteriores) es un
alta. "Marca la luz pagada 71,20", "salta el gimnasio este mes" o "mueve
Netflix al 10" llegan en `commands` (`{intent, target, amount, day, date,
month}`, `normalizeCaptureCommand` en `src/domain/capture-commands.ts`), aparte
de `expenses`; un cliente anterior las ignora. El parser local
(`parseCaptureTextLocally`) entiende las mismas ordenes en español e ingles,
asi que funcionan sin sesion y sin conexion. Nunca se aplican solas:
`resolveCaptureCommand` busca la serie por parecido del nombre y el cobro del
mes que se mira (o del mes nombrado), la hoja "Confirma los cambios" deja
elegir la serie si es ambigua, corregir lo pagado y, al mover un mensual, si
cambia solo ese cobro o tambien los siguientes; se aplican con los comandos de
siempre y el aviso permite deshacerlas.

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
credenciales server-side y debe protegerse con `CRON_SECRET` (comparado en
tiempo constante).

Las suscripciones push se guardan en Supabase y el cron consulta stores de
usuario para enviar recordatorios de cobro.

Endpoints permitidos (`src/data/push/push-endpoints.ts`). El servidor hace
peticiones a la URL que manda el cliente, asi que solo acepta la forma
`https://<host>/...` (sin usuario, puerto, espacios, controles ni `\`) de estos
servicios:

- `fcm.googleapis.com`: Chrome, Edge en Android, Samsung Internet, Opera y
  Brave.
- `updates.push.services.mozilla.com`: Firefox.
- Cualquier subdominio de `push.apple.com` (hoy `web.push.apple.com`): Safari
  en macOS e iOS/iPadOS. Es lo que pide Apple.
- Cualquier subdominio de `notify.windows.com`: Edge en Windows (WNS).

`/api/push/subscribe` y `/api/push/test` rechazan el resto con 400 (`subscribe`
con `PUSH_ENDPOINT_NOT_ALLOWED`, que Ajustes explica). El envio
(`src/data/push/web-push-sender.ts`) vuelve a comprobarlo, y el cron se salta
las filas de otros hosts (`blockedEndpointsSkipped`): el rol `authenticated`
puede insertar en `push_subscriptions` sin pasar por la API. `DELETE` acepta
cualquier URL para poder limpiar filas antiguas.

Cada usuario tiene como mucho 10 suscripciones. Tras guardar una nueva por
encima del limite, `/api/push/subscribe` borra las actualizadas hace mas
tiempo (Ajustes actualiza la fecha cada vez que se abre en ese dispositivo); si
el guardado falla no se borra ninguna. El cron solo envia a las 10 mas
recientes. Dos altas simultaneas pueden pasarse por una: la restriccion en la
base de datos llega con la migracion de F0c-2.

Cada envio (un solo modulo, `src/data/push/web-push-sender.ts`) lleva
`timeout` de 5 s (de socket) y `TTL`: el de cada tipo de aviso (ver "Cuando y
como se envia") y 5 minutos para la prueba. Antes era el de web-push, 4
semanas.

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
    aviso de la app la calla para ese cargo. `estimatedChargeDate` salta fines
    de semana y festivos bancarios (`src/domain/holidays.ts`): un recibo del
    lunes 12 de octubre se avisa contando hasta el martes 13.
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
- Solo a usuarios con al menos una suscripcion push guardada de un servicio
  permitido (como mucho las 10 actualizadas mas recientemente).

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
- El cron no confia en el jsonb de cada store: `toReminderStore`
  (`src/features/expenses/lib/reminder-store.ts`) se queda con los gastos,
  overrides y registros bien formados (fechas, recurrencia, dia, importe) y
  normaliza el resto como la app (`normalizeExpenseStore`). No filtra por el
  aviso: el de cada gasto se lee con las reglas de la app y, sin el, manda el
  aviso por defecto; ademas el mes al dia, el dia de cobro y el badge cuentan
  todos los recibos. A un override con la fecha movida ilegible se le quita
  esa fecha en lugar de descartarlo, para no avisar de un recibo pagado. Un
  valor que no parece un store se cuenta en `invalidStoresSkipped`.
- Cada usuario va en su propio `try/catch`: un store roto o un error del RPC o
  de la base de datos se cuenta en `errors` y la ejecucion sigue con el
  siguiente. Lo ya reclamado se cierra siempre (marcado si el push llego a
  algun dispositivo, liberado si no), cada lease por separado; uno que no se
  pudo cerrar caduca a los 15 minutos.
- La respuesta resume la ejecucion: `usersChecked`, `usersWithReminders`,
  `notificationsSent`, `notificationsFailed`, `duplicateDeliveriesSkipped`,
  `invalidSubscriptionsRemoved`, `invalidStoresSkipped`,
  `blockedEndpointsSkipped` y `errors`.

### Entregas

El endpoint reclama cada aviso en `push_reminder_deliveries` con una clave
por usuario, tipo (`kind`) y aviso: para un cobro, template y fechas (cambia
si se mueve el cargo o si los festivos cambian `estimatedChargeDate`, asi que
ese recibo puede avisarse una vez mas); para los del mes, el mes. Los cinco tipos usan el mismo
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

Cada usuario tiene como maximo 10 suscripciones push: un trigger rechaza la
undecima (tambien en inserciones directas) y `claim_push_subscription` hace
sitio borrando las que llevan mas tiempo sin renovarse.

### Salud de las suscripciones (M12)

- Latido (`PushHeartbeat` en el layout, `src/features/settings/lib/push-heartbeat.ts`):
  con permiso y suscripcion, una vez al dia por dispositivo (o si cambia el
  endpoint) y al volver a la app, confirma la suscripcion en
  `/api/push/subscribe`. Si la suscripcion se creo con otra clave VAPID, crea
  otra y borra la antigua. Nunca pide permiso.
- Activar los avisos tampoco reutiliza una suscripcion de otra clave VAPID.
- `failure_count` (migracion `20261023220000_push_subscription_health.sql`,
  solo aditiva): un 404/410 borra la suscripcion al momento; otros fallos
  (403 de clave, 5xx, tiempo agotado) suman uno y al quinto se borra. Un envio
  correcto lo pone a 0. Ajustes avisa si los ultimos envios a ese dispositivo
  fallaron. Sin la migracion, el cron y la app siguen funcionando: el cron lee
  las filas con `select("*")` y no cuenta fallos, y el alta repite el upsert
  sin las columnas nuevas.
- El alta (`savePushSubscription` en `src/data/push/push-subscriptions.ts`)
  tiene un solo camino: primero `claim_push_subscription`, que con esta
  migracion tambien pone `failure_count` a 0; si el RPC no existe (PGRST202),
  el upsert que olvida los fallos.

## Migraciones de Supabase

Se aplican en el SQL Editor del proyecto (o con `supabase db push`) en orden de
nombre y son idempotentes. `supabase/schema.sql` refleja el estado final para
proyectos nuevos.

`20261023120000_app_store_revision_cas.sql` (F0c-2, solo aditiva):

- `app_stores.revision` con el trigger que la incrementa en cada `UPDATE`.
- RPC `save_app_store(p_store, p_expected_revision)` para el guardado con CAS
  (`security invoker`, ejecutable por `authenticated`).
- Limite de 10 suscripciones push por usuario y RPC `claim_push_subscription`
  (`security definer`, ejecutable por `authenticated`).

Conviene aplicarla en produccion antes de mergear, porque las previews
comparten la base de datos, pero el cliente funciona sin ella: cae al upsert y
lo registra una vez en consola. Para comprobarla: con dos dispositivos abiertos,
editar en uno y volver al otro; la fila de `app_stores` sube de `revision` con
cada guardado.

`20261023220000_push_subscription_health.sql` (F2b, solo aditiva, ya aplicada
en produccion): `failure_count`, `last_failure_at` y `last_success_at` en
`push_subscriptions`, y `claim_push_subscription` redefinida para que tambien
ponga `failure_count` a 0. Va despues de la de F0c-2 porque redefine su RPC.

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
- Enviar push solo a endpoints de la lista (`isAllowedPushEndpoint`), tambien
  desde el cron.
- Liberar la suscripcion push del navegador antes de cerrar sesion.
- No fusionar ni subir los datos locales de una cuenta a otra.
- No aceptar GET para acciones que mutan estado server-side.
- No llamar AI externa para usuarios anonimos.
- Mantener `/api` fuera del proxy matcher salvo razon explicita.
- No exponer service role key ni secrets al cliente.
- Mantener RLS en Supabase para datos de usuario.
