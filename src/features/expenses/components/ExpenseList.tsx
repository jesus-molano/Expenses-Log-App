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
  const monthDaysBySection = useMemo(() => {
    return new Map(
      sections.map((section) => {
        const anchor = parseISO(section.anchorDate);
        const days = eachDayOfInterval({
          start: startOfMonth(anchor),
          end: endOfMonth(anchor),
        });

        return [section.id, days.map((day) => format(day, "yyyy-MM-dd"))];
      }),
    );
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
        <div className="space-y-5">
          {sections.map((section, index) => {
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

              {scheduling ? (
                <div className="mb-2 grid grid-cols-7 gap-1 rounded-2xl border border-white/10 bg-slate-950/72 p-2 shadow-[0_18px_44px_rgba(0,0,0,0.28)] backdrop-blur-xl">
                  {monthDaysBySection.get(section.id)?.map((day) => {
                    const date = parseISO(day);
                    const isToday = day === today;
                    const hasItems = section.items.some((item) => item.dueDate === day);

                    return (
                      <div
                        key={day}
                        data-timeline-date={day}
                        className={`grid h-9 place-items-center rounded-xl text-[12px] font-semibold ring-1 transition ${
                          isToday
                            ? "bg-cyan-300 text-slate-950 ring-cyan-200"
                            : hasItems
                              ? "bg-white/12 text-white ring-white/15"
                              : "bg-white/[0.04] text-slate-300 ring-white/8"
                        }`}
                      >
                        {format(date, "d", { locale: es })}
                      </div>
                    );
                  })}
                </div>
              ) : null}

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
          <div className="relative h-28 overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-transparent via-slate-950/55 to-slate-950" />
            <p className="absolute inset-x-0 bottom-8 text-center text-xs font-medium text-slate-400">
              Hay mas timeline mas adelante
            </p>
          </div>
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
