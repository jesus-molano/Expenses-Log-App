import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/domain/calendar";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";
import { capitalize, formatMonthName } from "../lib/month-view";

// Al final del mes que se mira: lo que llega los primeros días del siguiente,
// sin mezclarlo en el listado.
export function NextMonthPreview({
  monthId,
  count,
  total,
  language,
  onShow,
}: {
  monthId: string;
  count: number;
  total: number;
  language: AppLanguage;
  onShow: () => void;
}) {
  const month = formatMonthName(monthId, language);
  const summary = t(
    count === 1 ? "expenses.nextMonthPreviewOne" : "expenses.nextMonthPreviewMany",
    language,
  )
    .replace("{month}", capitalize(month))
    .replace("{count}", String(count))
    .replace("{total}", formatCurrency(total));

  return (
    <div className="app-section-card mx-4 mb-28 mt-2 grid gap-2 p-3 sm:mx-0">
      <p className="text-sm text-[var(--app-text-muted)]">{summary}</p>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="justify-self-start"
        trailingIcon={<ArrowRight size={16} />}
        onClick={onShow}
      >
        {t("expenses.nextMonthPreviewAction", language).replace("{month}", month)}
      </Button>
    </div>
  );
}
