import { X } from "lucide-react";

export function IncomeEventRow({
  name,
  date,
  amount,
  removeLabel,
  onRemove,
}: {
  name: string;
  date: string;
  amount: string;
  removeLabel: string;
  onRemove: () => void;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded-2xl bg-[var(--app-panel-soft-alpha)] px-3 py-2 ring-1 ring-[var(--app-border)]">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[var(--app-text)]">
          {name}
        </p>
        <p className="text-xs font-medium text-[var(--app-text-muted)]">{date}</p>
      </div>
      <p className="text-sm font-semibold text-[var(--app-text)]">{amount}</p>
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        className="grid size-8 place-items-center rounded-full bg-[var(--app-panel-soft-alpha)] text-sm font-semibold text-[var(--app-text-muted)] ring-1 ring-[var(--app-border)]"
      >
        <X size={15} />
      </button>
    </div>
  );
}
