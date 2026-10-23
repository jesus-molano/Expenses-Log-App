import { Plus, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { formatCurrency } from "@/domain/calendar";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";
import {
  balanceSparkline,
  type BalanceEntry,
  type BalanceTrend,
} from "../lib/balance-log";
import { formatSignedCurrency } from "../lib/insight-format";
import { formatShortDate } from "../lib/plan-dashboard";
import { PlanEmptyLine } from "./PlanSectionList";

// Cuántos saldos se listan debajo de la gráfica (la gráfica los usa todos).
const VISIBLE_ENTRIES = 6;
const CHART_WIDTH = 320;
const CHART_HEIGHT = 72;

// Registro de saldo: lo que dice el banco en cada fecha y cómo evoluciona.
export function BalanceLogSection({
  language,
  entries,
  trend,
  onRecord,
  onDelete,
}: {
  language: AppLanguage;
  entries: BalanceEntry[];
  trend: BalanceTrend | null;
  onRecord: () => void;
  onDelete: (entry: BalanceEntry) => void;
}) {
  const recent = entries.slice(-VISIBLE_ENTRIES).reverse();

  return (
    <section className="min-w-0" aria-labelledby="balance-log-title">
      <header className="flex items-end justify-between gap-3 px-1">
        <div className="min-w-0">
          <h2 id="balance-log-title" className="app-plan-section-title text-[var(--app-text)]">
            {t("insights.balance.title", language)}
          </h2>
          <p className="mt-1 text-sm text-[var(--app-text-muted)]">
            {t("insights.balance.subtitle", language)}
          </p>
        </div>
        <Button
          size="sm"
          variant="soft"
          className="shrink-0"
          leadingIcon={<Plus size={16} aria-hidden="true" />}
          onClick={onRecord}
        >
          {t("insights.balance.record", language)}
        </Button>
      </header>

      {trend ? (
        <>
          <div className="app-plan-metric-grid mt-4 rounded-[var(--app-radius-lg)] px-3 py-3">
            <p className="text-xs font-medium text-[var(--app-text-muted)]">
              {t("insights.balance.latest", language).replace(
                "{date}",
                formatShortDate(trend.latest.date, language),
              )}
            </p>
            <p className="app-money mt-1 text-2xl font-semibold text-[var(--app-text)]">
              {formatCurrency(trend.latest.amount)}
            </p>
            {trend.previous ? <TrendLine trend={trend} language={language} /> : null}
            {entries.length > 1 ? <BalanceSparkline entries={entries} language={language} /> : null}
          </div>

          <h3 className="mt-5 px-1 text-sm font-semibold text-[var(--app-text)]">
            {t("insights.balance.history", language)}
          </h3>
          <ul className="mt-2 grid gap-1">
            {recent.map((entry) => (
              <li
                key={entry.date}
                className="flex min-h-11 items-center justify-between gap-3 rounded-[var(--app-radius-sm)] px-3 py-1"
              >
                <span className="text-sm text-[var(--app-text-muted)]">
                  {formatShortDate(entry.date, language)}
                </span>
                <span className="flex items-center gap-2">
                  <span className="app-money text-sm font-semibold text-[var(--app-text)]">
                    {formatCurrency(entry.amount)}
                  </span>
                  <IconButton
                    variant="ghost"
                    size="touch"
                    onClick={() => onDelete(entry)}
                    aria-label={t("insights.balance.delete", language).replace(
                      "{date}",
                      formatShortDate(entry.date, language),
                    )}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </IconButton>
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="mt-4">
          <PlanEmptyLine>{t("insights.balance.empty", language)}</PlanEmptyLine>
        </div>
      )}
    </section>
  );
}

// Subir es bueno: verde con flecha arriba; bajar, aviso con flecha abajo. El
// signo y el icono dicen la dirección aunque no se distinga el color.
function TrendLine({ trend, language }: { trend: BalanceTrend; language: AppLanguage }) {
  const up = trend.delta >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <p
      className={`app-money mt-1 flex items-center gap-1.5 text-xs font-semibold ${
        up ? "text-[var(--app-success)]" : "text-[var(--app-warning)]"
      }`}
    >
      <Icon size={14} aria-hidden="true" />
      {t("insights.balance.change", language)
        .replace("{delta}", formatSignedCurrency(trend.delta, formatCurrency))
        .replace("{date}", formatShortDate(trend.previous!.date, language))}
    </p>
  );
}

// Línea de evolución en el gris de contexto con el último saldo en el color
// de acento. La línea se estira al ancho disponible; los puntos van en HTML
// para que sigan siendo redondos. Cada punto lleva su fecha e importe como
// tooltip nativo; la lista de debajo es la alternativa accesible.
function BalanceSparkline({
  entries,
  language,
}: {
  entries: BalanceEntry[];
  language: AppLanguage;
}) {
  const { path, points } = balanceSparkline(entries, {
    width: CHART_WIDTH,
    height: CHART_HEIGHT,
    padding: 6,
  });
  const first = entries[0];
  const last = entries.at(-1)!;
  const label = t("insights.balance.chartLabel", language)
    .replace("{from}", formatShortDate(first.date, language))
    .replace("{to}", formatShortDate(last.date, language))
    .replace("{first}", formatCurrency(first.amount))
    .replace("{last}", formatCurrency(last.amount));

  return (
    <div role="img" aria-label={label} className="relative mt-3 h-[72px] w-full">
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        className="absolute inset-0 h-full w-full overflow-visible"
      >
        <path
          d={path}
          fill="none"
          stroke="var(--app-text-muted)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {points.map((point, index) => (
        <span
          key={point.date}
          title={`${formatShortDate(point.date, language)} · ${formatCurrency(point.amount)}`}
          className="absolute grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center"
          style={{
            left: `${(point.x / CHART_WIDTH) * 100}%`,
            top: `${(point.y / CHART_HEIGHT) * 100}%`,
          }}
        >
          {index === points.length - 1 ? (
            <span className="size-2.5 rounded-full bg-[var(--app-accent)] ring-2 ring-[var(--app-surface)]" />
          ) : null}
        </span>
      ))}
    </div>
  );
}
