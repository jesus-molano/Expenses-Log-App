# Design system

La UI esta pensada como PWA mobile-first: densa, tactil, clara y optimizada para
uso repetido en movil. El design system se basa en tokens CSS, clases `app-*` y
componentes base reutilizables.

## Fuentes de estilos

`src/app/globals.css` importa los bloques principales:

- `styles/tokens.css`: temas, colores, radios, sombras, motion y tokens de
  Tailwind inline.
- `styles/app-shell.css`: estructura global, shell, navegacion y safe areas.
- `styles/expenses-timeline.css`: timeline y estados visuales de gastos.
- `styles/components.css`: controles, superficies, menus, sheets y botones.
- `styles/motion-accessibility.css`: preferencias de movimiento y accesibilidad.

Los componentes deben consumir tokens `--app-*` o clases `app-*`. Evitar valores
visuales hardcodeados cuando exista un token semantico.

## Temas

Temas soportados:

- `atlas`
- `obsidian-amber`
- `vice-afterglow` (predeterminado)
- `catppuccin`
- `rose-pine`
- `nord`
- `dracula`
- `tokyo-night`

El tema activo se aplica con `data-theme` en `<html>`. Los colores funcionales
deben usar variables como `--app-accent`, `--app-danger`, `--app-success`,
`--app-warning`, `--app-text`, `--app-surface` y equivalentes.

## Componentes base

Usar `src/components/ui` antes de crear controles nuevos:

- `Button`: acciones con texto.
- `IconButton`: acciones icon-only con label accesible.
- `Surface` y `Card`: contenedores reutilizables.
- `Sheet`: dialog/sheet modal accesible.
- `CompactMenu`: menu compacto o listbox.
- `SelectMenu`: seleccion basada en menu.
- `Field` y `DatePickerField`: campos de formulario.
- `ConfirmActionDialog`: confirmaciones destructivas.
- `ListItem`: filas genericas.

Los componentes especificos de gastos, dinero o ajustes deben vivir en su
feature correspondiente.

## Patrones visuales

- Mobile first: disenar primero para pantalla estrecha y gesto tactil.
- Respetar safe areas, bottom nav y FAB offsets.
- Mantener densidad utilitaria en dashboard y money; evitar layouts tipo
  landing page.
- Usar `lucide-react` para iconos siempre que exista un equivalente.
- Para acciones solo icono, usar `IconButton` o un boton con `aria-label`.
- No introducir nuevas paletas, sombras, radios o gradientes si los tokens ya
  cubren el caso.
- Evitar Tailwind de color hardcodeado (`slate-*`, `cyan-*`, etc.) en codigo
  nuevo salvo una excepcion local justificada.

## Gestos y acciones

En mobile, las filas de gasto priorizan swipe para acciones rapidas. En desktop
o pantallas mayores, hay acciones visibles por fila para mantener accesibilidad
y descubribilidad.

El swipe es un atajo tactil, no debe ser la unica via cuando el contexto no es
movil. Cualquier flujo critico debe tener alternativa con boton, menu o teclado
si aplica.

## Accesibilidad

Expectativas minimas:

- `Sheet` usa `role="dialog"`, `aria-modal`, label accesible, foco inicial,
  Escape para cerrar y restauracion de foco.
- `CompactMenu` soporta roles `menu` o `listbox`, Escape, flechas y foco al
  abrir/cerrar.
- Los menus flotantes no deben quedar recortados por la superficie padre. Si el
  contenido no cabe en pantalla, el panel mantiene scroll vertical propio.
- Botones icon-only necesitan nombre accesible.
- Estados focus-visible deben ser visibles con tokens del sistema.
- Overlays deben bloquear scroll de fondo cuando estan abiertos.
- No debe haber texto truncado de forma inservible ni solapes en mobile.
- Los gestos tactiles no deben impedir navegacion basica por teclado en desktop.

## Checklist para UI nueva

- Reusa componente base existente.
- Usa tokens `--app-*` y clases `app-*`.
- Tiene estados hover, focus-visible, disabled, loading, empty y error si
  corresponden.
- El texto cabe en mobile y desktop.
- Los iconos tienen label o texto asociado.
- El flujo principal funciona con teclado si es un overlay, menu, formulario o
  accion critica.
- Se valida visualmente en mobile.
