import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveExpenseStore } from "@/data/persistence/local-store";
import { generateStoreOccurrences } from "@/domain/finance";
import { emptyStore } from "@/domain/seed";
import type { ExpenseStore } from "@/domain/types";
import { ExpenseStoreProvider, useExpenseStore } from "./use-expense-store";

vi.mock("@/utils/supabase/client", () => ({
  createClient: () => {
    throw new Error("No Supabase in tests");
  },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

const store: ExpenseStore = {
  ...emptyStore,
  templates: [
    {
      id: "gym",
      userId: "demo",
      name: "Gimnasio",
      description: "",
      amount: 30,
      currency: "EUR",
      categoryId: "cat",
      startDate: "2026-10-12",
      dueDay: 12,
      recurrence: { frequency: "monthly" },
      active: true,
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
    },
  ],
};

describe("useExpenseStore", () => {
  beforeEach(() => {
    window.localStorage.clear();
    saveExpenseStore(store);
  });

  it("applies a command from an older render on top of the latest store", async () => {
    const { result } = renderHook(() => useExpenseStore(), {
      wrapper: ExpenseStoreProvider,
    });
    await waitFor(() => expect(result.current.isHydrated).toBe(true));

    // La acción de un aviso se guardó antes de pagar.
    const staleCloseMonth = result.current.closeMonth;
    const [gym] = generateStoreOccurrences(result.current.store, "2026-10-01", "2026-10-31");
    act(() => result.current.togglePaid(gym));
    act(() => staleCloseMonth("2026-10"));

    const latest = result.current.store;
    expect(latest.overrides).toEqual([
      expect.objectContaining({ templateId: "gym", status: "paid" }),
    ]);
    expect(latest.finance.monthClosures?.["2026-10"]).toBeDefined();
  });
});
