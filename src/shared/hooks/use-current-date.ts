"use client";

import { useEffect, useState } from "react";

const MIDNIGHT_MARGIN_MS = 50;

export function millisecondsUntilNextDay(now: Date) {
  const nextDay = new Date(now);
  nextDay.setHours(24, 0, 0, MIDNIGHT_MARGIN_MS);
  return Math.max(nextDay.getTime() - now.getTime(), MIDNIGHT_MARGIN_MS);
}

export function useCurrentDate() {
  const [currentDate, setCurrentDate] = useState(() => new Date());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const scheduleRefresh = (now: Date) => {
      clearTimeout(timer);
      timer = setTimeout(refresh, millisecondsUntilNextDay(now));
    };
    const refresh = () => {
      const now = new Date();
      setCurrentDate(now);
      scheduleRefresh(now);
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };

    scheduleRefresh(new Date());
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

  return currentDate;
}
