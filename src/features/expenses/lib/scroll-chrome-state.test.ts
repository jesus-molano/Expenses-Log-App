import { describe, expect, it } from "vitest";
import {
  createInitialScrollChromeState,
  reduceScrollChromeState,
} from "./scroll-chrome-state";

const baseSnapshot = {
  viewportHeight: 800,
  documentHeight: 2400,
  headerHeight: 140,
  todayTop: 400,
};

describe("scroll chrome state", () => {
  it("hides bottom bar on downward scroll away from top and bottom", () => {
    const state = reduceScrollChromeState(createInitialScrollChromeState(), {
      ...baseSnapshot,
      scrollY: 300,
    });

    expect(state.showBottomBar).toBe(false);
    expect(state.compactHeader).toBe(true);
  });

  it("shows bottom bar when scrolling up", () => {
    const previous = {
      ...createInitialScrollChromeState(),
      showBottomBar: false,
      lastScrollY: 500,
    };
    const state = reduceScrollChromeState(previous, {
      ...baseSnapshot,
      scrollY: 460,
    });

    expect(state.showBottomBar).toBe(true);
  });

  it("uses hysteresis around the bottom edge", () => {
    const nearBottom = reduceScrollChromeState(createInitialScrollChromeState(), {
      ...baseSnapshot,
      scrollY: 1510,
    });
    expect(nearBottom.nearBottom).toBe(true);
    expect(nearBottom.showBottomBar).toBe(true);

    const leavingBottom = reduceScrollChromeState(nearBottom, {
      ...baseSnapshot,
      scrollY: 1385,
    });
    expect(leavingBottom.nearBottom).toBe(true);

    const awayFromBottom = reduceScrollChromeState(leavingBottom, {
      ...baseSnapshot,
      scrollY: 1200,
    });
    expect(awayFromBottom.nearBottom).toBe(false);
  });
});
