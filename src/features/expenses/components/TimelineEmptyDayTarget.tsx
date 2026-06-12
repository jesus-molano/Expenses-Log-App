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
      data-active={active}
      className="app-day-drop-target relative flex min-h-16 animate-[fade-in_220ms_ease-out] items-center rounded-[var(--app-radius-md)] px-4 py-3 text-xs font-medium"
    >
      {active ? (
        <span className="app-day-drop-indicator absolute inset-x-4 -top-1 h-1 rounded-full" />
      ) : null}
      <div className="flex w-full items-center justify-between gap-3">
        <span className="capitalize">
          {format(parseISO(date), "EEEE d", { locale })}
        </span>
        {active ? (
          <span className="text-[11px] font-semibold text-[var(--app-accent)]">
            {label}
          </span>
        ) : null}
      </div>
    </div>
  );
}
