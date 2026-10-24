"use client";

import { useRef } from "react";
import { cn } from "@/shared/ui";
import { useDialogA11y } from "./use-dialog-a11y";
import { useHistoryLayer } from "./use-history-layer";

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
  useDialogA11y({ panelRef, onEscape: onBackdropClick });

  // Atrás cierra la hoja (solo si tiene forma de cerrarse).
  useHistoryLayer(Boolean(onBackdropClick), onBackdropClick);

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
