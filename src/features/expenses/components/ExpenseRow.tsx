"use client";

import { useRouter } from "next/navigation";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { AppLanguage, ExpenseCategory, ExpenseOccurrence } from "@/domain/types";
import { t } from "@/shared/i18n";
import { useSwipeAction } from "../hooks/use-swipe-action";
import { DropIndicator } from "./row/DropIndicator";
import { ExpenseRowContent } from "./row/ExpenseRowContent";
import { SwipeActionsLayer } from "./row/SwipeActionsLayer";

type ExpenseRowProps = {
  occurrence: ExpenseOccurrence;
  category?: ExpenseCategory;
  today: string;
  language?: AppLanguage;
  onTogglePaid: (occurrence: ExpenseOccurrence) => void;
  dropPosition?: "before" | "after" | null;
  dragging?: boolean;
};

export function ExpenseRow({
  occurrence,
  category,
  today,
  language = "es",
  onTogglePaid,
  dropPosition = null,
  dragging = false,
}: ExpenseRowProps) {
  const router = useRouter();
  const { setNodeRef: setDropRef } = useDroppable({
    id: `row:${occurrence.id}`,
    disabled: dragging,
    data: {
      date: occurrence.dueDate,
      rowId: occurrence.id,
      type: "row",
    },
  });
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
    isDragging,
  } = useDraggable({
    id: occurrence.id,
    data: { occurrence },
  });
  const paid = occurrence.status === "paid";
  const dragActive = isDragging || dragging;
  const swipe = useSwipeAction({
    disabled: dragActive,
    onCommitLeft: () => onTogglePaid(occurrence),
    onCommitRight: () => router.push(`/expenses/${occurrence.template.id}`),
  });

  function setRefs(node: HTMLDivElement | null) {
    setDropRef(node);
    setDragRef(node);
  }

  const dragTransform = transform ? CSS.Translate.toString(transform) : null;
  const swipeX = Math.round(swipe.x);

  return (
    <div
      ref={setRefs}
      {...attributes}
      {...listeners}
      data-timeline-date={occurrence.dueDate}
      data-expense-row="true"
      data-expense-row-id={occurrence.id}
      className={`relative overflow-visible rounded-2xl ${
        dragActive ? "z-0" : ""
      } ${
        paid && !dragActive ? "app-paid-row" : ""
      }`}
    >
      {dropPosition === "before" ? (
        <DropIndicator label={t("expenses.before", language)} position="before" />
      ) : null}
      <SwipeActionsLayer
        direction={swipe.direction}
        paid={paid}
        language={language}
      />

      <article
        {...swipe.handlers}
        style={{
          transform: dragTransform ?? `translate3d(${swipeX}px, 0, 0)`,
          viewTransitionName: `expense-${occurrence.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`,
        }}
        aria-label={`${occurrence.template.name} ${statusLabelForA11y(paid, language)}`}
        className={`app-expense-row-card grid min-h-14 touch-pan-y select-none grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border px-3 py-2.5 transition-[transform,border-color,box-shadow,background-color] duration-200 ease-out will-change-transform ${
          dragActive
            ? "invisible border-lime-200/50 bg-slate-900/95 shadow-[0_0_46px_rgba(132,204,22,0.36),0_26px_70px_rgba(0,0,0,0.58)]"
            : swipe.direction
              ? "app-expense-row-card-swiping border-white/20 shadow-[0_16px_40px_rgba(0,0,0,0.36)] ring-1 ring-white/10"
            : paid
              ? "border-white/10 bg-slate-900/80"
            : "border-white/12 bg-slate-800/95 shadow-[0_12px_34px_rgba(0,0,0,0.26)] ring-1 ring-white/8"
        }`}
      >
        <ExpenseRowContent
          occurrence={occurrence}
          category={category}
          today={today}
          language={language}
        />
      </article>
      {dropPosition === "after" ? (
        <DropIndicator label={t("expenses.after", language)} position="after" />
      ) : null}
    </div>
  );
}

function statusLabelForA11y(paid: boolean, language: AppLanguage) {
  return paid ? t("common.paid", language) : t("common.pending", language);
}

