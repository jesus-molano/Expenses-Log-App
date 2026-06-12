# Testing y calidad

La app combina tests unitarios de dominio/store/helpers con Playwright para
flujos criticos de UI y PWA. La validacion debe escalar segun el riesgo del
cambio.

## Scripts oficiales

```bash
npm run lint
npm run test
npm run build
npm run e2e
```

- `lint`: ESLint y reglas de Next/TypeScript.
- `test`: Vitest para dominio, stores, persistencia, helpers y APIs testeables.
- `build`: build de Next y validacion de boundaries.
- `e2e`: Playwright para flujos de navegador.

Para cambios solo documentales, basta revisar diff, formato Markdown y enlaces.

## Cobertura existente

Hay tests de:

- Auth callback y sanitizacion de redirects.
- API de parseo AI/local.
- Limpieza de sync metadata.
- Service worker y fallback offline.
- Persistencia local y normalizacion de store.
- Politica de sync y mensajes.
- Comandos de store.
- Recurrencias, finanzas, parser, labels, timeline y DnD.
- Estilos del design system.
- Flujos e2e de dashboard y accesibilidad critica.

## Cuando agregar tests

Agregar o actualizar Vitest cuando se toque:

- Recurrencias, fechas o calculos monetarios.
- Parser local o contrato de parseo AI.
- Store commands.
- Normalizacion, import/export o merge cloud/local.
- Preferencias de tema/idioma.
- APIs route handlers con seguridad o fallback.

Agregar o actualizar Playwright cuando se toque:

- Flujos principales de dashboard, money o settings.
- Acciones de fila, swipe, botones o menus.
- Sheets, dialogs, overlays o navegacion por teclado.
- PWA offline, install/reload o notificaciones.
- Layout responsive mobile-first.

## Checklist antes de mergear

Cambios de dominio:

- Logica pura aislada.
- Tests unitarios con casos limite.
- Sin dependencia de React, DOM, Next ni Supabase.

Cambios de estado/sync:

- Mantener `ExpenseStore` completo y normalizado.
- Preservar tombstones.
- Probar merge local/cloud si cambia persistencia.
- No crear stores paralelos fuera de `ExpenseStoreProvider`.

Cambios de API/auth:

- Validar metodo HTTP correcto.
- Validar input con esquema o checks explicitos.
- Mantener sesion requerida cuando el endpoint sea sensible.
- Comprobar fallbacks y estados de error.
- No filtrar secrets.

Cambios PWA:

- Validar carga inicial.
- Validar reload offline basico.
- Revisar cache name y assets precacheados si cambian iconos o shell.
- Confirmar que bundles `/_next/` no quedan cacheados de forma obsoleta.

Cambios UI:

- Probar mobile y desktop.
- Revisar safe areas, bottom nav y FAB.
- Confirmar que texto no se solapa ni se corta de forma critica.
- Verificar focus-visible, Escape en overlays y labels accesibles.
- Mantener alternativas a gestos cuando aplique.

## Criterios mobile/accessibility

- La primera pantalla debe ser la app util, no una landing.
- Las acciones frecuentes deben ser rapidas en tactil.
- Los controles compactos deben tener targets suficientemente comodos.
- El contenido no debe quedar tapado por bottom nav o safe area.
- Los overlays deben gestionar foco y cierre.
- Los menus deben soportar teclado basico.
- El swipe no debe bloquear scroll vertical normal.
