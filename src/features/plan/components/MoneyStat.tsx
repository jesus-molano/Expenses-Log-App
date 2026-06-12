export function MoneyStat({
  label,
  value,
  action,
}: {
  label: string;
  value: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="app-stat-card px-3 py-2.5">
      <p className="text-xs font-medium text-[var(--app-text-muted)]">{label}</p>
      <div className="mt-1 flex min-w-0 items-center justify-between gap-2">
        <p className="min-w-0 truncate text-base font-semibold text-[var(--app-text)]">
          {value}
        </p>
        {action}
      </div>
    </div>
  );
}
