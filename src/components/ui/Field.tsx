import { cn } from "@/shared/ui";

export function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label
      className={cn(
        "grid gap-1.5 text-sm font-medium text-[var(--app-text-muted)]",
        className,
      )}
    >
      {label}
      {children}
    </label>
  );
}

