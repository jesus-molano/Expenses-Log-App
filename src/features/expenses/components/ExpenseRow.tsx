"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type PointerEvent, useRef, useState } from "react";
import { Pencil, RotateCcw } from "lucide-react";
import { formatCurrency } from "@/domain/calendar";
import type { ExpenseCategory, ExpenseOccurrence } from "@/domain/types";
import { categoryToneClass, statusLabel } from "../lib/expense-actions";

type ExpenseRowProps = {
  occurrence: ExpenseOccurrence;
  category?: ExpenseCategory;
  today: string;
  onTogglePaid: (occurrence: ExpenseOccurrence) => void;
  onScheduleMove: (occurrence: ExpenseOccurrence, dueDate: string) => void;
  onLiftChange: (lifted: boolean) => void;
};

export function ExpenseRow({
  occurrence,
  category,
  today,
  onTogglePaid,
  onScheduleMove,
  onLiftChange,
}: ExpenseRowProps) {
  const router = useRouter();
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  const dragRef = useRef({ x: 0, y: 0, active: false, lifted: false });
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false, lifted: false });
  const paid = occurrence.status === "paid";
  const swipingLeft = drag.x < -28 && !drag.lifted;
  const swipingRight = drag.x > 28 && !drag.lifted;

  function clearHoldTimer() {
    if (!holdTimer.current) return;
    clearTimeout(holdTimer.current);
    holdTimer.current = null;
  }

  function setGesture(next: typeof drag) {
    dragRef.current = next;
    setDrag(next);
  }

  function startGesture(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    origin.current = { x: event.clientX, y: event.clientY };
    setGesture({ x: 0, y: 0, active: true, lifted: false });
    event.currentTarget.setPointerCapture(event.pointerId);

    holdTimer.current = setTimeout(() => {
      const next = { ...dragRef.current, lifted: true };
      setGesture(next);
      onLiftChange(true);
    }, 420);
  }

  function updateGesture(event: PointerEvent<HTMLElement>) {
    const current = dragRef.current;
    if (!current.active) return;

    const x = event.clientX - origin.current.x;
    const y = event.clientY - origin.current.y;

    if (!current.lifted && Math.abs(y) > 14 && Math.abs(y) > Math.abs(x)) {
      clearHoldTimer();
      setGesture({ x: 0, y: 0, active: false, lifted: false });
      return;
    }

    if (Math.abs(x) > 10 || Math.abs(y) > 10) clearHoldTimer();

    setGesture({
      ...current,
      x: current.lifted ? x : Math.max(-108, Math.min(108, x)),
      y: current.lifted ? y : 0,
    });
  }

  function finishGesture(event: PointerEvent<HTMLElement>) {
    const current = dragRef.current;
    if (!current.active) return;

    clearHoldTimer();
    event.currentTarget.releasePointerCapture(event.pointerId);

    if (current.lifted) {
      const target = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>("[data-timeline-date]");
      const targetDate = target?.dataset.timelineDate;

      if (targetDate && targetDate !== occurrence.dueDate) {
        onScheduleMove(occurrence, targetDate);
      }

      setGesture({ x: 0, y: 0, active: false, lifted: false });
      onLiftChange(false);
      return;
    }

    if (current.x < -72) {
      onTogglePaid(occurrence);
    } else if (current.x > 72) {
      router.push(`/expenses/${occurrence.template.id}`);
    }

    setGesture({ x: 0, y: 0, active: false, lifted: false });
    onLiftChange(false);
  }

  function cancelGesture(event: PointerEvent<HTMLElement>) {
    clearHoldTimer();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setGesture({ x: 0, y: 0, active: false, lifted: false });
    onLiftChange(false);
  }

  return (
    <div
      className={`relative overflow-visible rounded-2xl ${drag.lifted ? "z-30" : ""}`}
    >
      <div
        aria-hidden="true"
        className={`absolute inset-0 grid grid-cols-2 rounded-2xl text-xs font-semibold transition-opacity ${
          swipingLeft || swipingRight ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="flex items-center gap-1 rounded-l-2xl bg-orange-400/20 px-4 text-orange-100 ring-1 ring-orange-300/20">
          <Pencil size={16} />
          Editar
        </div>
        <div className="flex items-center justify-end gap-1 rounded-r-2xl bg-lime-300/20 px-4 text-lime-100 ring-1 ring-lime-200/20">
          <RotateCcw size={16} />
          {paid ? "Pendiente" : "Pagado"}
        </div>
      </div>

      <article
        onPointerDown={startGesture}
        onPointerMove={updateGesture}
        onPointerUp={finishGesture}
        onPointerCancel={cancelGesture}
        style={{
          transform: `translate3d(${drag.x}px, ${drag.y}px, 0) scale(${
            drag.lifted ? 1.035 : 1
          })`,
        }}
        className={`grid min-h-14 touch-pan-y select-none grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border px-3 py-2.5 backdrop-blur-xl transition-[border-radius,box-shadow,opacity,transform,background] duration-200 ease-out ${
          drag.lifted
            ? "border-lime-200/50 bg-slate-900/95 shadow-[0_0_46px_rgba(132,204,22,0.36),0_26px_70px_rgba(0,0,0,0.58)]"
            : paid
              ? "border-white/10 bg-white/[0.045] opacity-70"
              : "border-white/12 bg-white/[0.13] shadow-[0_12px_34px_rgba(0,0,0,0.26)] ring-1 ring-white/8"
        }`}
      >
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              href={`/expenses/${occurrence.template.id}`}
              className={`min-w-0 truncate text-[15px] font-semibold ${
                paid
                  ? "text-slate-300 line-through decoration-slate-400"
                  : "text-white"
              }`}
            >
              {occurrence.template.name}
            </Link>
            {category ? (
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${categoryToneClass(
                  category.tone,
                )}`}
              >
                {category.name}
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
              paid ? "text-lime-200/80" : "text-white"
            }`}
          >
            {statusLabel(occurrence, today)}
          </p>
        </div>
      </article>
    </div>
  );
}
