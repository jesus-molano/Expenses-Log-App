"use client";

import { useEffect, useRef, useState } from "react";

export function useScrollChrome() {
  const [showBottomBar, setShowBottomBar] = useState(true);
  const [compactHeader, setCompactHeader] = useState(false);
  const lastScrollY = useRef(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    function updateChrome() {
      const currentY = window.scrollY;
      const delta = currentY - lastScrollY.current;
      const nearBottom =
        window.innerHeight + currentY >= document.documentElement.scrollHeight - 96;
      const todaySection = document.querySelector<HTMLElement>(
        '[data-section-id="today"]',
      );
      const todayTop = todaySection?.getBoundingClientRect().top ?? Infinity;
      const todayAnchored = todayTop >= 156 && todayTop <= 250;
      const atTop = currentY < 20;

      setCompactHeader(!atTop && !todayAnchored);

      if (currentY < 80 || nearBottom || delta < -8) {
        setShowBottomBar(true);
      } else if (delta > 8) {
        setShowBottomBar(false);
      }

      lastScrollY.current = currentY;
    }

    function scheduleUpdate() {
      if (frameRef.current) return;

      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null;
        updateChrome();
      });
    }

    scheduleUpdate();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    return () => {
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, []);

  return { compactHeader, showBottomBar };
}
