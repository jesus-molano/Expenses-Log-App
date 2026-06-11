"use client";

import type { DragMoveEvent } from "@dnd-kit/core";
import {
  getAutoScrollDelta,
  getAutoScrollDirection,
} from "../lib/dnd-auto-scroll";

export function useExpenseDndAutoScroll() {
  return (event: DragMoveEvent) => {
    const translated = event.active.rect.current.translated;
    if (!translated) return;

    const direction = getAutoScrollDirection({
      pointerY: translated.top + translated.height / 2,
      viewportHeight: window.innerHeight,
    });
    const delta = getAutoScrollDelta(direction);
    if (delta) window.scrollBy({ top: delta, behavior: "auto" });
  };
}
