import { cn } from "@/shared/ui";

type SheetProps = {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
};

export function Sheet({ children, className, contentClassName }: SheetProps) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-end bg-[color-mix(in_srgb,var(--app-bg)_72%,transparent)] p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6",
        className,
      )}
    >
      <div
        className={cn(
          "max-h-[92dvh] w-full overflow-y-auto rounded-t-[1.65rem] border border-[var(--app-border)] bg-[var(--app-surface-strong)] shadow-[var(--app-shadow)] sm:max-w-xl sm:rounded-[1.65rem]",
          contentClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}

