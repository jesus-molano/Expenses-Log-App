"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef } from "react";

type CompactMenuProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  leading?: React.ReactNode;
  align?: "left" | "right";
  children: React.ReactNode;
};

export function CompactMenu({
  open,
  onOpenChange,
  label,
  leading,
  align = "right",
  children,
}: CompactMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

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

  return (
    <div ref={menuRef} className="relative min-w-0">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
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
