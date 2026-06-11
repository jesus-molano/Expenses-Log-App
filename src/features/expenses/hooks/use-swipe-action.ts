"use client";

import { type PointerEvent, useRef, useState } from "react";
import {
  DEFAULT_SWIPE_THRESHOLDS,
  createSwipeState,
  reduceSwipeMove,
  resolveSwipeRelease,
  shouldPreventScroll,
  swipeDirection,
  type SwipeState,
} from "../lib/swipe-state";

type SwipeActionOptions = {
  disabled?: boolean;
  revealThreshold?: number;
  commitThreshold?: number;
  maxDistance?: number;
  onCommitLeft: () => void;
  onCommitRight: () => void;
};

export function useSwipeAction({
  disabled = false,
  revealThreshold = DEFAULT_SWIPE_THRESHOLDS.reveal,
  commitThreshold = DEFAULT_SWIPE_THRESHOLDS.commit,
  maxDistance = DEFAULT_SWIPE_THRESHOLDS.maxDistance,
  onCommitLeft,
  onCommitRight,
}: SwipeActionOptions) {
  const thresholds = {
    ...DEFAULT_SWIPE_THRESHOLDS,
    reveal: revealThreshold,
    commit: commitThreshold,
    maxDistance,
  };
  const origin = useRef({ x: 0, y: 0 });
  const stateRef = useRef<SwipeState>(createSwipeState());
  const [state, setState] = useState<SwipeState>(() => createSwipeState());

  function setSwipeState(next: SwipeState) {
    stateRef.current = next;
    setState(next);
  }

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    if (disabled) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    event.currentTarget.setPointerCapture?.(event.pointerId);
    origin.current = { x: event.clientX, y: event.clientY };
    setSwipeState({ x: 0, phase: "dragging", blocked: false });
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    if (disabled) return;
    const current = stateRef.current;
    if (current.phase === "idle" && !current.blocked) return;
    if (current.blocked) return;

    const deltaX = event.clientX - origin.current.x;
    const deltaY = event.clientY - origin.current.y;

    if (shouldPreventScroll(deltaX, deltaY, thresholds)) {
      event.preventDefault();
    }

    setSwipeState(reduceSwipeMove({ deltaX, deltaY, thresholds }));
  }

  function onPointerUp() {
    if (disabled) return;
    const current = stateRef.current;
    if (current.phase === "idle" || current.blocked) {
      setSwipeState(createSwipeState());
      return;
    }

    const { nextState, commit } = resolveSwipeRelease(current, thresholds);
    setSwipeState(nextState);

    if (commit === "left") onCommitLeft();
    if (commit === "right") onCommitRight();

    window.setTimeout(() => {
      setSwipeState(createSwipeState());
    }, 180);
  }

  function onPointerCancel() {
    setSwipeState(createSwipeState());
  }

  return {
    x: state.x,
    phase: state.phase,
    direction: swipeDirection(state.phase),
    swipingLeft: swipeDirection(state.phase) === "left",
    swipingRight: swipeDirection(state.phase) === "right",
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
    },
  };
}
