export type MoneyStatTone = "neutral" | "info" | "expense" | "success" | "danger";

export function MoneyStat({
  label,
  value,
  action,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: MoneyStatTone;
}) {
  return (
    <div className="app-stat-card px-3 py-2.5" data-tone={tone}>
      <div className="app-stat-title">
        {icon ? <span className="app-stat-icon">{icon}</span> : null}
        <p className="app-stat-label min-w-0 truncate text-xs font-medium">
          {label}
        </p>
      </div>
      <div className="mt-1 flex min-w-0 items-center justify-between gap-2">
        <p className="app-stat-value min-w-0 truncate text-base font-semibold">
          {value}
        </p>
        {action}
      </div>
    </div>
  );
}
