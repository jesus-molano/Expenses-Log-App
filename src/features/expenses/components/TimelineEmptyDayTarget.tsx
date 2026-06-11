"use client";

import { useDroppable } from "@dnd-kit/core";
import { format, parseISO } from "date-fns";
import type { Locale } from "date-fns";

type TimelineEmptyDayTargetProps = {
  date: string;
  active: boolean;
  label: string;
  locale: Locale;
};

export function TimelineEmptyDayTarget({
  date,
  active,
  label,
  locale,
}: TimelineEmptyDayTargetProps) {
  const { setNodeRef } = useDroppable({
    id: `day:${date}`,
    data: { date, type: "day" },
  });

  return (
    <div
      ref={setNodeRef}
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
        {format(parseISO(date), "EEEE d", { locale })}
      </span>
      {active ? (
        <span className="float-right text-[11px] font-semibold text-lime-100">
          {label}
        </span>
      ) : null}
    </div>
  );
}
