export function MoneyCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="min-w-0 overflow-hidden rounded-[1.15rem] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-surface)_84%,transparent)] p-3 shadow-[0_14px_42px_rgba(0,0,0,0.32)] sm:p-4">
      <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-[var(--app-accent)]">
        {icon}
        <span className="min-w-0 truncate">{label}</span>
      </div>
      <p className="mt-2 truncate text-[22px] font-semibold leading-tight text-[var(--app-text)] sm:mt-3 sm:text-2xl">
        {value}
      </p>
      <p className="mt-1 truncate text-xs font-medium text-[var(--app-text-muted)]">
        {detail}
      </p>
    </article>
  );
}
