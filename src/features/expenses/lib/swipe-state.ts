export type SwipePhase =
  | "idle"
  | "dragging"
  | "revealed-left"
  | "revealed-right"
  | "committing-left"
  | "committing-right";

export type SwipeState = {
  x: number;
  phase: SwipePhase;
  blocked: boolean;
};

export type SwipeThresholds = {
  reveal: number;
  commit: number;
  maxDistance: number;
  verticalTolerance: number;
  horizontalStart: number;
};

export const DEFAULT_SWIPE_THRESHOLDS: SwipeThresholds = {
  reveal: 56,
  commit: 132,
  maxDistance: 156,
  verticalTolerance: 12,
  horizontalStart: 10,
};

export function createSwipeState(): SwipeState {
  return {
    x: 0,
    phase: "idle",
    blocked: false,
  };
}

export function reduceSwipeMove({
  deltaX,
  deltaY,
  thresholds = DEFAULT_SWIPE_THRESHOLDS,
}: {
  deltaX: number;
  deltaY: number;
  thresholds?: SwipeThresholds;
}): SwipeState {
  if (
    Math.abs(deltaY) > thresholds.verticalTolerance &&
    Math.abs(deltaY) > Math.abs(deltaX)
  ) {
    return { x: 0, phase: "idle", blocked: true };
  }

  const x = clamp(deltaX, -thresholds.maxDistance, thresholds.maxDistance);
  const phase =
    x < -thresholds.reveal
      ? "revealed-left"
      : x > thresholds.reveal
        ? "revealed-right"
        : "dragging";

  return { x, phase, blocked: false };
}

export function resolveSwipeRelease(
  state: SwipeState,
  thresholds: SwipeThresholds = DEFAULT_SWIPE_THRESHOLDS,
): {
  nextState: SwipeState;
  commit: "left" | "right" | null;
} {
  if (state.x < -thresholds.commit) {
    return {
      nextState: { x: -thresholds.maxDistance, phase: "committing-left", blocked: false },
      commit: "left",
    };
  }

  if (state.x > thresholds.commit) {
    return {
      nextState: { x: thresholds.maxDistance, phase: "committing-right", blocked: false },
      commit: "right",
    };
  }

  return {
    nextState: createSwipeState(),
    commit: null,
  };
}

export function swipeDirection(phase: SwipePhase): "left" | "right" | null {
  if (phase === "revealed-left" || phase === "committing-left") return "left";
  if (phase === "revealed-right" || phase === "committing-right") return "right";
  return null;
}

export function shouldPreventScroll(
  deltaX: number,
  deltaY: number,
  thresholds: SwipeThresholds = DEFAULT_SWIPE_THRESHOLDS,
) {
  return (
    Math.abs(deltaX) > thresholds.horizontalStart &&
    Math.abs(deltaX) > Math.abs(deltaY)
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
