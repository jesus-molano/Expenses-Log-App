import { cn } from "@/shared/ui";

type SurfaceProps = {
  as?: "div" | "section" | "article";
  variant?: "default" | "muted" | "raised" | "section" | "stat" | "empty";
  padding?: "none" | "sm" | "md" | "lg";
  className?: string;
  // Nombre accesible de una tarjeta con título (un `article` o `section`).
  "aria-labelledby"?: string;
  children: React.ReactNode;
};

const variants = {
  default: "app-surface rounded-[var(--app-radius-lg)]",
  muted: "app-surface-muted rounded-[var(--app-radius-lg)]",
  raised: "app-surface-raised rounded-[var(--app-radius-xl)]",
  section: "app-section-card",
  stat: "app-stat-card",
  empty: "app-empty-line",
};

const paddings = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-5",
};

export function Surface({
  as = "div",
  variant = "default",
  padding = "none",
  className,
  "aria-labelledby": ariaLabelledBy,
  children,
}: SurfaceProps) {
  const Component = as;

  return (
    <Component
      aria-labelledby={ariaLabelledBy}
      className={cn(variants[variant], paddings[padding], className)}
    >
      {children}
    </Component>
  );
}
