import { useId } from "react";
import { CalendarX2, CirclePause, CirclePlay, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { SeriesLifecycle } from "@/domain/series-lifecycle";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";
import { formatChargeDate } from "../../lib/series-format";

type SeriesLifecycleCardProps = {
  lifecycle: SeriesLifecycle;
  language: AppLanguage;
  today: string;
  onFinish: () => void;
  onReactivate: () => void;
  onPause: () => void;
  onResume: () => void;
  onRemovePause: () => void;
};

// Estado de la suscripción (activa, en pausa o finalizada) y sus acciones.
// Finalizar conserva lo ya pagado; borrar el gasto sigue en el formulario.
export function SeriesLifecycleCard({
  lifecycle,
  language,
  today,
  onFinish,
  onReactivate,
  onPause,
  onResume,
  onRemovePause,
}: SeriesLifecycleCardProps) {
  const titleId = useId();
  const { end, pause } = lifecycle;
  const date = (value: string) => formatChargeDate(value, language, today);
  const lines: string[] = [];

  if (end) {
    lines.push(
      end.lastCharge
        ? t(end.past ? "bills.endedAfter" : "bills.endsAfter", language).replace(
            "{date}",
            date(end.lastCharge),
          )
        : t("bills.endedOn", language).replace("{date}", date(end.date)),
    );
  }
  if (pause && !end?.past) {
    const start = t(pause.active ? "bills.pausedSince" : "bills.pauseScheduled", language).replace(
      "{date}",
      date(pause.firstSkipped ?? pause.pause.from),
    );
    const back = pause.resumesOn
      ? t("bills.pauseReturns", language).replace("{date}", date(pause.resumesOn))
      : t("bills.pauseOpen", language);
    lines.push(`${start} · ${back}`);
  }
  if (!lines.length) lines.push(t("bills.lifecycleActive", language));

  return (
    <section aria-labelledby={titleId} className="app-section-card mt-4 grid gap-3 p-4">
      <h2 id={titleId} className="text-base font-semibold text-[var(--app-text)]">
        {t("bills.lifecycleTitle", language)}
      </h2>
      <div className="grid gap-1">
        {lines.map((line) => (
          <p key={line} className="text-sm text-[var(--app-text-muted)]">
            {line}
          </p>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {end ? (
          <Button type="button" leadingIcon={<RotateCcw size={16} />} onClick={onReactivate}>
            {t("bills.reactivate", language)}
          </Button>
        ) : (
          <Button type="button" leadingIcon={<CalendarX2 size={16} />} onClick={onFinish}>
            {t("bills.finish", language)}
          </Button>
        )}
        {end?.past ? null : pause?.active ? (
          <Button type="button" leadingIcon={<CirclePlay size={16} />} onClick={onResume}>
            {t("bills.resume", language)}
          </Button>
        ) : pause ? (
          <Button type="button" variant="ghost" leadingIcon={<X size={16} />} onClick={onRemovePause}>
            {t("bills.removePause", language)}
          </Button>
        ) : (
          <Button type="button" leadingIcon={<CirclePause size={16} />} onClick={onPause}>
            {t("bills.pause", language)}
          </Button>
        )}
      </div>
    </section>
  );
}
