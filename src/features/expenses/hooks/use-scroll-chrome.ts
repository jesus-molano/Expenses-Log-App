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
      const viewport = window.visualViewport;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const viewportOffsetTop = viewport?.offsetTop ?? 0;
      const nearBottom =
        viewportHeight + currentY >= document.documentElement.scrollHeight - 96;
      const header = document.querySelector<HTMLElement>("[data-app-chrome]");
      const headerHeight = header?.getBoundingClientRect().height ?? 96;
      const todaySection = document.querySelector<HTMLElement>(
        '[data-section-id="today"]',
      );
      const todayTop = todaySection?.getBoundingClientRect().top ?? Infinity;
      const todayAnchored =
        todayTop >= headerHeight + 28 && todayTop <= headerHeight + 128;
      const atTop = currentY < 20;

      document.documentElement.style.setProperty(
        "--app-viewport-height",
        `${viewportHeight}px`,
      );
      document.documentElement.style.setProperty(
        "--app-viewport-offset-top",
        `${viewportOffsetTop}px`,
      );
      document.documentElement.style.setProperty(
        "--app-header-height",
        `${headerHeight}px`,
      );

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
    window.visualViewport?.addEventListener("resize", scheduleUpdate);
    window.visualViewport?.addEventListener("scroll", scheduleUpdate);

    return () => {
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      window.visualViewport?.removeEventListener("resize", scheduleUpdate);
      window.visualViewport?.removeEventListener("scroll", scheduleUpdate);
    };
  }, []);

  return { compactHeader, showBottomBar };
}
