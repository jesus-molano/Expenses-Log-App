import { describe, expect, it } from "vitest";
import {
  createInitialScrollChromeState,
  reduceScrollChromeState,
} from "./scroll-chrome-state";

const baseSnapshot = {
  viewportHeight: 800,
  viewportWidth: 390,
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

  it("shows bottom bar and expands header when scrolling up", () => {
    const previous = {
      ...createInitialScrollChromeState(),
      showBottomBar: false,
      compactHeader: true,
      lastScrollY: 500,
    };
    const state = reduceScrollChromeState(previous, {
      ...baseSnapshot,
      scrollY: 460,
    });

    expect(state.showBottomBar).toBe(true);
    expect(state.compactHeader).toBe(false);
  });

  it("keeps the header expanded on desktop", () => {
    const state = reduceScrollChromeState(createInitialScrollChromeState(), {
      ...baseSnapshot,
      viewportWidth: 1280,
      scrollY: 300,
    });

    expect(state.compactHeader).toBe(false);
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

  it("expands the header near the bottom like the bottom bar", () => {
    const previous = {
      ...createInitialScrollChromeState(),
      compactHeader: true,
      showBottomBar: false,
      lastScrollY: 1300,
    };
    const state = reduceScrollChromeState(previous, {
      ...baseSnapshot,
      scrollY: 1510,
    });

    expect(state.nearBottom).toBe(true);
    expect(state.showBottomBar).toBe(true);
    expect(state.compactHeader).toBe(false);
  });
});
