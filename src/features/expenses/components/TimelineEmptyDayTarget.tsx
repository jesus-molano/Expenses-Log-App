"use client";

import { useDroppable } from "@dnd-kit/core";
import { format, parseISO } from "date-fns";
import type { Locale } from "date-fns";

type TimelineEmptyDayTargetProps = {
  date: string;
  active: boolean;
  locale: Locale;
};

export function TimelineEmptyDayTarget({
  date,
  active,
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
      data-active={active}
      className="app-day-drop-target relative flex min-h-16 animate-[fade-in_220ms_ease-out] items-center rounded-[var(--app-radius-md)] px-4 py-3 text-xs font-medium"
    >
      <div className="flex w-full items-center justify-between gap-3">
        <span className="capitalize">
          {format(parseISO(date), "EEEE d", { locale })}
        </span>
      </div>
    </div>
  );
}
