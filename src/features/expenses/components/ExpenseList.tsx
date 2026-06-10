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
  onTogglePaid: (occurrence: ExpenseOccurrence) => void;
};

export function ExpenseList({
  sections,
  categories,
  today,
  onTogglePaid,
}: ExpenseListProps) {
  const focusRef = useRef<HTMLElement | null>(null);
  const didFocusTimeline = useRef(false);
  const firstActiveIndex = sections.findIndex((section) => section.tone !== "paid");

  useEffect(() => {
    if (didFocusTimeline.current || !focusRef.current) return;
    didFocusTimeline.current = true;
    focusRef.current.scrollIntoView({ block: "start", behavior: "instant" });
  }, [sections]);

  return (
    <section>
      {sections.length ? (
        <div className="space-y-5">
          {sections.map((section, index) => {
            const shouldAnchorFocus = index === firstActiveIndex;

            return (
            <article
              key={section.id}
              ref={shouldAnchorFocus ? focusRef : undefined}
              className="relative scroll-mt-3 pl-7"
            >
              <span
                className={`absolute left-2 top-1 size-3 rounded-full shadow-[0_0_28px_currentColor] ring-4 ${
                  section.tone === "critical"
                    ? "bg-rose-500 ring-rose-100"
                    : section.tone === "estimated"
                      ? "bg-amber-500 ring-amber-100"
                      : section.tone === "paid"
                        ? "bg-emerald-500 ring-emerald-100"
                        : "bg-slate-400 ring-slate-200"
                }`}
              />
              <span className="absolute bottom-[-1.25rem] left-[13px] top-5 w-px bg-gradient-to-b from-cyan-300 via-violet-200 to-transparent shadow-[0_0_18px_rgba(34,211,238,0.45)]" />

              <header className={`mb-1.5 flex items-end justify-between gap-3 ${index > 2 ? "opacity-75" : ""}`}>
                <div className="min-w-0">
                  <h2 className="truncate text-[16px] font-semibold capitalize leading-tight">
                    {section.title}
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">{section.subtitle}</p>
                </div>
                {section.total > 0 ? (
                  <p className="shrink-0 text-sm font-semibold text-slate-700">
                    {formatCurrency(section.total)}
                  </p>
                ) : null}
              </header>

              <div
                className={`space-y-1.5 transition ${
                  index === 0 ? "drop-shadow-[0_20px_35px_rgba(34,211,238,0.16)]" : ""
                } ${index > 2 ? "opacity-80" : ""}`}
              >
                {section.items.map((occurrence) => (
                  <ExpenseRow
                    key={occurrence.id}
                    occurrence={occurrence}
                    category={categories.find(
                      (category) => category.id === occurrence.template.categoryId,
                    )}
                    today={today}
                    onTogglePaid={onTogglePaid}
                  />
                ))}
              </div>
            </article>
          );
          })}
        </div>
      ) : (
        <div className="grid place-items-center rounded-[1.25rem] border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <Home size={32} className="text-slate-300" />
          <p className="mt-3 font-semibold text-slate-800">Nada pendiente</p>
          <p className="mt-1 max-w-xs text-sm text-slate-500">
            Usa el campo superior para encontrar un gasto o crear uno nuevo en segundos.
          </p>
        </div>
      )}
    </section>
  );
}
