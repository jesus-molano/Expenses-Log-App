import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useScrollChrome } from "./use-scroll-chrome";

function setReadonlyWindowValue<T extends keyof Window>(key: T, value: Window[T]) {
  Object.defineProperty(window, key, {
    configurable: true,
    value,
  });
}

function setScrollY(scrollY: number) {
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    value: scrollY,
  });
}

describe("useScrollChrome", () => {
  beforeEach(() => {
    setReadonlyWindowValue("innerHeight", 800);
    setReadonlyWindowValue("innerWidth", 390);
    setScrollY(0);
    Object.defineProperty(document.documentElement, "scrollHeight", {
      configurable: true,
      value: 2400,
    });
    window.requestAnimationFrame = (callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(performance.now()), 0);
    window.cancelAnimationFrame = (id: number) => window.clearTimeout(id);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.documentElement.classList.remove(
      "is-dragging-expense",
      "is-settling-expense-drag",
    );
    document.body.replaceChildren();
  });

  it("keeps automatic scroll visible until a real scroll intent happens", async () => {
    document.body.innerHTML = '<header data-app-chrome="true"></header>';
    const { result } = renderHook(() => useScrollChrome());

    await waitFor(() => expect(result.current.panelChrome).toBe("visible"));

    act(() => {
      setScrollY(300);
      window.dispatchEvent(new Event("scroll"));
    });

    await waitFor(() => expect(result.current.panelChrome).toBe("visible"));

    act(() => {
      window.dispatchEvent(new WheelEvent("wheel"));
      setScrollY(330);
      window.dispatchEvent(new Event("scroll"));
    });

    await waitFor(() => expect(result.current.panelChrome).toBe("hidden"));
  });

  it("keeps chrome visible while drag settling scrolls the page", async () => {
    document.body.innerHTML = '<header data-app-chrome="true"></header>';
    const { result } = renderHook(() => useScrollChrome());

    await waitFor(() => expect(result.current.panelChrome).toBe("visible"));

    act(() => {
      window.dispatchEvent(new WheelEvent("wheel"));
      document.documentElement.classList.add("is-settling-expense-drag");
      setScrollY(300);
      window.dispatchEvent(new Event("scroll"));
    });

    await waitFor(() => expect(result.current.panelChrome).toBe("visible"));

    act(() => {
      document.documentElement.classList.remove("is-settling-expense-drag");
      setScrollY(340);
      window.dispatchEvent(new Event("scroll"));
    });

    await waitFor(() => expect(result.current.panelChrome).toBe("hidden"));
  });
});
