"use client";

import { useRouter } from "next/navigation";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { CheckCircle2, Pencil, RotateCcw } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import type { AppLanguage, ExpenseCategory, ExpenseOccurrence } from "@/domain/types";
import { t } from "@/shared/i18n";
import { useSwipeAction } from "../hooks/use-swipe-action";
import { expenseRowToneClass } from "../lib/expense-visual-state";
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
  const rowToneClass = expenseRowToneClass(occurrence, today);
  const swipe = useSwipeAction({
    disabled: dragActive,
    onCommitLeft: () => onTogglePaid(occurrence),
    onCommitRight: () => router.push(`/expenses/${occurrence.template.id}`),
  });
  const togglePaidLabel = paid
    ? `${t("common.pending", language)}: ${occurrence.template.name}`
    : `${t("common.paid", language)}: ${occurrence.template.name}`;
  const editLabel = `${t("common.edit", language)}: ${occurrence.template.name}`;

  function setRefs(node: HTMLDivElement | null) {
    setDropRef(node);
    setDragRef(node);
  }

  function stopButtonPointer(event: React.PointerEvent<HTMLButtonElement>) {
    event.stopPropagation();
  }

  function togglePaidFromButton(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    onTogglePaid(occurrence);
  }

  function editFromButton(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    router.push(`/expenses/${occurrence.template.id}`);
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
        paid && !dragActive ? "app-expense-row-paid" : ""
      }`}
    >
      {dropPosition === "before" ? (
        <DropIndicator position="before" />
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
        className={`app-expense-row-card grid min-h-[4.25rem] touch-pan-y select-none grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-[var(--app-radius-md)] border px-3.5 py-3 transition-[transform,border-color,box-shadow,background-color] duration-200 ease-out will-change-transform sm:grid-cols-[minmax(0,1fr)_auto_auto] ${
          dragActive
            ? "invisible app-surface-raised border-[var(--app-border-strong)]"
            : swipe.direction
              ? "app-expense-row-card-swiping app-surface-raised border-[var(--app-border)]"
              : rowToneClass
        }`}
      >
        <ExpenseRowContent
          occurrence={occurrence}
          category={category}
          today={today}
          language={language}
        />
        <div className="hidden shrink-0 items-center gap-1 sm:flex">
          <IconButton
            type="button"
            size="sm"
            variant={paid ? "default" : "ghost"}
            aria-label={togglePaidLabel}
            title={togglePaidLabel}
            onPointerDown={stopButtonPointer}
            onClick={togglePaidFromButton}
          >
            {paid ? <RotateCcw size={15} /> : <CheckCircle2 size={15} />}
          </IconButton>
          <IconButton
            type="button"
            size="sm"
            variant="ghost"
            aria-label={editLabel}
            title={editLabel}
            onPointerDown={stopButtonPointer}
            onClick={editFromButton}
          >
            <Pencil size={15} />
          </IconButton>
        </div>
      </article>
      {dropPosition === "after" ? (
        <DropIndicator position="after" />
      ) : null}
    </div>
  );
}

function statusLabelForA11y(paid: boolean, language: AppLanguage) {
  return paid ? t("common.paid", language) : t("common.pending", language);
}

