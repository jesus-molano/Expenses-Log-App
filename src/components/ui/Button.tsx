import { cn } from "@/shared/ui";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
};

const variants = {
  primary:
    "bg-[var(--app-accent)] text-[var(--app-accent-contrast)] shadow-[0_0_24px_color-mix(in_srgb,var(--app-accent)_22%,transparent)]",
  secondary:
    "bg-[var(--app-panel-soft-alpha)] text-[var(--app-text)] ring-1 ring-[var(--app-border)]",
  danger:
    "bg-[color-mix(in_srgb,var(--app-danger)_18%,transparent)] text-[var(--app-danger)] ring-1 ring-[color-mix(in_srgb,var(--app-danger)_32%,transparent)]",
  ghost:
    "bg-transparent text-[var(--app-text-muted)] hover:bg-[var(--app-panel-soft-alpha)]",
};

export function Button({
  variant = "secondary",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold transition disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

