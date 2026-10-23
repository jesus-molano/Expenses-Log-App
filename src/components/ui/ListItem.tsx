import { cn } from "@/shared/ui";

type ListItemProps = {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  wrapDescription?: boolean;
};

export function ListItem({
  icon,
  title,
  description,
  action,
  className,
  wrapDescription = false,
}: ListItemProps) {
  return (
    <div
      className={cn(
        "app-list-item grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2",
        className,
      )}
    >
      <span className="flex min-w-0 items-center gap-3">
        {icon ? (
          <span className="app-icon-badge size-9 min-h-9 min-w-9 shrink-0 text-[var(--app-accent)]">
            {icon}
          </span>
        ) : null}
        <span className="min-w-0">
          <span
            className={cn(
              "block text-sm font-semibold text-[var(--app-text)]",
              wrapDescription ? "break-words" : "truncate",
            )}
          >
            {title}
          </span>
          {description ? (
            <span
              className={cn(
                "block text-xs font-medium text-[var(--app-text-muted)]",
                wrapDescription ? "break-words" : "truncate",
              )}
            >
              {description}
            </span>
          ) : null}
        </span>
      </span>
      {action ? <span className="min-w-0 shrink-0">{action}</span> : null}
    </div>
  );
}
