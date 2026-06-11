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
      className={`relative flex min-h-16 animate-[fade-in_220ms_ease-out] items-center rounded-2xl border px-4 py-3 text-xs font-medium transition ${
        active
          ? "border-lime-200/80 bg-lime-300/16 text-white shadow-[0_0_32px_rgba(132,204,22,0.32)]"
          : "border-dashed border-white/12 bg-white/[0.024] text-slate-400"
      }`}
    >
      {active ? (
        <span className="absolute inset-x-4 -top-1 h-1 rounded-full bg-lime-200 shadow-[0_0_18px_rgba(190,242,100,0.9)]" />
      ) : null}
      <div className="flex w-full items-center justify-between gap-3">
        <span className="capitalize">
          {format(parseISO(date), "EEEE d", { locale })}
        </span>
        {active ? (
          <span className="text-[11px] font-semibold text-lime-100">
            {label}
          </span>
        ) : null}
      </div>
    </div>
  );
}
