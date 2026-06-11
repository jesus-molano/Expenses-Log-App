"use client";

import { useEffect, useRef } from "react";
import type { TimelineSection } from "../lib/timeline";

export function useTimelineInitialFocus(
  sections: TimelineSection[],
  today: string,
) {
  const focusRef = useRef<HTMLElement | null>(null);
  const didFocusTimeline = useRef(false);
  const overdueIndex = sections.findIndex((section) => section.id === "overdue");
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
    if (didFocusTimeline.current || !focusRef.current) return;
    didFocusTimeline.current = true;

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
  }, [sections]);

  return { focusIndex, focusRef };
}
