type DropIndicatorProps = {
  position: "before" | "after";
};

export function DropIndicator({ position }: DropIndicatorProps) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-x-4 z-20 flex items-center gap-1.5 ${
        position === "before" ? "-top-1" : "-bottom-1"
      }`}
    >
      <span className="app-drop-line h-px flex-1 rounded-full" />
      <span className="app-drop-node size-2.5 shrink-0 rounded-full" />
      <span className="app-drop-line h-px flex-1 rounded-full" />
    </div>
  );
}
