"use client";

import { Home } from "lucide-react";
import { useEffect, useRef } from "react";
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
};

export function ExpenseList({
  sections,
  categories,
  today,
  onTodayVisibilityChange,
  onTogglePaid,
  onMoveOccurrence,
}: ExpenseListProps) {
  const focusRef = useRef<HTMLElement | null>(null);
  const didFocusTimeline = useRef(false);
  const focusIndex = sections.findIndex((section) => section.anchorDate >= today);

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

              <header className={`mb-1.5 flex items-end justify-between gap-3 ${section.anchorDate < today ? "opacity-70" : ""}`}>
                <div className="min-w-0">
                  <h2 className="truncate text-[16px] font-semibold capitalize leading-tight text-white">
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
                    onMoveOccurrence={onMoveOccurrence}
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
    </section>
  );
}
