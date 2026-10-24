"use client";

import { useLayoutEffect, type RefObject } from "react";

// Margen que el panel deja libre respecto al borde de la pantalla (1rem).
const VIEWPORT_GUTTER_PX = 16;
// Separacion entre el disparador y el panel (0.25rem, como en CompactMenu).
const MENU_OFFSET_PX = 4;
// Por debajo de este alto (unas dos opciones) no se limita: un panel tan bajo
// no sirve y es mejor que la pagina haga scroll, como antes.
const MIN_CLAMPED_MENU_HEIGHT_PX = 96;

type MenuAlign = "left" | "right";

type AvailableMenuWidthInput = {
  anchorLeft: number;
  anchorRight: number;
  anchorWidth: number;
  viewportWidth: number;
  align: MenuAlign;
  gutter?: number;
};

// Ancho maximo para que el panel no se salga de la pantalla: alineado a la
// derecha crece hacia la izquierda desde el borde derecho del disparador, y
// alineado a la izquierda crece hacia la derecha. Nunca es mas estrecho que el
// propio disparador.
export function availableMenuWidth({
  anchorLeft,
  anchorRight,
  anchorWidth,
  viewportWidth,
  align,
  gutter = VIEWPORT_GUTTER_PX,
}: AvailableMenuWidthInput): number {
  const space =
    align === "left" ? viewportWidth - gutter - anchorLeft : anchorRight - gutter;
  return Math.max(anchorWidth, Math.floor(space));
}

export type MenuPlacement = "bottom" | "top";

type MenuVerticalPlacementInput = {
  anchorTop: number;
  anchorBottom: number;
  viewportHeight: number;
  panelHeight: number;
  // Zona visible donde puede pintarse el panel: la pantalla o, dentro de una
  // hoja con scroll, la parte visible de esa hoja.
  boundsTop?: number;
  boundsBottom?: number;
  offset?: number;
  gutter?: number;
};

// Abre el panel hacia abajo si cabe entero. Si no cabe y arriba hay mas sitio,
// lo abre hacia arriba. Si no cabe entero en ningun lado, limita su alto al
// espacio del lado elegido (el panel ya tiene scroll propio) para que ninguna
// opcion quede fuera de la pantalla, salvo que ese espacio sea minimo.
export function menuVerticalPlacement({
  anchorTop,
  anchorBottom,
  viewportHeight,
  panelHeight,
  boundsTop = 0,
  boundsBottom = viewportHeight,
  offset = MENU_OFFSET_PX,
  gutter = VIEWPORT_GUTTER_PX,
}: MenuVerticalPlacementInput): {
  placement: MenuPlacement;
  maxHeight: number | null;
} {
  const spaceBelow = Math.floor(boundsBottom - anchorBottom - offset - gutter);
  const spaceAbove = Math.floor(anchorTop - boundsTop - offset - gutter);

  if (panelHeight <= spaceBelow) return { placement: "bottom", maxHeight: null };

  const placement: MenuPlacement = spaceAbove > spaceBelow ? "top" : "bottom";
  const space = placement === "top" ? spaceAbove : spaceBelow;
  const fits = panelHeight <= space;
  return {
    placement,
    maxHeight: fits || space < MIN_CLAMPED_MENU_HEIGHT_PX ? null : space,
  };
}

const CLIPPING_OVERFLOW = new Set(["hidden", "auto", "scroll", "clip"]);

// Franja vertical visible para el panel: la pantalla recortada por cada
// antepasado que corta su contenido (una hoja con scroll, un panel con
// overflow). Un panel absoluto que pase de ahí queda cortado y no se puede
// alcanzar haciendo scroll.
function visibleVerticalBounds(element: HTMLElement, viewportHeight: number) {
  let top = 0;
  let bottom = viewportHeight;
  for (let node = element.parentElement; node && node !== document.body; node = node.parentElement) {
    if (!CLIPPING_OVERFLOW.has(getComputedStyle(node).overflowY)) continue;
    const rect = node.getBoundingClientRect();
    const clientTop = rect.top + node.clientTop;
    top = Math.max(top, clientTop);
    bottom = Math.min(bottom, clientTop + node.clientHeight);
  }
  return { top, bottom };
}

// Mantiene el panel abierto dentro de la pantalla: limita su ancho al espacio
// real hasta el borde (variable CSS --app-select-menu-available), lo abre
// hacia arriba cuando abajo no cabe (data-placement="top") y, si hace falta,
// limita su alto (--app-select-menu-available-height). Dentro de una hoja
// con scroll cuenta solo su parte visible. Se recalcula al girar o
// redimensionar.
export function useMenuViewportClamp(
  open: boolean,
  align: MenuAlign,
  anchorRef: RefObject<HTMLElement | null>,
  popupRef: RefObject<HTMLElement | null>,
) {
  useLayoutEffect(() => {
    if (!open) return;
    const anchor = anchorRef.current;
    const popup = popupRef.current;
    if (!anchor || !popup) return;

    const clamp = () => {
      const rect = anchor.getBoundingClientRect();
      const viewport = document.documentElement;
      const width = availableMenuWidth({
        anchorLeft: rect.left,
        anchorRight: rect.right,
        anchorWidth: rect.width,
        viewportWidth: viewport.clientWidth,
        align,
      });
      if (width > 0) {
        popup.style.setProperty("--app-select-menu-available", `${width}px`);
      } else {
        popup.style.removeProperty("--app-select-menu-available");
      }

      // Se mide el alto natural del panel (sin el limite de una medicion
      // anterior) antes de decidir hacia donde abre.
      popup.style.removeProperty("--app-select-menu-available-height");
      const bounds = visibleVerticalBounds(popup, viewport.clientHeight);
      const { placement, maxHeight } = menuVerticalPlacement({
        anchorTop: rect.top,
        anchorBottom: rect.bottom,
        viewportHeight: viewport.clientHeight,
        panelHeight: popup.offsetHeight,
        boundsTop: bounds.top,
        boundsBottom: bounds.bottom,
      });
      popup.dataset.placement = placement;
      if (maxHeight !== null) {
        popup.style.setProperty(
          "--app-select-menu-available-height",
          `${maxHeight}px`,
        );
      }
    };

    clamp();
    window.addEventListener("resize", clamp);
    return () => window.removeEventListener("resize", clamp);
  }, [align, anchorRef, open, popupRef]);
}
