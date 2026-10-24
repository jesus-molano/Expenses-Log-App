"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef } from "react";
import { useMenuViewportClamp } from "./use-menu-viewport-clamp";

type CompactMenuProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  leading?: React.ReactNode;
  align?: "left" | "right";
  menuRole?: "menu" | "listbox";
  children: React.ReactNode;
};

export function CompactMenu({
  open,
  onOpenChange,
  label,
  leading,
  align = "right",
  menuRole = "menu",
  children,
}: CompactMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const openWithKeyboardRef = useRef(false);
  // Tras tocar una opción, el clic fantasma que llega al disparador no debe
  // reabrir el menú. Se limpia con un temporizador y no con la hora, que los
  // relojes falsos de los tests (y los cambios de hora) pueden congelar.
  const suppressTriggerClickRef = useRef(false);
  useMenuViewportClamp(open, align, menuRef, popupRef);

  useEffect(() => {
    if (!open) return;

    if (openWithKeyboardRef.current) {
      window.requestAnimationFrame(() => {
        const selected = popupRef.current?.querySelector<HTMLElement>(
          "[data-selected='true']",
        );
        const first = popupRef.current?.querySelector<HTMLElement>(
          "button:not(:disabled)",
        );
        (selected ?? first)?.focus({ preventScroll: true });
      });
    }

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current) return;
      if (menuRef.current.contains(event.target as Node)) {
        const target = event.target as HTMLElement;
        if (target.closest("button") !== triggerRef.current) {
          suppressTriggerClickRef.current = true;
          window.setTimeout(() => {
            suppressTriggerClickRef.current = false;
          }, 450);
        }
        return;
      }
      onOpenChange(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [onOpenChange, open]);

  function focusTrigger() {
    triggerRef.current?.focus({ preventScroll: true });
  }

  function moveFocus(direction: 1 | -1) {
    const options = Array.from(
      popupRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled)") ??
        [],
    );
    if (!options.length) return;

    const currentIndex = options.indexOf(document.activeElement as HTMLElement);
    const nextIndex =
      currentIndex < 0
        ? 0
        : (currentIndex + direction + options.length) % options.length;
    options[nextIndex]?.focus({ preventScroll: true });
  }

  function handleTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      // Cierra solo el menú, no la hoja que lo contiene.
      event.stopPropagation();
      onOpenChange(false);
      focusTrigger();
      return;
    }

    if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
    event.preventDefault();
    openWithKeyboardRef.current = true;
    onOpenChange(true);
  }

  function handleMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onOpenChange(false);
      focusTrigger();
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      moveFocus(event.key === "ArrowDown" ? 1 : -1);
    }
  }

  return (
    <div
      ref={menuRef}
      className="relative min-w-0"
      data-open={open ? "true" : "false"}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (suppressTriggerClickRef.current) return;
          openWithKeyboardRef.current = false;
          onOpenChange(!open);
        }}
        aria-expanded={open}
        aria-haspopup={menuRole}
        onKeyDown={handleTriggerKeyDown}
        className="app-control app-select-trigger inline-flex min-h-9 w-full min-w-0 items-center justify-between gap-2 rounded-[var(--app-radius-sm)] px-3 py-1.5 text-sm font-semibold"
      >
        {leading}
        {/* La etiqueta salta de linea completa y el boton crece en alto.
            flex-1: queda pegada al icono inicial, no centrada entre icono y
            flecha. */}
        <span className="min-w-0 flex-1 break-words text-left leading-snug [overflow-wrap:anywhere]">
          {label}
        </span>
        <ChevronDown
          size={16}
          className="app-select-chevron shrink-0 text-[var(--app-text-muted)]"
          data-open={open ? "true" : "false"}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div
          ref={popupRef}
          role={menuRole}
          onKeyDown={handleMenuKeyDown}
          style={
            {
              "--app-select-menu-width":
                align === "left"
                  ? "min(24rem, calc(100vw - 4rem))"
                  : "min(24rem, calc(100vw - 2rem))",
            } as React.CSSProperties
          }
          className={`app-select-menu-panel absolute top-[calc(100%+0.25rem)] z-50 grid min-w-full gap-0.5 rounded-[var(--app-radius-lg)] p-1.5 ${
            align === "left" ? "left-0" : "right-0"
          }`}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
