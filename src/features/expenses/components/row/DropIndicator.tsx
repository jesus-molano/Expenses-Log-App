"use client";

type DropIndicatorProps = {
  label: string;
  position: "before" | "after";
};

export function DropIndicator({ label, position }: DropIndicatorProps) {
  return (
    <div
      className={`pointer-events-none absolute inset-x-4 z-20 flex items-center gap-2 ${
        position === "before" ? "-top-1" : "-bottom-1"
      }`}
    >
      <span className="app-drop-line h-0.5 flex-1 rounded-full" />
      <span className="app-drop-pill rounded-full px-2 py-0.5 text-[10px] font-bold uppercase">
        {label}
      </span>
      <span className="app-drop-line h-0.5 flex-1 rounded-full" />
    </div>
  );
}
