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

const focusableSelector = [
  "button:not(:disabled)",
  "[href]",
  "input:not(:disabled)",
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function getFocusableElements(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector))
    .filter((element) => {
      const hidden = element.getAttribute("aria-hidden") === "true";
      return !hidden && element.tabIndex >= 0;
    });
}

export function Sheet({
  children,
  className,
  contentClassName,
  ariaLabel,
  ariaLabelledBy,
  onBackdropClick,
}: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useBodyScrollLock(true);

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const panel = panelRef.current;
    const focusFrame = window.requestAnimationFrame(() => {
      const first = panel ? getFocusableElements(panel)[0] : null;
      (first ?? panel)?.focus({ preventScroll: true });
    });

    return () => {
      window.cancelAnimationFrame(focusFrame);
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onBackdropClick?.();
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
