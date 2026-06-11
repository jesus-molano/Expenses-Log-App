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
        section.anchorDate < today ? "opacity-70" : ""
      }`}
    >
      <div className="min-w-0">
        <h2
          className={`truncate font-semibold capitalize leading-tight text-white ${
            section.id === "today" ? "text-[19px]" : "text-[16px]"
          }`}
        >
          {section.title}
        </h2>
        <p className="mt-0.5 text-xs text-slate-300">{section.subtitle}</p>
      </div>
      {section.total > 0 ? (
        <p className="shrink-0 text-sm font-semibold text-white">
          {formatCurrency(section.total)}
        </p>
      ) : null}
    </header>
  );
}
