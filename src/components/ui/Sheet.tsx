"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/shared/ui";
import { useBodyScrollLock } from "./use-body-scroll-lock";

type SheetProps = {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  onBackdropClick?: () => void;
};

export function Sheet({
  children,
  className,
  contentClassName,
  ariaLabel,
  ariaLabelledBy,
  onBackdropClick,
}: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useBodyScrollLock(true);

  useEffect(() => {
    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const panel = panelRef.current;
    const focusable = panel?.querySelector<HTMLElement>(
      [
        "button:not(:disabled)",
        "[href]",
        "input:not(:disabled)",
        "select:not(:disabled)",
        "textarea:not(:disabled)",
        "[tabindex]:not([tabindex='-1'])",
      ].join(","),
    );
    (focusable ?? panel)?.focus({ preventScroll: true });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onBackdropClick?.();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      restoreFocusRef.current?.focus({ preventScroll: true });
    };
  }, [onBackdropClick]);

  return (
    <div
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onBackdropClick?.();
      }}
      role="presentation"
      className={cn(
        "app-sheet-backdrop",
        className,
      )}
    >
      <div
        ref={panelRef}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabelledBy ? undefined : (ariaLabel ?? "Dialog")}
        aria-labelledby={ariaLabelledBy}
        tabIndex={-1}
        className={cn(
          "app-sheet-panel",
          contentClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
