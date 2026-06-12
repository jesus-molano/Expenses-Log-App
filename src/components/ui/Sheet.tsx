"use client";

import { cn } from "@/shared/ui";
import { useBodyScrollLock } from "./use-body-scroll-lock";

type SheetProps = {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  onBackdropClick?: () => void;
};

export function Sheet({
  children,
  className,
  contentClassName,
  onBackdropClick,
}: SheetProps) {
  useBodyScrollLock(true);

  return (
    <div
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onBackdropClick?.();
      }}
      className={cn(
        "app-sheet-backdrop",
        className,
      )}
    >
      <div
        onMouseDown={(event) => event.stopPropagation()}
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
