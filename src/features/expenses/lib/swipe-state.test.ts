import { describe, expect, it } from "vitest";
import {
  createSwipeState,
  reduceSwipeMove,
  resolveSwipeRelease,
  shouldPreventScroll,
  swipeDirection,
} from "./swipe-state";

describe("swipe state", () => {
  it("reveals only one direction", () => {
    const left = reduceSwipeMove({ deltaX: -80, deltaY: 0 });
    const right = reduceSwipeMove({ deltaX: 80, deltaY: 0 });

    expect(left.phase).toBe("revealed-left");
    expect(swipeDirection(left.phase)).toBe("left");
    expect(right.phase).toBe("revealed-right");
    expect(swipeDirection(right.phase)).toBe("right");
  });

  it("requires commit threshold before executing", () => {
    expect(resolveSwipeRelease(reduceSwipeMove({ deltaX: -72, deltaY: 0 })).commit).toBeNull();
    expect(resolveSwipeRelease(reduceSwipeMove({ deltaX: -150, deltaY: 0 })).commit).toBe("left");
    expect(resolveSwipeRelease(reduceSwipeMove({ deltaX: 150, deltaY: 0 })).commit).toBe("right");
  });

  it("blocks horizontal gesture when vertical scroll wins", () => {
    expect(reduceSwipeMove({ deltaX: 10, deltaY: 40 }).blocked).toBe(true);
    expect(shouldPreventScroll(30, 4)).toBe(true);
    expect(shouldPreventScroll(4, 30)).toBe(false);
    expect(createSwipeState().phase).toBe("idle");
  });
});
