"use client";

type SettingRowProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
};

export function SettingRow({
  icon,
  title,
  description,
  action,
}: SettingRowProps) {
  return (
    <div className="grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-[var(--app-panel-soft-alpha)] px-3 py-2 text-[var(--app-text)] ring-1 ring-[var(--app-border)]">
      <span className="flex min-w-0 items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--app-panel-soft-alpha)] text-[var(--app-accent)]">
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{title}</span>
          <span className="block truncate text-xs font-medium text-[var(--app-text-muted)]">
            {description}
          </span>
        </span>
      </span>
      {action ? <span className="min-w-0 shrink-0">{action}</span> : null}
    </div>
  );
}
