"use client";

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
  return (
    <div className="relative min-w-0">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className="app-control inline-flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-[var(--app-radius-sm)] px-3 text-sm font-semibold"
      >
        {leading}
        <span className="min-w-0 truncate">{label}</span>
        <span className="shrink-0 text-xs text-[var(--app-text-muted)]">v</span>
      </button>
      {open ? (
        <div
          className={`app-card absolute top-10 z-20 grid min-w-full gap-0.5 rounded-[var(--app-radius-lg)] p-1.5 ${
            align === "left" ? "left-0" : "right-0"
          }`}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
