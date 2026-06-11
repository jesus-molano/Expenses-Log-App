export type ScrollChromeSnapshot = {
  scrollY: number;
  viewportHeight: number;
  viewportWidth?: number;
  documentHeight: number;
  allowChromeReaction?: boolean;
};

export type ScrollDirection = "up" | "down" | "idle";
export type TopChromeState = "expanded" | "compact";
export type BottomChromeState = "visible" | "hidden";

export type ScrollChromeState = {
  topChrome: TopChromeState;
  bottomChrome: BottomChromeState;
  nearBottom: boolean;
  lastScrollY: number;
  direction: ScrollDirection;
};

export const SCROLL_CHROME_THRESHOLDS = {
  top: 80,
  compactTop: 20,
  mobileMaxWidth: 1023,
  showDelta: -10,
  hideDelta: 12,
  nearBottomEnter: 96,
  nearBottomExit: 220,
};

export function createInitialScrollChromeState(): ScrollChromeState {
  return {
    topChrome: "expanded",
    bottomChrome: "visible",
    nearBottom: false,
    lastScrollY: 0,
    direction: "idle",
  };
}

export function reduceScrollChromeState(
  previous: ScrollChromeState,
  snapshot: ScrollChromeSnapshot,
): ScrollChromeState {
  const delta = snapshot.scrollY - previous.lastScrollY;
  const direction = getScrollDirection(delta);
  const distanceFromBottom =
    snapshot.documentHeight - (snapshot.viewportHeight + snapshot.scrollY);
  const nearBottom =
    distanceFromBottom <= SCROLL_CHROME_THRESHOLDS.nearBottomEnter ||
    (previous.nearBottom &&
      distanceFromBottom <= SCROLL_CHROME_THRESHOLDS.nearBottomExit);
  const atTop = snapshot.scrollY < SCROLL_CHROME_THRESHOLDS.compactTop;
  const isMobileChrome =
    (snapshot.viewportWidth ?? SCROLL_CHROME_THRESHOLDS.mobileMaxWidth) <=
    SCROLL_CHROME_THRESHOLDS.mobileMaxWidth;
  const canReactToScroll = Boolean(snapshot.allowChromeReaction);
  const bottomChrome = reduceBottomChrome(previous, {
    atPageTop: snapshot.scrollY < SCROLL_CHROME_THRESHOLDS.top,
    canReactToScroll,
    direction,
    nearBottom,
  });
  const topChrome = reduceTopChrome(previous, {
    atTop,
    canReactToScroll,
    direction,
    isMobileChrome,
    nearBottom,
  });

  return {
    topChrome,
    bottomChrome,
    nearBottom,
    lastScrollY: snapshot.scrollY,
    direction,
  };
}

function getScrollDirection(delta: number): ScrollDirection {
  if (delta >= SCROLL_CHROME_THRESHOLDS.hideDelta) return "down";
  if (delta <= SCROLL_CHROME_THRESHOLDS.showDelta) return "up";
  return "idle";
}

function reduceTopChrome(
  previous: ScrollChromeState,
  context: {
    atTop: boolean;
    canReactToScroll: boolean;
    direction: ScrollDirection;
    isMobileChrome: boolean;
    nearBottom: boolean;
  },
): TopChromeState {
  if (
    !context.isMobileChrome ||
    context.atTop ||
    context.nearBottom ||
    !context.canReactToScroll
  ) {
    return "expanded";
  }

  if (context.direction === "down") return "compact";
  if (context.direction === "up") return "expanded";
  return previous.topChrome;
}

function reduceBottomChrome(
  previous: ScrollChromeState,
  context: {
    atPageTop: boolean;
    canReactToScroll: boolean;
    direction: ScrollDirection;
    nearBottom: boolean;
  },
): BottomChromeState {
  if (context.atPageTop || context.nearBottom || !context.canReactToScroll) {
    return "visible";
  }

  if (context.direction === "down") return "hidden";
  if (context.direction === "up") return "visible";
  return previous.bottomChrome;
}
