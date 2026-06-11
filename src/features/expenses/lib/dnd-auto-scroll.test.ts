import { describe, expect, it } from "vitest";
import { getAutoScrollDelta, getAutoScrollDirection } from "./dnd-auto-scroll";

describe("dnd auto scroll", () => {
  it("detects viewport edges", () => {
    expect(getAutoScrollDirection({ pointerY: 20, viewportHeight: 800 })).toBe(
      "up",
    );
    expect(getAutoScrollDirection({ pointerY: 780, viewportHeight: 800 })).toBe(
      "down",
    );
    expect(getAutoScrollDirection({ pointerY: 400, viewportHeight: 800 })).toBeNull();
  });

  it("returns stable deltas", () => {
    expect(getAutoScrollDelta("up")).toBeLessThan(0);
    expect(getAutoScrollDelta("down")).toBeGreaterThan(0);
    expect(getAutoScrollDelta(null)).toBe(0);
  });
});
