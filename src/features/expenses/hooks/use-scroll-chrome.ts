"use client";

import { useEffect, useRef, useState } from "react";
import {
  createInitialScrollChromeState,
  reduceScrollChromeState,
  type ScrollChromeState,
} from "../lib/scroll-chrome-state";

export function useScrollChrome() {
  const [chromeState, setChromeState] = useState<ScrollChromeState>(() =>
    createInitialScrollChromeState(),
  );
  const stateRef = useRef(chromeState);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    function updateChrome() {
      const viewport = window.visualViewport;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const viewportOffsetTop = viewport?.offsetTop ?? 0;
      const header = document.querySelector<HTMLElement>("[data-app-chrome]");
      const headerHeight = header?.getBoundingClientRect().height ?? 96;
      const todaySection = document.querySelector<HTMLElement>(
        '[data-section-id="today"]',
      );
      const nextState = reduceScrollChromeState(stateRef.current, {
        scrollY: window.scrollY,
        viewportHeight,
        viewportWidth: window.innerWidth,
        documentHeight: document.documentElement.scrollHeight,
        headerHeight,
        todayTop: todaySection?.getBoundingClientRect().top ?? Infinity,
      });

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

      stateRef.current = nextState;
      setChromeState(nextState);
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

  return {
    compactHeader: chromeState.compactHeader,
    showBottomBar: chromeState.showBottomBar,
  };
}
