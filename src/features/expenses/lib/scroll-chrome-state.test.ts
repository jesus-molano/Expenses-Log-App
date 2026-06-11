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

  it("changes top and bottom together after slow accumulated downward scroll", () => {
    const firstSmallScroll = reduceScrollChromeState(
      createInitialScrollChromeState(),
      {
        ...baseSnapshot,
        scrollY: 10,
      },
    );
    expect(firstSmallScroll.bottomChrome).toBe("visible");
    expect(firstSmallScroll.topChrome).toBe("expanded");

    const secondSmallScroll = reduceScrollChromeState(firstSmallScroll, {
      ...baseSnapshot,
      scrollY: 18,
    });
    expect(secondSmallScroll.bottomChrome).toBe("visible");
    expect(secondSmallScroll.topChrome).toBe("expanded");

    const thirdSmallScroll = reduceScrollChromeState(secondSmallScroll, {
      ...baseSnapshot,
      scrollY: 30,
    });
    expect(thirdSmallScroll.bottomChrome).toBe("visible");
    expect(thirdSmallScroll.topChrome).toBe("expanded");

    const fourthSmallScroll = reduceScrollChromeState(thirdSmallScroll, {
      ...baseSnapshot,
      scrollY: 44,
    });
    expect(fourthSmallScroll.bottomChrome).toBe("hidden");
    expect(fourthSmallScroll.topChrome).toBe("compact");
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

  it("changes top and bottom together after slow accumulated upward scroll", () => {
    const previous = {
      ...createInitialScrollChromeState(),
      bottomChrome: "hidden" as const,
      topChrome: "compact" as const,
      lastScrollY: 500,
    };
    const firstSmallScroll = reduceScrollChromeState(previous, {
      ...baseSnapshot,
      scrollY: 492,
    });
    expect(firstSmallScroll.bottomChrome).toBe("hidden");
    expect(firstSmallScroll.topChrome).toBe("compact");

    const secondSmallScroll = reduceScrollChromeState(firstSmallScroll, {
      ...baseSnapshot,
      scrollY: 484,
    });
    expect(secondSmallScroll.bottomChrome).toBe("hidden");
    expect(secondSmallScroll.topChrome).toBe("compact");

    const thirdSmallScroll = reduceScrollChromeState(secondSmallScroll, {
      ...baseSnapshot,
      scrollY: 476,
    });
    expect(thirdSmallScroll.bottomChrome).toBe("visible");
    expect(thirdSmallScroll.topChrome).toBe("expanded");
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

  it("keeps chrome stable when a short scroll immediately approaches the bottom", () => {
    const state = reduceScrollChromeState(createInitialScrollChromeState(), {
      ...baseSnapshot,
      documentHeight: 980,
      viewportHeight: 800,
      scrollY: 60,
    });

    expect(state.nearBottom).toBe(false);
    expect(state.bottomChrome).toBe("visible");
    expect(state.topChrome).toBe("expanded");
    expect(state.intentDistance).toBe(0);
  });
});
