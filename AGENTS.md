<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes - APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code that touches Next.js routing, rendering, metadata, config, middleware/proxy, server actions, caching, or build behavior. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Guia del proyecto

Esta app es una PWA mobile-first para seguimiento de gastos recurrentes. Antes de cambiar codigo, respeta la arquitectura existente, el design system y la separacion entre UI, estado, persistencia y dominio.

## Arquitectura

- `src/app`: App Router de Next. Contiene rutas, layouts, paginas, loading/error states, API routes y providers globales. Mantener aqui solo composicion de ruta, lectura server-side necesaria y wiring de alto nivel.
- `src/features/*`: Modulos por dominio funcional (`expenses`, `plan`, `settings`, `auth`). Cada feature agrupa sus componentes, hooks y helpers especificos.
- `src/components/ui`: Componentes base reutilizables del design system (`Button`, `Surface`, `Sheet`, `Input`, etc.). Reusar estos antes de crear nuevos controles.
- `src/domain`: Tipos y logica pura de negocio compartida. No debe depender de React, Next, DOM ni Supabase.
- `src/stores/app`: Estado de aplicacion, comandos, sincronizacion y persistencia asociada al store.
- `src/data`: Acceso a datos y persistencia local/cloud. Mantener aqui clientes y adaptadores externos.
- `src/shared`: Utilidades transversales como `cn`, tema, i18n, mensajes y helpers compartidos.
- `src/utils/supabase`: Clientes Supabase separados para browser/server/proxy. No mezclar clientes server y client.

## Design system y UI

- Usar tokens CSS `--app-*`, clases `app-*` y componentes existentes antes de introducir estilos nuevos.
- Mantener los estilos globales y tokens en `src/app/globals.css`; evitar duplicar valores visuales en componentes.
- Evitar colores Tailwind hardcodeados (`slate-*`, `lime-*`, `cyan-*`, etc.) en codigo nuevo salvo que exista una razon clara. Preferir clases semanticas del sistema (`app-button-*`, `app-surface-*`, `app-chip-*`, etc.).
- Mantener una experiencia mobile-first, PWA-friendly y compatible con safe areas, navegacion inferior y gestos tactiles.
- Usar iconos de `lucide-react` cuando haya un icono equivalente. Para acciones icon-only, preferir `IconButton` y labels accesibles.
- Cuidar estados `hover`, `focus-visible`, `disabled`, loading, empty y error. No crear controles que solo funcionen en el caso feliz.
- No introducir una nueva paleta, radios, sombras o patrones visuales si el design system ya cubre el caso.

## Componentizacion

- Mantener componentes pequenos y con una responsabilidad clara.
- Los componentes compartidos y genericos van en `src/components/ui`; los componentes especificos de negocio van dentro de `src/features/<feature>/components`.
- Extraer subcomponentes cuando el JSX, las ramas condicionales o los bloques de estado hagan dificil leer el flujo principal.
- Evitar componentes "god object" que mezclen UI, calculos de negocio, side effects y persistencia.
- Preferir props explicitas y tipos locales simples. Si un tipo se comparte entre capas o features, moverlo a `src/domain` o al `types.ts` de la feature correspondiente.
- Mantener composicion por feature: una pantalla puede orquestar componentes, pero los detalles del dominio deben vivir en la feature.

## Logica, hooks y DRY

- Extraer logica con estado, efectos, listeners, DnD, formularios, sincronizacion o derivaciones complejas a custom hooks en `src/features/<feature>/hooks`.
- Mantener funciones puras, calculos, formateos, validaciones y reglas de negocio en `src/features/<feature>/lib` o `src/domain`.
- No duplicar reglas de negocio, calculos monetarios, fechas, recurrencias, parseo, labels o decisiones de estado visual. Buscar primero en `domain`, `features/*/lib`, `shared` y `stores/app`.
- Los componentes deben renderizar y delegar: no esconder efectos de persistencia, llamadas Supabase o reglas complejas dentro de handlers inline largos.
- Si una logica necesita tests unitarios, debe estar en una funcion pura o hook aislable, no enterrada en JSX.
- Mantener server/client boundaries claros. Solo usar `"use client"` donde haga falta interactividad, hooks de React, browser APIs o clientes browser.

## Datos, estado y Supabase

- Usar los clientes existentes en `src/utils/supabase` y respetar la separacion `server.ts`, `client.ts` y `proxy.ts`.
- Mantener persistencia y adaptadores en `src/data`; no llamar APIs externas directamente desde componentes si existe una capa de datos o comando adecuado.
- Usar comandos y stores existentes en `src/stores/app` para cambios de estado de aplicacion. Evitar duplicar mutaciones en componentes.
- Tratar `.env.local` como privado. Documentar nuevas variables en `.env.example` si se agregan.

## Calidad y validacion

- Usar imports con alias `@/*`.
- Mantener TypeScript estricto y evitar `any` salvo que haya una justificacion puntual.
- Agregar o actualizar tests con Vitest cuando se toque logica pura, hooks complejos, store commands, fechas, dinero, recurrencias, parseo o reglas de negocio.
- Para cambios visuales o flujos de usuario, validar en navegador y considerar Playwright si el comportamiento es critico.
- Ejecutar al menos `npm run lint` y los tests relevantes cuando el cambio sea de codigo. Para cambios solo documentales, revisar el diff y formato Markdown.
- Mantener cambios acotados. No hacer refactors no relacionados ni mover arquitectura sin necesidad concreta.
