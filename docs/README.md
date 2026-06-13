# Documentacion tecnica

Esta carpeta recoge la documentacion de mantenimiento de Expense Reminders. El
objetivo es explicar como esta montada la app, donde vive cada responsabilidad y
que hay que validar antes de tocar piezas sensibles.

## Mapa de lectura

- [Arquitectura](./architecture.md): capas, rutas, boundaries de Next y reglas
  de ownership.
- [Modelo de dominio](./domain-model.md): gastos recurrentes, ocurrencias,
  overrides, finanzas, preferencias y tombstones.
- [Estado, persistencia y sincronizacion](./state-persistence-sync.md): store
  global, localStorage, Supabase, merge cloud/local e importacion bancaria.
- [Design system](./design-system.md): tokens, componentes UI, patrones visuales
  y accesibilidad.
- [Plataforma](./platform.md): PWA, service worker, Supabase Auth, APIs,
  notificaciones, cron y seguridad.
- [Testing y calidad](./testing-quality.md): comandos, cobertura existente y
  checklists por tipo de cambio.

## Principios de mantenimiento

- Mantener la app mobile-first y PWA-friendly.
- Reusar `src/components/ui` y los tokens `--app-*` antes de crear patrones
  nuevos.
- Poner reglas de negocio puras en `src/domain` o `src/features/*/lib`, no
  dentro de JSX.
- Usar el provider global del store para pantallas y componentes interactivos.
- Tratar Supabase como una capa externa: clientes en `src/utils/supabase` y
  persistencia en `src/data`.
- Validar seguridad, offline y accesibilidad cuando se toquen auth, APIs, PWA,
  overlays, menus o gestos.
