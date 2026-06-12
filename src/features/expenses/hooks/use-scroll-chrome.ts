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
  const hasScrollBaselineRef = useRef(false);
  const hasUserScrollIntentRef = useRef(false);

  useEffect(() => {
    function updateChrome() {
      const viewport = window.visualViewport;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const viewportOffsetTop = viewport?.offsetTop ?? 0;
      const header = document.querySelector<HTMLElement>("[data-app-chrome]");
      const headerHeight = header?.getBoundingClientRect().height ?? 96;
      const isChromeLockedByDrag =
        document.documentElement.classList.contains("is-dragging-expense") ||
        document.documentElement.classList.contains("is-settling-expense-drag");
      const snapshot = {
        scrollY: window.scrollY,
        viewportHeight,
        viewportWidth: window.innerWidth,
        documentHeight: document.documentElement.scrollHeight,
        allowChromeReaction:
          hasUserScrollIntentRef.current && !isChromeLockedByDrag,
      };
      const nextState = hasScrollBaselineRef.current
        ? isChromeLockedByDrag
          ? {
              ...stateRef.current,
              panelChrome: "visible" as const,
              lastScrollY: snapshot.scrollY,
              direction: "idle" as const,
              intentDistance: 0,
            }
          : reduceScrollChromeState(stateRef.current, snapshot)
        : {
            ...stateRef.current,
            panelChrome: "visible" as const,
            lastScrollY: snapshot.scrollY,
            direction: "idle" as const,
          };

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

      hasScrollBaselineRef.current = true;
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
    const markUserScrollIntent = () => {
      hasUserScrollIntentRef.current = true;
    };
    const markKeyboardScrollIntent = (event: KeyboardEvent) => {
      if (
        [
          "ArrowDown",
          "ArrowUp",
          "PageDown",
          "PageUp",
          "Home",
          "End",
          " ",
        ].includes(event.key)
      ) {
        hasUserScrollIntentRef.current = true;
      }
    };

    window.addEventListener("wheel", markUserScrollIntent, { passive: true });
    window.addEventListener("touchmove", markUserScrollIntent, {
      passive: true,
    });
    window.addEventListener("keydown", markKeyboardScrollIntent);
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    window.visualViewport?.addEventListener("resize", scheduleUpdate);
    window.visualViewport?.addEventListener("scroll", scheduleUpdate);

    return () => {
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
      window.removeEventListener("wheel", markUserScrollIntent);
      window.removeEventListener("touchmove", markUserScrollIntent);
      window.removeEventListener("keydown", markKeyboardScrollIntent);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      window.visualViewport?.removeEventListener("resize", scheduleUpdate);
      window.visualViewport?.removeEventListener("scroll", scheduleUpdate);
    };
  }, []);

  return {
    panelChrome: chromeState.panelChrome,
  };
}
