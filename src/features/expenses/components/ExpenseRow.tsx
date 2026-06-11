"use client";

import { useRouter } from "next/navigation";
import { type PointerEvent, useRef, useState } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Pencil, RotateCcw } from "lucide-react";
import { formatCurrency } from "@/domain/calendar";
import type { AppLanguage, ExpenseCategory, ExpenseOccurrence } from "@/domain/types";
import { categoryLabel } from "@/lib/category-labels";
import { t } from "@/lib/i18n";
import { categoryToneClass, statusLabel } from "../lib/expense-actions";

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
  const origin = useRef({ x: 0, y: 0 });
  const dragRef = useRef({ x: 0, active: false, blocked: false });
  const [drag, setDrag] = useState({ x: 0, active: false, blocked: false });
  const { setNodeRef: setDropRef } = useDroppable({
    id: `row:${occurrence.id}`,
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
  const revealThreshold = 56;
  const commitThreshold = 132;
  const swipingLeft = drag.x < -revealThreshold;
  const swipingRight = drag.x > revealThreshold;

  function setRefs(node: HTMLDivElement | null) {
    setDropRef(node);
    setDragRef(node);
  }

  function setGesture(next: typeof drag) {
    dragRef.current = next;
    setDrag(next);
  }

  function startGesture(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    event.currentTarget.setPointerCapture?.(event.pointerId);
    origin.current = { x: event.clientX, y: event.clientY };
    setGesture({ x: 0, active: true, blocked: false });
  }

  function updateGesture(event: PointerEvent<HTMLElement>) {
    if (isDragging || dragging) return;
    const current = dragRef.current;
    if (!current.active) return;

    const x = event.clientX - origin.current.x;
    const y = event.clientY - origin.current.y;

    if (Math.abs(y) > 12 && Math.abs(y) > Math.abs(x)) {
      setGesture({ x: 0, active: false, blocked: true });
      return;
    }

    if (Math.abs(x) > 10 && Math.abs(x) > Math.abs(y)) {
      event.preventDefault();
    }

    setGesture({
      ...current,
      x: Math.max(-156, Math.min(156, x)),
    });
  }

  function finishGesture() {
    const current = dragRef.current;
    if (!current.active) return;

    if (current.x < -commitThreshold) {
      onTogglePaid(occurrence);
    } else if (current.x > commitThreshold) {
      router.push(`/expenses/${occurrence.template.id}`);
    }

    setGesture({ x: 0, active: false, blocked: false });
  }

  function cancelGesture() {
    setGesture({ x: 0, active: false, blocked: false });
  }

  const dragTransform = transform ? CSS.Translate.toString(transform) : null;

  return (
    <div
      ref={setRefs}
      {...attributes}
      {...listeners}
      data-timeline-date={occurrence.dueDate}
      data-expense-row="true"
      data-expense-row-id={occurrence.id}
      className={`relative overflow-visible rounded-2xl ${
        isDragging || dragging ? "z-30 opacity-45" : ""
      } ${
        paid && !isDragging && !dragging ? "app-paid-row" : ""
      }`}
    >
      {dropPosition === "before" ? (
        <DropLine label={t("expenses.before", language)} position="before" />
      ) : null}
      <div
        aria-hidden="true"
        className={`absolute inset-0 grid grid-cols-2 rounded-2xl text-xs font-semibold transition-opacity ${
          swipingLeft || swipingRight ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="app-swipe-edit flex items-center gap-1 rounded-l-2xl px-4 ring-1">
          <Pencil size={16} />
          {t("common.edit", language)}
        </div>
        <div className="app-swipe-paid flex items-center justify-end gap-1 rounded-r-2xl px-4 ring-1">
          <RotateCcw size={16} />
          {paid ? t("common.pending", language) : t("common.paid", language)}
        </div>
      </div>

      <article
        onPointerDown={startGesture}
        onPointerMove={updateGesture}
        onPointerUp={finishGesture}
        onPointerCancel={cancelGesture}
        style={{
          transform: dragTransform ?? `translate3d(${drag.x}px, 0, 0)`,
        }}
        className={`grid min-h-14 touch-pan-y select-none grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border px-3 py-2.5 backdrop-blur-xl transition-[border-radius,box-shadow,opacity,transform,background] duration-200 ease-out ${
          isDragging || dragging
            ? "border-lime-200/50 bg-slate-900/95 shadow-[0_0_46px_rgba(132,204,22,0.36),0_26px_70px_rgba(0,0,0,0.58)]"
            : swipingLeft || swipingRight
              ? "border-white/20 bg-slate-800 shadow-[0_16px_40px_rgba(0,0,0,0.36)] ring-1 ring-white/10"
            : paid
              ? "border-white/10 bg-slate-900/80"
              : "border-white/12 bg-slate-800/95 shadow-[0_12px_34px_rgba(0,0,0,0.26)] ring-1 ring-white/8"
        }`}
      >
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={`min-w-0 truncate text-[15px] font-semibold ${
                paid
                  ? "text-slate-300 line-through decoration-slate-400"
                  : "text-white"
              }`}
            >
              {occurrence.template.name}
            </span>
            {category ? (
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${categoryToneClass(
                  category.tone,
                )}`}
              >
                {categoryLabel(category.name, language)}
              </span>
            ) : null}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p
            className={`text-[14px] font-semibold ${
              paid ? "text-slate-300 line-through decoration-slate-400" : "text-white"
            }`}
          >
            {formatCurrency(occurrence.template.amount)}
          </p>
          <p
            className={`mt-0.5 whitespace-nowrap text-[11px] font-medium ${
              paid ? "app-paid-status" : "text-white"
            }`}
          >
            {statusLabel(occurrence, today, language)}
          </p>
        </div>
      </article>
      {dropPosition === "after" ? (
        <DropLine label={t("expenses.after", language)} position="after" />
      ) : null}
    </div>
  );
}

function DropLine({
  label,
  position,
}: {
  label: string;
  position: "before" | "after";
}) {
  return (
    <div
      className={`pointer-events-none absolute inset-x-4 z-20 flex items-center gap-2 ${
        position === "before" ? "-top-1" : "-bottom-1"
      }`}
    >
      <span className="app-drop-line h-0.5 flex-1 rounded-full" />
      <span className="app-drop-pill rounded-full px-2 py-0.5 text-[10px] font-bold uppercase">
        {label}
      </span>
      <span className="app-drop-line h-0.5 flex-1 rounded-full" />
    </div>
  );
}
