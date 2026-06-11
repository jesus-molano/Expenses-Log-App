import { describe, expect, it } from "vitest";
import {
  createInitialScrollChromeState,
  reduceScrollChromeState,
} from "./scroll-chrome-state";

const baseSnapshot = {
  viewportHeight: 800,
  viewportWidth: 390,
  documentHeight: 2400,
  allowChromeReaction: true,
};

describe("scroll chrome state", () => {
  it("hides bottom bar on downward scroll away from top and bottom", () => {
    const state = reduceScrollChromeState(createInitialScrollChromeState(), {
      ...baseSnapshot,
      scrollY: 300,
    });

    expect(state.bottomChrome).toBe("hidden");
    expect(state.topChrome).toBe("compact");
  });

  it("shows bottom bar and expands header when scrolling up", () => {
    const previous = {
      ...createInitialScrollChromeState(),
      bottomChrome: "hidden" as const,
      topChrome: "compact" as const,
      lastScrollY: 500,
    };
    const state = reduceScrollChromeState(previous, {
      ...baseSnapshot,
      scrollY: 460,
    });

    expect(state.bottomChrome).toBe("visible");
    expect(state.topChrome).toBe("expanded");
  });

  it("keeps the header expanded on desktop", () => {
    const state = reduceScrollChromeState(createInitialScrollChromeState(), {
      ...baseSnapshot,
      viewportWidth: 1280,
      scrollY: 300,
    });

    expect(state.topChrome).toBe("expanded");
  });

  it("keeps chrome expanded and visible for restored or programmatic scroll", () => {
    const state = reduceScrollChromeState(createInitialScrollChromeState(), {
      ...baseSnapshot,
      allowChromeReaction: false,
      scrollY: 300,
    });

    expect(state.bottomChrome).toBe("visible");
    expect(state.topChrome).toBe("expanded");
  });

  it("uses hysteresis around the bottom edge", () => {
    const nearBottom = reduceScrollChromeState(createInitialScrollChromeState(), {
      ...baseSnapshot,
      scrollY: 1510,
    });
    expect(nearBottom.nearBottom).toBe(true);
    expect(nearBottom.bottomChrome).toBe("visible");

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
      topChrome: "compact" as const,
      bottomChrome: "hidden" as const,
      lastScrollY: 1300,
    };
    const state = reduceScrollChromeState(previous, {
      ...baseSnapshot,
      scrollY: 1510,
    });

    expect(state.nearBottom).toBe(true);
    expect(state.bottomChrome).toBe("visible");
    expect(state.topChrome).toBe("expanded");
  });
});
