import { cn } from "@/shared/ui";

export function Field({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: React.ReactNode;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label
      className={cn(
        "grid gap-1.5 text-sm font-semibold text-[var(--app-text-muted)]",
        className,
      )}
    >
      {label}
      {children}
      {error ? (
        <span className="text-xs font-semibold text-[var(--app-danger)]">
          {error}
        </span>
      ) : hint ? (
        <span className="text-xs font-medium text-[var(--app-text-subtle)]">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

