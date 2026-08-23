import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { millisecondsUntilNextDay, useCurrentDate } from "./use-current-date";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useCurrentDate", () => {
  it("calculates the next local day boundary", () => {
    const now = new Date(2026, 7, 23, 23, 59, 59, 900);
    expect(millisecondsUntilNextDay(now)).toBe(150);
  });

  it("refreshes the date after local midnight", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 23, 23, 59, 59, 900));
    const { result } = renderHook(() => useCurrentDate());

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current.getDate()).toBe(24);
  });

  it("refreshes when the app becomes visible again", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 23, 12));
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    const { result } = renderHook(() => useCurrentDate());

    vi.setSystemTime(new Date(2026, 7, 24, 12));
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(result.current.getDate()).toBe(24);
  });
});
