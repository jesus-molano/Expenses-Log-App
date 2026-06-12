"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef } from "react";

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
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    window.requestAnimationFrame(() => {
      const selected = menuRef.current?.querySelector<HTMLElement>(
        "[data-selected='true']",
      );
      const first = menuRef.current?.querySelector<HTMLElement>(
        "button:not(:disabled)",
      );
      (selected ?? first)?.focus({ preventScroll: true });
    });

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current) return;
      if (menuRef.current.contains(event.target as Node)) return;
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
      menuRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled)") ??
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
    if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
    event.preventDefault();
    onOpenChange(true);
  }

  function handleMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
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
    <div ref={menuRef} className="relative min-w-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-haspopup={menuRole}
        onKeyDown={handleTriggerKeyDown}
        className="app-control app-select-trigger inline-flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-[var(--app-radius-sm)] px-3 text-sm font-semibold"
      >
        {leading}
        <span className="min-w-0 truncate">{label}</span>
        <ChevronDown
          size={16}
          className="app-select-chevron shrink-0 text-[var(--app-text-muted)]"
          data-open={open ? "true" : "false"}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div
          role={menuRole}
          onKeyDown={handleMenuKeyDown}
          className={`app-select-menu-panel absolute top-10 z-20 grid min-w-full gap-0.5 rounded-[var(--app-radius-lg)] p-1.5 ${
            align === "left" ? "left-0" : "right-0"
          }`}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
