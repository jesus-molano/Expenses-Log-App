"use client";

import { flushSync } from "react-dom";

export function useViewTransitionAction() {
  return (action: () => void) => {
    const viewTransitionDocument = document as Document & {
      startViewTransition?: (callback: () => void) => void;
    };
    const supportsViewTransitions =
      typeof viewTransitionDocument.startViewTransition === "function" &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!supportsViewTransitions) {
      action();
      return;
    }

    viewTransitionDocument.startViewTransition?.(() => {
      flushSync(action);
    });
  };
}
