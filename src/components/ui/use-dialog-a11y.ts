"use client";

import { type RefObject, useEffect, useRef, useState } from "react";
import { useBodyScrollLock } from "./use-body-scroll-lock";

const focusableSelector = [
  "button:not(:disabled)",
  "[href]",
  "input:not(:disabled)",
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  "summary",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function getFocusableElements(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector))
    .filter((element) => {
      const hidden = element.getAttribute("aria-hidden") === "true";
      const closedDetails = element.closest("details:not([open])");
      const hiddenByClosedDetails =
        closedDetails !== null &&
        element !== closedDetails.querySelector(":scope > summary");
      return !hidden && !hiddenByClosedDetails && element.tabIndex >= 0;
    });
}

// Diálogos abiertos, del más antiguo al más reciente. Solo el de encima
// atiende Escape y Tab: una confirmación sobre una hoja no cierra también la
// hoja ni le devuelve el foco.
const openDialogs: symbol[] = [];

type UseDialogA11yOptions = {
  panelRef: RefObject<HTMLElement | null>;
  // Escape. Sin él, Escape no hace nada (la capa no se puede cerrar así).
  onEscape?: () => void;
  // Lo que recibe el foco al abrir; si no, el primer elemento enfocable.
  initialFocusRef?: RefObject<HTMLElement | null>;
};

// Accesibilidad común de hojas y diálogos modales: foco inicial, foco
// atrapado con Tab, vuelta del foco al cerrar, Escape y bloqueo del scroll de
// la página. Atrás va aparte (`useHistoryLayer`).
export function useDialogA11y({
  panelRef,
  onEscape,
  initialFocusRef,
}: UseDialogA11yOptions) {
  const onEscapeRef = useRef(onEscape);

  useEffect(() => {
    onEscapeRef.current = onEscape;
  }, [onEscape]);

  // Lo que tenía el foco al abrir, leído en el primer render: en un efecto
  // ya sería el campo con `autoFocus` de dentro del diálogo (los hijos se
  // enfocan antes), y al cerrar el foco no volvería a quien lo abrió.
  const [opener] = useState(() =>
    typeof document !== "undefined" && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );

  useBodyScrollLock(true);

  useEffect(() => {
    const panel = panelRef.current;
    const focusFrame = window.requestAnimationFrame(() => {
      const initial = initialFocusRef?.current;
      if (initial) {
        initial.focus({ preventScroll: true });
        return;
      }
      // Un campo con `autoFocus` dentro del diálogo ya tiene el foco: se queda.
      if (panel?.contains(document.activeElement)) return;
      const first = panel ? getFocusableElements(panel)[0] : null;
      (first ?? panel)?.focus({ preventScroll: true });
    });

    return () => {
      window.cancelAnimationFrame(focusFrame);
      // Solo al cerrar de verdad (el panel ya no está en la página): el
      // desmontaje simulado de StrictMode no le quita el foco al campo.
      if (panel?.isConnected) return;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [panelRef, initialFocusRef, opener]);

  useEffect(() => {
    const id = Symbol("dialog");
    openDialogs.push(id);

    function handleKeyDown(event: KeyboardEvent) {
      if (openDialogs.at(-1) !== id) return;
      // Un diálogo en un portal que no usa este hook (el selector de fecha)
      // gestiona sus propias teclas: Escape lo cierra a él, no a esta capa.
      const target = event.target;
      if (
        target instanceof Element &&
        !panelRef.current?.contains(target) &&
        target.closest('[role="dialog"], [role="alertdialog"]')
      ) {
        return;
      }

      if (event.key === "Escape") {
        event.stopPropagation();
        onEscapeRef.current?.();
        return;
      }

      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;

      const focusableElements = getFocusableElements(panel);
      if (!focusableElements.length) {
        event.preventDefault();
        panel.focus({ preventScroll: true });
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements.at(-1);
      const active = document.activeElement;

      if (!panel.contains(active)) {
        event.preventDefault();
        first?.focus({ preventScroll: true });
        return;
      }

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last?.focus({ preventScroll: true });
        return;
      }

      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first?.focus({ preventScroll: true });
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      const index = openDialogs.indexOf(id);
      if (index !== -1) openDialogs.splice(index, 1);
    };
  }, [panelRef]);
}
