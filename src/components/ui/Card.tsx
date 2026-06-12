import { cn } from "@/shared/ui";

type CardVariant = "default" | "section" | "stat" | "muted";
type CardPadding = "none" | "sm" | "md" | "lg";

const variants: Record<CardVariant, string> = {
  default: "app-card rounded-[var(--app-radius-xl)]",
  section: "app-section-card",
  stat: "app-stat-card",
  muted: "app-surface-muted rounded-[var(--app-radius-lg)]",
};

const paddings: Record<CardPadding, string> = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-5",
};

type CardProps = {
  className?: string;
  children: React.ReactNode;
  variant?: CardVariant;
  padding?: CardPadding;
  interactive?: boolean;
};

export function Card({
  className,
  children,
  variant = "default",
  padding = "none",
  interactive = false,
}: CardProps) {
  return (
    <section
      className={cn(
        variants[variant],
        paddings[padding],
        interactive && "transition hover:border-[var(--app-border-strong)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function SectionCard(props: Omit<CardProps, "variant">) {
  return <Card {...props} variant="section" />;
}

export function StatCard(props: Omit<CardProps, "variant">) {
  return <Card {...props} variant="stat" />;
}
