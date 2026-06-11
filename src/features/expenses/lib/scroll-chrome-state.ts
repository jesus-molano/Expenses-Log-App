export type ScrollChromeSnapshot = {
  scrollY: number;
  viewportHeight: number;
  viewportWidth?: number;
  documentHeight: number;
  headerHeight: number;
  todayTop: number;
  allowHeaderCompact?: boolean;
};

export type ScrollChromeState = {
  showBottomBar: boolean;
  compactHeader: boolean;
  nearBottom: boolean;
  lastScrollY: number;
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
    showBottomBar: true,
    compactHeader: false,
    nearBottom: false,
    lastScrollY: 0,
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
  const atTop = snapshot.scrollY < SCROLL_CHROME_THRESHOLDS.compactTop;
  const isMobileChrome =
    (snapshot.viewportWidth ?? SCROLL_CHROME_THRESHOLDS.mobileMaxWidth) <=
    SCROLL_CHROME_THRESHOLDS.mobileMaxWidth;
  let showBottomBar = previous.showBottomBar;
  if (snapshot.scrollY < SCROLL_CHROME_THRESHOLDS.top || nearBottom) {
    showBottomBar = true;
  } else if (delta <= SCROLL_CHROME_THRESHOLDS.showDelta) {
    showBottomBar = true;
  } else if (delta >= SCROLL_CHROME_THRESHOLDS.hideDelta) {
    showBottomBar = false;
  }

  let compactHeader = previous.compactHeader;
  if (!isMobileChrome || atTop || nearBottom || !snapshot.allowHeaderCompact) {
    compactHeader = false;
  } else if (delta >= SCROLL_CHROME_THRESHOLDS.hideDelta) {
    compactHeader = true;
  } else if (delta <= SCROLL_CHROME_THRESHOLDS.showDelta) {
    compactHeader = false;
  }

  return {
    showBottomBar,
    compactHeader,
    nearBottom,
    lastScrollY: snapshot.scrollY,
  };
}
