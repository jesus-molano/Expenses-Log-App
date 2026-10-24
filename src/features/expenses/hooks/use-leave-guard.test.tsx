import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLeaveGuard } from "./use-leave-guard";

const router = { back: vi.fn(), replace: vi.fn() };

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

function setNavigation(navigation: { canGoBack: boolean } | undefined) {
  Object.defineProperty(window, "navigation", {
    value: navigation,
    configurable: true,
    writable: true,
  });
}

// Sale sin cambios pendientes con el control de volver y deja correr los
// plazos (el de las capas del historial y el de respaldo de Atrás).
function leaveWithControl() {
  const { result } = renderHook(() => useLeaveGuard(false));
  act(() => result.current.requestLeave());
  act(() => {
    vi.advanceTimersByTime(0);
  });
  act(() => {
    vi.advanceTimersByTime(1_000);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  router.back.mockReset();
  router.replace.mockReset();
});

afterEach(() => {
  setNavigation(undefined);
  vi.useRealTimers();
});

describe("useLeaveGuard", () => {
  it("goes to the list in place when the detail was opened from a direct link", () => {
    // Sin entrada anterior del mismo origen, Atrás saldría de la app.
    setNavigation({ canGoBack: false });

    leaveWithControl();

    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledExactlyOnceWith("/");
  });

  it("goes back to the previous app entry when there is one", () => {
    setNavigation({ canGoBack: true });
    router.back.mockImplementation(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    leaveWithControl();

    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("without the Navigation API, goes to the list when Back does not leave the page", () => {
    setNavigation(undefined);

    leaveWithControl();

    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledExactlyOnceWith("/");
  });

  it("without the Navigation API, stays on the page Back went to", () => {
    setNavigation(undefined);
    router.back.mockImplementation(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    leaveWithControl();

    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });
});
