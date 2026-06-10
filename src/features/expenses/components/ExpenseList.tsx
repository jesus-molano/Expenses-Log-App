"use client";

import {
  eachDayOfInterval,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
} from "date-fns";
import { es } from "date-fns/locale";
import { Home } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatCurrency } from "@/domain/calendar";
import type { ExpenseCategory, ExpenseOccurrence } from "@/domain/types";
import type { TimelineSection } from "../lib/timeline";
import { ExpenseRow } from "./ExpenseRow";

type ExpenseListProps = {
  sections: TimelineSection[];
  categories: ExpenseCategory[];
  today: string;
  onTodayVisibilityChange: (visible: boolean) => void;
  onTogglePaid: (occurrence: ExpenseOccurrence) => void;
  onMoveOccurrence: (occurrence: ExpenseOccurrence, dueDate: string) => void;
  onMoveOccurrenceSeries: (occurrence: ExpenseOccurrence, dueDate: string) => void;
};

export function ExpenseList({
  sections,
  categories,
  today,
  onTodayVisibilityChange,
  onTogglePaid,
  onMoveOccurrence,
  onMoveOccurrenceSeries,
}: ExpenseListProps) {
  const focusRef = useRef<HTMLElement | null>(null);
  const didFocusTimeline = useRef(false);
  const [scheduling, setScheduling] = useState(false);
  const [pendingMove, setPendingMove] = useState<{
    occurrence: ExpenseOccurrence;
    dueDate: string;
  } | null>(null);
  const focusIndex = sections.findIndex((section) => section.anchorDate >= today);
  const schedulingDays = useMemo(() => {
    const monthKeys = Array.from(
      new Set(sections.map((section) => section.anchorDate.slice(0, 7))),
    ).sort();
    const occurrencesByDate = new Map<string, ExpenseOccurrence[]>();

    for (const section of sections) {
      for (const item of section.items) {
        const items = occurrencesByDate.get(item.dueDate) ?? [];
        items.push(item);
        occurrencesByDate.set(item.dueDate, items);
      }
    }

    return monthKeys.flatMap((monthKey) => {
      const month = parseISO(`${monthKey}-01`);
      return eachDayOfInterval({
        start: startOfMonth(month),
        end: endOfMonth(month),
      }).map((date) => {
        const dateKey = format(date, "yyyy-MM-dd");

        return {
          date: dateKey,
          items: occurrencesByDate.get(dateKey) ?? [],
        };
      });
    });
  }, [sections]);

  function closeMoveSheet() {
    setPendingMove(null);
  }

  function applyMove(scope: "single" | "series") {
    if (!pendingMove) return;

    if (scope === "single") {
      onMoveOccurrence(pendingMove.occurrence, pendingMove.dueDate);
    } else {
      onMoveOccurrenceSeries(pendingMove.occurrence, pendingMove.dueDate);
    }

    setPendingMove(null);
  }

  useEffect(() => {
    if (didFocusTimeline.current || !focusRef.current) return;
    didFocusTimeline.current = true;

    window.requestAnimationFrame(() => {
      if (!focusRef.current) return;

      const headerOffset = 156;
      const targetTop =
        focusRef.current.getBoundingClientRect().top +
        window.scrollY -
        headerOffset;

      window.scrollTo({ top: Math.max(0, targetTop), behavior: "auto" });
    });
  }, [sections]);

  useEffect(() => {
    function updateTodayVisibility() {
      const todayNode = document.querySelector<HTMLElement>('[data-section-id="today"]');
      if (!todayNode) {
        onTodayVisibilityChange(false);
        return;
      }

      const rect = todayNode.getBoundingClientRect();
      onTodayVisibilityChange(rect.top >= 72 && rect.top <= 250);
    }

    updateTodayVisibility();
    window.addEventListener("scroll", updateTodayVisibility, { passive: true });
    window.addEventListener("resize", updateTodayVisibility);
    return () => {
      window.removeEventListener("scroll", updateTodayVisibility);
      window.removeEventListener("resize", updateTodayVisibility);
    };
  }, [onTodayVisibilityChange, sections]);

  return (
    <section>
      {sections.length ? (
        <div className="relative space-y-5">
          {sections.some((section) => section.anchorDate < today) ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 -top-10 z-10 h-24 bg-gradient-to-b from-[#020617] via-[#020617]/80 to-transparent lg:-top-16 lg:h-36"
            />
          ) : null}
          {scheduling ? schedulingDays.map((day) => {
            const isToday = day.date === today;
            const isPast = day.date < today;

            return (
              <article
                key={day.date}
                data-section-id={isToday ? "today" : undefined}
                data-timeline-date={day.date}
                className={`relative scroll-mt-24 pl-4 transition duration-300 ${
                  day.items.length ? "opacity-100" : "animate-[fade-in_240ms_ease-out] opacity-80"
                }`}
              >
                <span
                  className={`absolute left-0 top-1.5 size-2 rounded-full ring-2 ${
                    isToday
                      ? "bg-cyan-200 text-cyan-200 shadow-[0_0_18px_currentColor] ring-cyan-200/30"
                      : day.items.length
                        ? "bg-white/55 ring-white/15"
                        : "bg-white/18 ring-white/8"
                  }`}
                />
                <span className="absolute bottom-[-1.25rem] left-[3px] top-5 w-px bg-white/12" />
                {isToday ? (
                  <div className="absolute -left-2 -top-2 bottom-[-1.25rem] w-[3px] rounded-full bg-cyan-200 shadow-[0_0_24px_rgba(103,232,249,0.9)]" />
                ) : null}

                <header
                  className={`mb-1.5 flex items-end justify-between gap-3 ${
                    isPast ? "opacity-60" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <h2
                      className={`truncate font-semibold capitalize leading-tight text-white ${
                        isToday ? "text-[19px]" : "text-[15px]"
                      }`}
                    >
                      {isToday ? "Hoy" : format(parseISO(day.date), "EEEE d", { locale: es })}
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-300">
                      {day.items.length ? "Con gastos" : "Disponible"}
                    </p>
                  </div>
                  {day.items.length ? (
                    <p className="shrink-0 text-sm font-semibold text-white">
                      {formatCurrency(
                        day.items.reduce(
                          (sum, item) =>
                            sum +
                            (item.status === "paid" ? 0 : item.template.amount),
                          0,
                        ),
                      )}
                    </p>
                  ) : null}
                </header>

                <div className="space-y-1.5">
                  {day.items.length ? (
                    day.items.map((occurrence) => (
                      <ExpenseRow
                        key={occurrence.id}
                        occurrence={occurrence}
                        category={categories.find(
                          (category) =>
                            category.id === occurrence.template.categoryId,
                        )}
                        today={today}
                        onTogglePaid={onTogglePaid}
                        onScheduleMove={(occurrence, dueDate) =>
                          setPendingMove({ occurrence, dueDate })
                        }
                        onLiftChange={setScheduling}
                      />
                    ))
                  ) : (
                    <div className="h-8 rounded-2xl border border-dashed border-white/10 bg-white/[0.018]" />
                  )}
                </div>
              </article>
            );
          }) : sections.map((section, index) => {
            const shouldAnchorFocus = index === focusIndex;

            return (
            <article
              key={section.id}
              ref={shouldAnchorFocus ? focusRef : undefined}
              data-section-id={section.id}
              data-timeline-date={section.anchorDate}
              className="relative scroll-mt-24 pl-4"
            >
              <span
                className={`absolute left-0 top-1.5 size-2 rounded-full shadow-[0_0_14px_currentColor] ring-2 ${
                  section.tone === "critical"
                    ? "bg-orange-400 text-orange-400 ring-orange-300/15"
                    : section.tone === "estimated"
                      ? "bg-yellow-300 text-yellow-300 ring-yellow-300/15"
                      : section.tone === "paid"
                        ? "bg-lime-400/70 text-lime-400/70 ring-lime-300/10"
                        : "bg-cyan-300 text-cyan-300 ring-cyan-300/15"
                }`}
              />
              <span className="absolute bottom-[-1.25rem] left-[3px] top-5 w-px bg-white/12" />

              {section.id === "today" ? (
                <div className="absolute -left-2 -top-2 bottom-[-1.25rem] w-[3px] rounded-full bg-cyan-200 shadow-[0_0_24px_rgba(103,232,249,0.9)]" />
              ) : null}

              <header className={`mb-1.5 flex items-end justify-between gap-3 ${section.anchorDate < today ? "opacity-70" : ""}`}>
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

              <div
                className={`space-y-1.5 transition ${
                  index === 0 ? "drop-shadow-[0_20px_35px_rgba(132,204,22,0.22)]" : ""
                } ${index > 2 ? "opacity-90" : ""}`}
              >
                {section.items.length ? section.items.map((occurrence) => (
                  <ExpenseRow
                    key={occurrence.id}
                    occurrence={occurrence}
                    category={categories.find(
                      (category) => category.id === occurrence.template.categoryId,
                    )}
                    today={today}
                    onTogglePaid={onTogglePaid}
                    onScheduleMove={(occurrence, dueDate) =>
                      setPendingMove({ occurrence, dueDate })
                    }
                    onLiftChange={setScheduling}
                  />
                )) : (
                  <div className="rounded-2xl border border-cyan-200/16 bg-white/[0.045] px-3 py-3 text-sm font-medium text-white">
                    Sin cargos previstos hoy
                  </div>
                )}
              </div>
            </article>
          );
          })}
          {sections.some((section) => section.items.length > 0) ? (
            <div className="pointer-events-none relative h-24 overflow-hidden" aria-hidden="true">
              <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-transparent via-[#07111f]/60 to-[#020617]" />
              <div className="mx-auto mt-8 h-20 w-[86%] rounded-[2rem] border border-cyan-200/10 bg-cyan-200/[0.025] blur-[1px]" />
            </div>
          ) : null}
        </div>
      ) : (
        <div className="grid place-items-center rounded-[1.25rem] border border-dashed border-white/15 bg-white/[0.04] px-6 py-14 text-center">
          <Home size={32} className="text-slate-500" />
          <p className="mt-3 font-semibold text-white">Nada pendiente</p>
          <p className="mt-1 max-w-xs text-sm text-slate-400">
            Usa el campo superior para encontrar un gasto o crear uno nuevo en segundos.
          </p>
        </div>
      )}

      {pendingMove ? (
        <div className="fixed inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 mx-auto max-w-md rounded-[1.35rem] border border-white/10 bg-slate-950/94 p-3 text-white shadow-[0_24px_70px_rgba(0,0,0,0.58)] backdrop-blur-2xl">
          <p className="text-sm font-semibold">
            Mover {pendingMove.occurrence.template.name} al{" "}
            {format(parseISO(pendingMove.dueDate), "d MMMM", { locale: es })}
          </p>
          <p className="mt-1 text-xs text-slate-300">
            Elige si es un cambio puntual o si actualiza el ciclo del gasto.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => applyMove("single")}
              className="h-11 rounded-2xl bg-white/10 text-sm font-semibold text-white ring-1 ring-white/10"
            >
              Solo este
            </button>
            <button
              type="button"
              onClick={() => applyMove("series")}
              className="h-11 rounded-2xl bg-lime-300 text-sm font-semibold text-slate-950 shadow-[0_0_30px_rgba(132,204,22,0.22)]"
            >
              Este y siguientes
            </button>
          </div>
          <button
            type="button"
            onClick={closeMoveSheet}
            className="mt-2 h-10 w-full rounded-2xl text-sm font-medium text-slate-300"
          >
            Cancelar
          </button>
        </div>
      ) : null}
    </section>
  );
}
