"use client";

import { useState } from "react";
import { generateTemplateDates } from "@/domain/recurrence";
import {
  pauseResumeChoices,
  pauseStartChoices,
  pauseUntilResume,
} from "@/domain/series-lifecycle";
import type { ExpensePause, ExpenseStore, ExpenseTemplate } from "@/domain/types";

// Sin fecha de vuelta: la pausa dura hasta reanudarla.
export const OPEN_PAUSE = "open";
// Cobros de vuelta que se ofrecen.
const RESUME_CHOICES = 6;

type UsePauseSeriesSheetOptions = {
  store: ExpenseStore;
  template: ExpenseTemplate;
  now: Date;
  pauseSeries: (templateId: string, pause: ExpensePause) => void;
};

// "Pausar": primer cobro que se salta (los pendientes tras el último pagado)
// y el cobro con el que vuelve, o hasta reanudarla.
export function usePauseSeriesSheet({
  store,
  template,
  now,
  pauseSeries,
}: UsePauseSeriesSheetOptions) {
  const [startChoices, setStartChoices] = useState<string[] | null>(null);
  const [from, setFrom] = useState("");
  const [resumeOn, setResumeOn] = useState<string>(OPEN_PAUSE);
  const resumeChoices = from ? pauseResumeChoices(template, from, RESUME_CHOICES) : [];
  const pause = from
    ? pauseUntilResume(from, resumeOn === OPEN_PAUSE ? undefined : resumeOn)
    : null;
  // Cuántos cobros se saltan (sin vuelta, no tiene fin).
  const skippedCount =
    pause && pause.to !== undefined
      ? generateTemplateDates({ ...template, pauses: undefined }, pause.from, pause.to).length
      : null;

  function openSheet() {
    const choices = pauseStartChoices(store, template, now);
    setStartChoices(choices);
    setFrom(choices[0] ?? "");
    setResumeOn(OPEN_PAUSE);
  }

  function changeFrom(next: string) {
    setFrom(next);
    // Una vuelta que ya no se ofrece desde el nuevo inicio (anterior a él o
    // más allá de las que se listan) no vale: no se guardaría una pausa
    // con fecha sin que se vea elegida.
    if (
      resumeOn !== OPEN_PAUSE &&
      !pauseResumeChoices(template, next, RESUME_CHOICES).includes(resumeOn)
    ) {
      setResumeOn(OPEN_PAUSE);
    }
  }

  function confirm() {
    if (!pause) return;
    pauseSeries(template.id, pause);
    setStartChoices(null);
  }

  return {
    open: startChoices !== null,
    startChoices: startChoices ?? [],
    from,
    resumeOn,
    resumeChoices,
    skippedCount,
    setFrom: changeFrom,
    setResumeOn,
    openSheet,
    close: () => setStartChoices(null),
    confirm,
  };
}
