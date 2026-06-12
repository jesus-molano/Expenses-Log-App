"use client";

import { useEffect } from "react";
import { cn } from "@/shared/ui";

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
  useEffect(() => {
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalBodyOverflow = document.body.style.overflow;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    return () => {
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.overflow = originalBodyOverflow;
    };
  }, []);

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
