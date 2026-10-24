import { useId } from "react";
import type { AppLanguage } from "@/domain/types";
import { formatLeadDays } from "@/features/expenses/lib/reminder-labels";

type LeadDaysPickerProps = {
  title: string;
  options: readonly number[];
  value: number;
  language: AppLanguage;
  onChange: (days: number) => void;
};

// Antelación como fila de botones: un toque y queda elegida.
export function LeadDaysPicker({
  title,
  options,
  value,
  language,
  onChange,
}: LeadDaysPickerProps) {
  const titleId = useId();

  return (
    <div className="py-2">
      <p id={titleId} className="text-sm font-semibold text-[var(--app-text)]">
        {title}
      </p>
      <div
        role="group"
        aria-labelledby={titleId}
        className="mt-2 grid gap-2"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((days) => (
          <button
            key={days}
            type="button"
            aria-pressed={value === days}
            data-selected={value === days ? "true" : "false"}
            onClick={() => onChange(days)}
            className="app-control h-11 rounded-[var(--app-radius-md)] px-1 text-sm font-semibold"
          >
            {formatLeadDays(days, language)}
          </button>
        ))}
      </div>
    </div>
  );
}
