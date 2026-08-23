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

La app precachea los recursos del build y las variantes de Ajustes necesarias.
Las navegaciones usan `NetworkFirst` y caen a la shell precacheada. Los enlaces
entre Gastos, Plan y Ajustes hacen una navegación de documento si el navegador
está offline, por lo que no dependen de una respuesta RSC nueva. Las respuestas
RSC GET usan un cache separado y limitado. Los assets estáticos usan caches con
caducidad. API, origenes externos y peticiones no GET usan solo red.

El service worker tambien maneja:

- `push`: muestra notificacion con titulo, cuerpo, icono y URL.
- `notificationclick`: cierra la notificacion y abre la URL asociada.

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
