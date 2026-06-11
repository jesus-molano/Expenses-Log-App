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
  it("hides the top panel on downward mobile scroll away from edges", () => {
    const state = reduceScrollChromeState(createInitialScrollChromeState(), {
      ...baseSnapshot,
      scrollY: 300,
    });

    expect(state.panelChrome).toBe("hidden");
  });

  it("waits for accumulated scroll intent before hiding the panel", () => {
    const firstSmallScroll = reduceScrollChromeState(
      createInitialScrollChromeState(),
      {
        ...baseSnapshot,
        scrollY: 10,
      },
    );
    expect(firstSmallScroll.panelChrome).toBe("visible");

    const secondSmallScroll = reduceScrollChromeState(firstSmallScroll, {
      ...baseSnapshot,
      scrollY: 18,
    });
    expect(secondSmallScroll.panelChrome).toBe("visible");

    const thirdSmallScroll = reduceScrollChromeState(secondSmallScroll, {
      ...baseSnapshot,
      scrollY: 30,
    });
    expect(thirdSmallScroll.panelChrome).toBe("visible");

    const fourthSmallScroll = reduceScrollChromeState(thirdSmallScroll, {
      ...baseSnapshot,
      scrollY: 46,
    });
    expect(fourthSmallScroll.panelChrome).toBe("hidden");
  });

  it("shows the top panel when scrolling up", () => {
    const previous = {
      ...createInitialScrollChromeState(),
      panelChrome: "hidden" as const,
      lastScrollY: 500,
    };
    const state = reduceScrollChromeState(previous, {
      ...baseSnapshot,
      scrollY: 460,
    });

    expect(state.panelChrome).toBe("visible");
  });

  it("keeps the top panel visible on desktop", () => {
    const state = reduceScrollChromeState(createInitialScrollChromeState(), {
      ...baseSnapshot,
      viewportWidth: 1280,
      scrollY: 300,
    });

    expect(state.panelChrome).toBe("visible");
  });

  it("keeps chrome visible for restored or programmatic scroll", () => {
    const state = reduceScrollChromeState(createInitialScrollChromeState(), {
      ...baseSnapshot,
      allowChromeReaction: false,
      scrollY: 300,
    });

    expect(state.panelChrome).toBe("visible");
  });

  it("uses hysteresis around the bottom edge", () => {
    const nearBottom = reduceScrollChromeState(createInitialScrollChromeState(), {
      ...baseSnapshot,
      scrollY: 1510,
    });
    expect(nearBottom.nearBottom).toBe(true);
    expect(nearBottom.panelChrome).toBe("visible");

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

  it("keeps chrome stable when a short scroll immediately approaches the bottom", () => {
    const state = reduceScrollChromeState(createInitialScrollChromeState(), {
      ...baseSnapshot,
      documentHeight: 980,
      viewportHeight: 800,
      scrollY: 60,
    });

    expect(state.nearBottom).toBe(false);
    expect(state.panelChrome).toBe("visible");
    expect(state.intentDistance).toBe(0);
  });
});
