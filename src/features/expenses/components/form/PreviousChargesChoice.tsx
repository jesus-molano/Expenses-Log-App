import { useId } from "react";
import { Button } from "@/components/ui/Button";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";
import { formatMonthName } from "../../lib/month-view";
import type { PreviousChargesChoiceValue } from "../../types";

type PreviousChargesChoiceProps = {
  count: number;
  // Mes de hoy: los cobros anteriores son los de meses ya cerrados.
  monthId: string;
  value: PreviousChargesChoiceValue;
  language: AppLanguage;
  onChange: (value: PreviousChargesChoiceValue) => void;
};

const OPTIONS: Array<{
  value: PreviousChargesChoiceValue;
  label: "monthClose.previousPaid" | "monthClose.previousSkipped" | "monthClose.previousPending";
}> = [
  { value: "paid", label: "monthClose.previousPaid" },
  { value: "skipped", label: "monthClose.previousSkipped" },
  { value: "due", label: "monthClose.previousPending" },
];

// Un gasto que empezó antes de este mes: se pregunta qué hacer con sus
// cobros anteriores para que no queden como impagados en cada mes cerrado.
export function PreviousChargesChoice({
  count,
  monthId,
  value,
  language,
  onChange,
}: PreviousChargesChoiceProps) {
  const titleId = useId();
  const month = formatMonthName(monthId, language);

  return (
    <div
      role="group"
      aria-labelledby={titleId}
      className="app-section-card border-[color-mix(in_srgb,var(--app-warning)_28%,transparent)] p-3"
    >
      <p id={titleId} className="text-sm font-semibold text-[var(--app-warning)]">
        {t("monthClose.previousTitle", language).replace("{month}", month)}
      </p>
      <p className="mt-1 text-xs text-[var(--app-text-muted)]">
        {(count === 1
          ? t("monthClose.previousBodyOne", language)
          : t("monthClose.previousBodyMany", language).replace("{count}", String(count))
        ).replace("{month}", month)}
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {OPTIONS.map((option) => (
          <Button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            variant={value === option.value ? "primary" : "secondary"}
            size="sm"
            className="h-10 min-w-0 px-2"
            aria-pressed={value === option.value}
          >
            {t(option.label, language)}
          </Button>
        ))}
      </div>
    </div>
  );
}
