import { act, renderHook } from "@testing-library/react";
import type { User } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearDeviceData } from "@/data/persistence/device-data";
import { releasePushSubscription } from "../lib/push-notifications";
import { useSettingsAuth } from "./use-settings-auth";

vi.mock("../lib/push-notifications", () => ({
  releasePushSubscription: vi.fn(),
}));

vi.mock("@/data/persistence/device-data", () => ({
  clearDeviceData: vi.fn(),
}));

const user = { id: "00000000-0000-4000-8000-000000000001" } as User;

function mockSupabase(options: { sessionAfterSignOut?: boolean } = {}) {
  const order: string[] = [];
  vi.mocked(releasePushSubscription).mockImplementation(async () => {
    order.push("release-push");
    return "released";
  });
  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signOut: vi.fn(async () => {
        order.push("sign-out");
        return { error: null };
      }),
      getSession: vi.fn().mockResolvedValue({
        data: { session: options.sessionAfterSignOut ? { user } : null },
      }),
    },
  };
  return { supabase, order };
}

function renderAuth(
  supabase: ReturnType<typeof mockSupabase>["supabase"],
  reload = vi.fn(),
) {
  const setMessage = vi.fn();
  const hook = renderHook(() =>
    useSettingsAuth(supabase as never, setMessage, { reload }),
  );
  return { ...hook, setMessage, reload };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("useSettingsAuth", () => {
  it("releases this browser's push subscription before signing out", async () => {
    const { supabase, order } = mockSupabase();
    const { result, setMessage, reload } = renderAuth(supabase);

    let signedOut = false;
    await act(async () => {
      signedOut = await result.current.signOut({ clearLocalData: false });
    });

    expect(signedOut).toBe(true);
    expect(order).toEqual(["release-push", "sign-out"]);
    expect(clearDeviceData).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    expect(result.current.user).toBeNull();
    expect(result.current.isSigningOut).toBe(false);
    expect(setMessage).toHaveBeenCalledWith(
      "Sesión cerrada. La app sigue disponible en este dispositivo.",
    );
  });

  it("clears the device data and reloads when asked to", async () => {
    const { supabase, order } = mockSupabase();
    // Las copias de IndexedDB se borran antes de recargar, no a medias.
    vi.mocked(clearDeviceData).mockImplementation(async () => {
      await Promise.resolve();
      order.push("clear-device");
    });
    const reload = vi.fn(() => order.push("reload"));
    const { result } = renderAuth(supabase, reload);

    await act(async () => {
      await result.current.signOut({ clearLocalData: true });
    });

    expect(order).toEqual(["release-push", "sign-out", "clear-device", "reload"]);
    expect(clearDeviceData).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);
    // Sigue ocupado mientras recarga.
    expect(result.current.isSigningOut).toBe(true);
  });

  it("keeps the data and reports an error if the session is still there", async () => {
    const { supabase } = mockSupabase({ sessionAfterSignOut: true });
    const { result, setMessage, reload } = renderAuth(supabase);

    let signedOut = true;
    await act(async () => {
      signedOut = await result.current.signOut({ clearLocalData: true });
    });

    expect(signedOut).toBe(false);
    expect(clearDeviceData).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    expect(result.current.isSigningOut).toBe(false);
    expect(setMessage).toHaveBeenCalledWith(
      "No se pudo cerrar la sesión. Inténtalo de nuevo.",
    );
  });

  it("ignores a second tap while signing out", async () => {
    const { supabase } = mockSupabase();
    const { result } = renderAuth(supabase);

    await act(async () => {
      await Promise.all([
        result.current.signOut({ clearLocalData: false }),
        result.current.signOut({ clearLocalData: false }),
      ]);
    });

    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
  });
});
