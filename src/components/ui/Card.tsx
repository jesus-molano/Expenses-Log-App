import { cn } from "@/shared/ui";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-[1.35rem] border border-[var(--app-border)] bg-[var(--app-panel-alpha)] shadow-[var(--app-shadow)] backdrop-blur-2xl",
        className,
      )}
    >
      {children}
    </section>
  );
}

