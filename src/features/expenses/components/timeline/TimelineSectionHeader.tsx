import { formatCurrency } from "@/domain/calendar";
import type { TimelineSection } from "../../lib/timeline";

type TimelineSectionHeaderProps = {
  section: TimelineSection;
  today: string;
};

export function TimelineSectionHeader({
  section,
  today,
}: TimelineSectionHeaderProps) {
  return (
    <header
      className={`mb-1.5 flex items-end justify-between gap-3 ${
        section.muted || (section.anchorDate < today && section.tone === "paid")
          ? "opacity-70"
          : ""
      }`}
    >
      <div className="min-w-0">
        <h2
          className={`break-words font-semibold leading-tight first-letter:uppercase text-[var(--app-text)] ${
            section.id === "today" ? "text-[19px]" : "text-[16px]"
          }`}
        >
          {section.title}
        </h2>
        <p className="mt-0.5 break-words text-xs text-[var(--app-text-muted)]">
          {section.subtitle}
        </p>
      </div>
      {section.items.length > 1 && section.total > 0 ? (
        <p className="app-money shrink-0 whitespace-nowrap text-sm font-semibold text-[var(--app-text)]">
          {formatCurrency(section.total)}
        </p>
      ) : null}
    </header>
  );
}
