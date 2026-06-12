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

`public/sw.js` usa cache `expense-reminders-v5`.

Precachea una shell minima:

- `/`
- manifest
- iconos principales
- favicon
- apple touch icon

Para navegaciones, intenta red y actualiza el cache de `/`. Si no hay red,
responde con la shell cacheada. Para assets del mismo origen, intenta red,
cachea respuestas correctas y cae a cache si falla. Las rutas `/_next/` se piden
a red para evitar servir bundles obsoletos.

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
- `/api/push/daily-reminders`: endpoint llamado por cron para recordatorios.
- `/api/account`: operaciones de cuenta.

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
usuario para enviar recordatorios cuando hay gastos pendientes o estimados.

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
