"use client";

import { useEffect, useRef } from "react";
import type { TimelineSection } from "../lib/timeline";

// Enfoca la sección relevante al abrir y cada vez que cambia el día. Con
// `enabled` a false (hay algo arriba que no debe quedar tapado) ese día no se
// desplaza.
export function useTimelineInitialFocus(
  sections: TimelineSection[],
  today: string,
  enabled = true,
) {
  const focusRef = useRef<HTMLElement | null>(null);
  const focusedDay = useRef<string | null>(null);
  const overdueIndex = sections.findIndex(
    (section) =>
      section.id === "overdue" || section.id.startsWith("carry-over-"),
  );
  const todayIndex = sections.findIndex((section) => section.id === "today");
  const nextRelevantIndex = sections.findIndex(
    (section) => section.anchorDate >= today && section.tone !== "paid",
  );
  const focusIndex =
    overdueIndex >= 0
      ? overdueIndex
      : todayIndex >= 0
        ? todayIndex
        : Math.max(0, nextRelevantIndex);

  useEffect(() => {
    if (focusedDay.current === today || !focusRef.current) return;
    focusedDay.current = today;
    if (!enabled) return;

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (!focusRef.current) return;

        const chromeRect = document
          .querySelector<HTMLElement>("[data-app-chrome]")
          ?.getBoundingClientRect();
        const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
        const desiredTop = isDesktop
          ? 58
          : (chromeRect?.bottom ?? 128) + 40;
        const targetTop =
          focusRef.current.getBoundingClientRect().top +
          window.scrollY -
          desiredTop;
        const maxScroll =
          document.documentElement.scrollHeight - window.innerHeight;

        if (maxScroll <= 0) return;

        window.scrollTo({
          top: Math.max(0, Math.min(targetTop, maxScroll)),
          behavior: "auto",
        });
      });
    });
  }, [enabled, sections, today]);

  return { focusIndex, focusRef };
}
