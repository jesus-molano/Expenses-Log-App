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
        className="inline-flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-xl bg-white/10 px-3 text-sm font-semibold text-white ring-1 ring-white/10"
      >
        {leading}
        <span className="min-w-0 truncate">{label}</span>
        <span className="shrink-0 text-xs text-slate-300">v</span>
      </button>
      {open ? (
        <div
          className={`absolute top-10 z-20 grid min-w-full gap-0.5 rounded-2xl border border-white/10 bg-slate-950/96 p-1.5 shadow-[0_20px_60px_rgba(0,0,0,0.42)] backdrop-blur-2xl ${
            align === "left" ? "left-0" : "right-0"
          }`}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
