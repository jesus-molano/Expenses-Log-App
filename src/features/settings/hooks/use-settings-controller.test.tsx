import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearDeviceData } from "@/data/persistence/device-data";
import { emptyStore } from "@/domain/seed";
import { t } from "@/shared/i18n";
import { releasePushSubscription } from "../lib/push-notifications";
import { reloadHome } from "./use-settings-auth";
import { useSettingsController } from "./use-settings-controller";

const order: string[] = [];

const supabase = {
  auth: {
    signOut: vi.fn(async () => {
      order.push("sign-out");
      return { error: null };
    }),
  },
};

const expenseStore = {
  store: emptyStore,
  syncStatus: "local",
  syncMessage: "",
  updateTheme: vi.fn(),
  updateLanguage: vi.fn(),
  updateBudgetCycle: vi.fn(),
  updateReminderPreferences: vi.fn(),
  clearExpenses: vi.fn(),
  clearIncome: vi.fn(),
};

const auth = {
  user: null,
  setUser: vi.fn(),
  isSigningOut: false,
  signOut: vi.fn(),
};

vi.mock("@/stores/app/use-expense-store", () => ({
  useExpenseStore: () => expenseStore,
}));

vi.mock("@/utils/supabase/client", () => ({
  createClient: () => supabase,
}));

vi.mock("@/data/persistence/device-data", () => ({
  clearDeviceData: vi.fn(),
}));

vi.mock("../lib/push-notifications", () => ({
  releasePushSubscription: vi.fn(),
}));

vi.mock("./use-settings-auth", () => ({
  useSettingsAuth: () => auth,
  reloadHome: vi.fn(),
}));

vi.mock("./use-notification-settings", () => ({
  useNotificationSettings: () => ({
    notificationState: "default",
    notificationHealth: null,
    notificationsActive: false,
    isTestingNotification: false,
    lastTestSentAt: null,
    enableNotifications: vi.fn(),
    disableNotifications: vi.fn(),
    sendTestNotification: vi.fn(),
    refreshNotificationState: vi.fn(),
  }),
}));

function mockAccountDeletion(ok: boolean) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      order.push("delete-account");
      return { ok } as Response;
    }),
  );
  vi.mocked(releasePushSubscription).mockImplementation(async () => {
    order.push("release-push");
    return "released";
  });
  vi.mocked(clearDeviceData).mockImplementation(async () => {
    await Promise.resolve();
    order.push("clear-device");
  });
  vi.mocked(reloadHome).mockImplementation(() => {
    order.push("reload");
  });
}

afterEach(() => {
  order.length = 0;
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("useSettingsController — delete account", () => {
  it("clears this device's data, automatic copies included, before reloading", async () => {
    mockAccountDeletion(true);
    const { result } = renderHook(() => useSettingsController());

    await act(async () => {
      await result.current.handleDeleteAccount();
    });

    expect(order).toEqual([
      "delete-account",
      "release-push",
      "sign-out",
      "clear-device",
      "reload",
    ]);
    expect(auth.setUser).toHaveBeenCalledWith(null);
  });

  it("keeps the device data when the account could not be deleted", async () => {
    mockAccountDeletion(false);
    const { result } = renderHook(() => useSettingsController());

    await act(async () => {
      await result.current.handleDeleteAccount();
    });

    expect(order).toEqual(["delete-account"]);
    expect(clearDeviceData).not.toHaveBeenCalled();
    expect(reloadHome).not.toHaveBeenCalled();
    expect(result.current.message).toBe(t("settings.deleteAccountError"));
    expect(result.current.isDeletingAccount).toBe(false);
  });
});
