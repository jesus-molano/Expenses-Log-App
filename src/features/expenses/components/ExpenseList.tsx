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
import { useEffect, useRef, useState } from "react";
import { formatCurrency } from "@/domain/calendar";
import type { ExpenseCategory, ExpenseOccurrence } from "@/domain/types";
import type { TimelineSection } from "../lib/timeline";
import { ExpenseRow } from "./ExpenseRow";

type DropTarget = {
  date: string;
  position: "before" | "after";
  rowId?: string;
};

type ExpenseListProps = {
  sections: TimelineSection[];
  categories: ExpenseCategory[];
  today: string;
  onTogglePaid: (occurrence: ExpenseOccurrence) => void;
  onMoveOccurrence: (
    occurrence: ExpenseOccurrence,
    dueDate: string,
    sortOrder?: number,
  ) => void;
  onMoveOccurrenceSeries: (occurrence: ExpenseOccurrence, dueDate: string) => void;
};

export function ExpenseList({
  sections,
  categories,
  today,
  onTogglePaid,
  onMoveOccurrence,
  onMoveOccurrenceSeries,
}: ExpenseListProps) {
  const focusRef = useRef<HTMLElement | null>(null);
  const didFocusTimeline = useRef(false);
  const [draggedOccurrence, setDraggedOccurrence] =
    useState<ExpenseOccurrence | null>(null);
  const [activeDropTarget, setActiveDropTarget] = useState<DropTarget | null>(null);
  const [pendingMove, setPendingMove] = useState<{
    occurrence: ExpenseOccurrence;
    dueDate: string;
  } | null>(null);
  const focusIndex = sections.findIndex((section) => section.anchorDate >= today);
  const currentMonth = today.slice(0, 7);

  function closeMoveSheet() {
    setPendingMove(null);
  }

  function applySeriesMove() {
    if (!pendingMove) return;

    onMoveOccurrenceSeries(pendingMove.occurrence, pendingMove.dueDate);
    setPendingMove(null);
  }

  function scheduleMove(
    occurrence: ExpenseOccurrence,
    dueDate: string,
    target?: DropTarget | null,
  ) {
    const targetOccurrence = sections
      .flatMap((section) => section.items)
      .find((item) => item.id === target?.rowId);
    const targetSortOrder = targetOccurrence?.sortOrder ?? 0;
    const sortOrder = targetOccurrence
      ? target?.position === "before"
        ? targetSortOrder - 0.5
        : targetSortOrder + 0.5
      : undefined;

    onMoveOccurrence(occurrence, dueDate, sortOrder);
    setPendingMove({ occurrence, dueDate });
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
          {sections.map((section, index) => {
            const shouldAnchorFocus = index === focusIndex;
            const expandSection =
              Boolean(draggedOccurrence) &&
              draggedOccurrence?.dueDate.slice(0, 7) === currentMonth &&
              section.anchorDate.slice(0, 7) === currentMonth &&
              section.items.some((item) => item.id === draggedOccurrence?.id);
            const sectionDays = expandSection
              ? eachDayOfInterval({
                  start: startOfMonth(parseISO(section.anchorDate)),
                  end: endOfMonth(parseISO(section.anchorDate)),
                }).map((date) => format(date, "yyyy-MM-dd"))
              : [];
            const sectionItemDates = new Set(
              section.items.map((item) => item.dueDate),
            );
            const emptyDaysBefore = sectionDays.filter(
              (day) =>
                day < (draggedOccurrence?.dueDate ?? "") &&
                !sectionItemDates.has(day),
            );
            const emptyDaysAfter = sectionDays.filter(
              (day) =>
                day > (draggedOccurrence?.dueDate ?? "") &&
                !sectionItemDates.has(day),
            );

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
                {section.items.length ? (
                  <>
                    {expandSection
                      ? emptyDaysBefore.map((day) => (
                          <EmptyDayTarget
                            key={day}
                            date={day}
                            active={
                              activeDropTarget?.date === day &&
                              !activeDropTarget.rowId
                            }
                            label="Soltar aqui"
                          />
                        ))
                      : null}
                    {section.items.map((occurrence) => (
                      <ExpenseRow
                        key={occurrence.id}
                        occurrence={occurrence}
                        category={categories.find(
                          (category) =>
                            category.id === occurrence.template.categoryId,
                        )}
                        today={today}
                        onTogglePaid={onTogglePaid}
                        onScheduleMove={scheduleMove}
                        onDropTargetChange={setActiveDropTarget}
                        dropPosition={
                          activeDropTarget?.rowId === occurrence.id
                            ? activeDropTarget.position
                            : null
                        }
                        onLiftChange={(lifted, occurrence) => {
                          setDraggedOccurrence(lifted ? occurrence : null)
                          if (!lifted) setActiveDropTarget(null);
                        }}
                      />
                    ))}
                    {expandSection
                      ? emptyDaysAfter.map((day) => (
                          <EmptyDayTarget
                            key={day}
                            date={day}
                            active={
                              activeDropTarget?.date === day &&
                              !activeDropTarget.rowId
                            }
                            label="Soltar aqui"
                          />
                        ))
                      : null}
                  </>
                ) : (
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

      {pendingMove ? (
        <div className="fixed inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 mx-auto max-w-md rounded-[1.35rem] border border-white/10 bg-slate-950/94 p-3 text-white shadow-[0_24px_70px_rgba(0,0,0,0.58)] backdrop-blur-2xl">
          <p className="text-sm font-semibold">
            Movido {pendingMove.occurrence.template.name} al{" "}
            {format(parseISO(pendingMove.dueDate), "d MMMM", { locale: es })}
          </p>
          <p className="mt-1 text-xs text-slate-300">
            Se ha aplicado como cambio puntual. Puedes actualizar tambien el loop.
          </p>
          <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
            <button
              type="button"
              onClick={applySeriesMove}
              className="h-11 rounded-2xl bg-lime-300 text-sm font-semibold text-slate-950 shadow-[0_0_30px_rgba(132,204,22,0.22)]"
            >
              Este y siguientes
            </button>
            <button
              type="button"
              onClick={closeMoveSheet}
              className="h-11 rounded-2xl bg-white/10 px-4 text-sm font-semibold text-white ring-1 ring-white/10"
            >
              Ok
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function EmptyDayTarget({
  date,
  active,
  label,
}: {
  date: string;
  active: boolean;
  label: string;
}) {
  return (
    <div
      data-timeline-date={date}
      className={`relative animate-[fade-in_220ms_ease-out] rounded-2xl border px-3 py-2 text-xs font-medium transition ${
        active
          ? "border-lime-200/70 bg-lime-300/16 text-white shadow-[0_0_28px_rgba(132,204,22,0.28)]"
          : "border-dashed border-white/10 bg-white/[0.016] text-slate-400"
      }`}
    >
      {active ? (
        <span className="absolute inset-x-4 -top-1 h-0.5 rounded-full bg-lime-200 shadow-[0_0_18px_rgba(190,242,100,0.9)]" />
      ) : null}
      <span className="capitalize">
        {format(parseISO(date), "EEEE d", { locale: es })}
      </span>
      {active ? (
        <span className="float-right text-[11px] font-semibold text-lime-100">
          {label}
        </span>
      ) : null}
    </div>
  );
}
