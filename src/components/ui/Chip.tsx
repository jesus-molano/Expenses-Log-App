import type { CategoryTone } from "@/domain/types";
import { cn } from "@/shared/ui";

type ChipTone = CategoryTone | "accent" | "success" | "warning" | "danger" | "info";

const toneClasses: Record<ChipTone, string> = {
  accent: "app-chip-violet",
  blue: "app-chip-blue",
  danger: "app-chip-rose",
  green: "app-chip-green",
  info: "app-chip-blue",
  orange: "app-chip-orange",
  rose: "app-chip-rose",
  slate: "app-chip-slate",
  success: "app-chip-green",
  violet: "app-chip-violet",
  warning: "app-chip-orange",
};

type ChipProps = {
  tone?: ChipTone;
  selected?: boolean;
  size?: "sm" | "md";
  className?: string;
  children: React.ReactNode;
};

export function Chip({
  tone = "slate",
  selected = false,
  size = "sm",
  className,
  children,
}: ChipProps) {
  return (
    <span
      className={cn(
        "app-chip inline-flex min-w-0 items-center justify-center gap-1.5 font-semibold",
        toneClasses[tone],
        selected && "app-chip-selected",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        className,
      )}
    >
      {children}
    </span>
  );
}
