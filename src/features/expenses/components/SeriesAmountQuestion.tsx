"use client";

import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { formatCurrency } from "@/domain/calendar";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";
import type { SeriesAmountPrompt } from "../hooks/use-series-amount-prompt";

type SeriesAmountQuestionProps = {
  prompt: SeriesAmountPrompt;
  language: AppLanguage;
  titleId?: string;
  onApply: () => void;
  onKeep: () => void;
};

// "¿Actualizar el importe desde ahora?": se pregunta después de pagar con un
// importe distinto. El foco va a la pregunta para que se lea al aparecer.
export function SeriesAmountQuestion({
  prompt,
  language,
  titleId,
  onApply,
  onKeep,
}: SeriesAmountQuestionProps) {
  const fallbackId = useId();
  const headingId = titleId ?? fallbackId;
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <section className="grid gap-3" aria-labelledby={headingId}>
      <h3
        id={headingId}
        ref={headingRef}
        tabIndex={-1}
        className="text-base font-semibold text-[var(--app-text)] outline-none"
      >
        {t("bills.seriesQuestionTitle", language)}
      </h3>
      <p className="text-sm leading-relaxed text-[var(--app-text-muted)]">
        {t("bills.seriesQuestionBody", language)
          .replace("{name}", prompt.name)
          .replace("{from}", formatCurrency(prompt.from))
          .replace("{to}", formatCurrency(prompt.to))}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="secondary" onClick={onKeep}>
          {t("bills.seriesKeep", language)}
        </Button>
        <Button type="button" variant="primary" onClick={onApply}>
          {t("bills.seriesUpdate", language)}
        </Button>
      </div>
    </section>
  );
}

// La misma pregunta en su propia hoja, para cuando el pago se hizo en otro
// sitio (la lista de recibos de Mes).
export function SeriesAmountPromptSheet({
  prompt,
  language,
  onApply,
  onKeep,
}: Omit<SeriesAmountQuestionProps, "titleId">) {
  const titleId = useId();
  return (
    <Sheet ariaLabelledBy={titleId} contentClassName="sm:max-w-sm" onBackdropClick={onKeep}>
      <div className="p-5">
        <div className="app-sheet-handle mx-auto mb-3 sm:hidden" />
        <SeriesAmountQuestion
          prompt={prompt}
          language={language}
          titleId={titleId}
          onApply={onApply}
          onKeep={onKeep}
        />
      </div>
    </Sheet>
  );
}
