import { act, renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useOnlineStatus } from "./use-online-status";

afterEach(() => {
  vi.restoreAllMocks();
});

function mockOnLine(initial: boolean) {
  let online = initial;
  vi.spyOn(navigator, "onLine", "get").mockImplementation(() => online);
  return (next: boolean) => {
    online = next;
    window.dispatchEvent(new Event(next ? "online" : "offline"));
  };
}

function OnlineProbe() {
  return <span>{useOnlineStatus() ? "online" : "offline"}</span>;
}

describe("useOnlineStatus", () => {
  it("reads the current connection state", () => {
    mockOnLine(false);
    const { result } = renderHook(() => useOnlineStatus());

    expect(result.current).toBe(false);
  });

  it("follows the offline and online events", () => {
    const setOnline = mockOnLine(true);
    const { result } = renderHook(() => useOnlineStatus());

    act(() => setOnline(false));
    expect(result.current).toBe(false);

    act(() => setOnline(true));
    expect(result.current).toBe(true);
  });

  it("assumes a connection when rendering on the server", () => {
    mockOnLine(false);

    expect(renderToString(<OnlineProbe />)).toContain("online");
  });

  it("stops listening when unmounted", () => {
    mockOnLine(true);
    const removeListener = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => useOnlineStatus());

    unmount();

    expect(removeListener).toHaveBeenCalledWith("online", expect.any(Function));
    expect(removeListener).toHaveBeenCalledWith("offline", expect.any(Function));
  });
});
