export type ScrollChromeSnapshot = {
  scrollY: number;
  viewportHeight: number;
  viewportWidth?: number;
  documentHeight: number;
  allowChromeReaction?: boolean;
};

export type ScrollDirection = "up" | "down" | "idle";
export type PanelChromeState = "visible" | "hidden";

export type ScrollChromeState = {
  panelChrome: PanelChromeState;
  nearBottom: boolean;
  lastScrollY: number;
  direction: ScrollDirection;
  intentDistance: number;
};

export const SCROLL_CHROME_THRESHOLDS = {
  pageEdge: 20,
  reactionDistance: 28,
  mobileMaxWidth: 1023,
  nearBottomEnter: 96,
  nearBottomExit: 220,
};

export function createInitialScrollChromeState(): ScrollChromeState {
  return {
    panelChrome: "visible",
    nearBottom: false,
    lastScrollY: 0,
    direction: "idle",
    intentDistance: 0,
  };
}

export function reduceScrollChromeState(
  previous: ScrollChromeState,
  snapshot: ScrollChromeSnapshot,
): ScrollChromeState {
  const delta = snapshot.scrollY - previous.lastScrollY;
  const distanceFromBottom =
    snapshot.documentHeight - (snapshot.viewportHeight + snapshot.scrollY);
  const nearBottom =
    distanceFromBottom <= SCROLL_CHROME_THRESHOLDS.nearBottomEnter ||
    (previous.nearBottom &&
      distanceFromBottom <= SCROLL_CHROME_THRESHOLDS.nearBottomExit);
  const approachingBottom =
    distanceFromBottom <= SCROLL_CHROME_THRESHOLDS.nearBottomExit;
  const atPageTop = snapshot.scrollY < SCROLL_CHROME_THRESHOLDS.pageEdge;
  const isMobileChrome =
    (snapshot.viewportWidth ?? SCROLL_CHROME_THRESHOLDS.mobileMaxWidth) <=
    SCROLL_CHROME_THRESHOLDS.mobileMaxWidth;
  const canReactToScroll = Boolean(snapshot.allowChromeReaction);
  const isPinnedByPageEdge =
    atPageTop || approachingBottom || !canReactToScroll || !isMobileChrome;
  const intentDistance = isPinnedByPageEdge
    ? 0
    : getNextIntentDistance(previous.intentDistance, delta);
  const direction = getScrollDirection(intentDistance);
  const panelChrome = reducePanelChrome(previous, {
    isPinnedByPageEdge,
    direction,
  });
  const nextIntentDistance =
    panelChrome !== previous.panelChrome ? 0 : intentDistance;

  return {
    panelChrome,
    nearBottom,
    lastScrollY: snapshot.scrollY,
    direction,
    intentDistance: nextIntentDistance,
  };
}

function getNextIntentDistance(previousDistance: number, delta: number) {
  if (delta > 0) {
    return Math.max(0, previousDistance) + delta;
  }

  if (delta < 0) {
    return Math.min(0, previousDistance) + delta;
  }

  return previousDistance;
}

function getScrollDirection(intentDistance: number): ScrollDirection {
  if (intentDistance >= SCROLL_CHROME_THRESHOLDS.reactionDistance) {
    return "down";
  }

  if (intentDistance <= -SCROLL_CHROME_THRESHOLDS.reactionDistance) {
    return "up";
  }

  return "idle";
}

function reducePanelChrome(
  previous: ScrollChromeState,
  context: {
    direction: ScrollDirection;
    isPinnedByPageEdge: boolean;
  },
): PanelChromeState {
  if (context.isPinnedByPageEdge) {
    return "visible";
  }

  if (context.direction === "down") return "hidden";
  if (context.direction === "up") return "visible";
  return previous.panelChrome;
}
