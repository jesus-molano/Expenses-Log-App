import { act, renderHook } from "@testing-library/react";
import type { FormEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { emptyFinanceStore } from "@/domain/finance";
import type { FinanceStore } from "@/domain/types";
import { summarizeAccounts } from "../lib/account-summary";
import { useAccountEditor } from "./use-account-editor";
import { useBalanceCheckinForm } from "./use-balance-checkin-form";

const submitEvent = { preventDefault: vi.fn() } as unknown as FormEvent<HTMLFormElement>;
const at = "2026-10-01T10:00:00.000Z";

const finance: FinanceStore = {
  ...emptyFinanceStore,
  balanceCheckins: { "2026-10-20": { amount: 1250.4, updatedAt: at } },
  balanceAccounts: {
    savings: { name: "Ahorro", role: "savings", order: 1, createdAt: at, updatedAt: at },
    spending: { name: "BBVA", role: "spending", order: 2, createdAt: at, updatedAt: at },
  },
  accountCheckins: { "savings:2026-10-23": { amount: 5000, updatedAt: at } },
};
const summaries = summarizeAccounts(finance);

describe("useBalanceCheckinForm", () => {
  function setup() {
    const onRecord = vi.fn();
    const hook = renderHook(() =>
      useBalanceCheckinForm({ summaries, today: "2026-10-23", language: "es", onRecord }),
    );
    return { ...hook, onRecord };
  }

  it("opens on an account with its latest balance and records it for that account", () => {
    const { result, onRecord } = setup();

    act(() => result.current.openForm("primary"));
    expect(result.current).toMatchObject({
      formOpen: true,
      accountId: "primary",
      date: "2026-10-23",
      amountText: "1250,4",
      replacesEntry: false,
    });

    act(() => result.current.setAmountText("-35"));
    act(() => result.current.submit(submitEvent));
    expect(onRecord).toHaveBeenCalledWith({ accountId: "primary", date: "2026-10-23", amount: -35 });
    expect(result.current.formOpen).toBe(false);
  });

  it("refills the amount when switching account unless it was edited", () => {
    const { result } = setup();

    act(() => result.current.openForm("primary"));
    act(() => result.current.selectAccount("savings"));
    expect(result.current).toMatchObject({
      accountId: "savings",
      amountText: "5000",
      // Ese día ya hay un saldo del ahorro.
      replacesEntry: true,
    });

    act(() => result.current.setAmountText("5100"));
    act(() => result.current.selectAccount("spending"));
    expect(result.current).toMatchObject({ accountId: "spending", amountText: "5100" });
  });

  it("keeps the form open when the amount cannot be read", () => {
    const { result, onRecord } = setup();

    act(() => result.current.openForm("spending"));
    expect(result.current.amountText).toBe("");
    act(() => result.current.submit(submitEvent));
    expect(onRecord).not.toHaveBeenCalled();
    expect(result.current.formOpen).toBe(true);
  });
});

describe("useAccountEditor", () => {
  function setup(items = summaries) {
    const onAdd = vi.fn();
    const onUpdate = vi.fn();
    const onDelete = vi.fn();
    const hook = renderHook(() => useAccountEditor({ summaries: items, onAdd, onUpdate, onDelete }));
    return { ...hook, onAdd, onUpdate, onDelete };
  }

  it("suggests a bills account first and a spending one once there is a bills account", () => {
    const empty = setup([]);
    act(() => empty.result.current.openAdd());
    expect(empty.result.current).toMatchObject({ open: true, isNew: true, role: "bills", name: "" });

    const { result, onAdd } = setup();
    act(() => result.current.openAdd());
    expect(result.current.role).toBe("spending");
    act(() => result.current.setName("Revolut"));
    act(() => result.current.setRole("savings"));
    act(() => result.current.submit(submitEvent));
    expect(onAdd).toHaveBeenCalledWith({ name: "Revolut", role: "savings" });
    expect(result.current.open).toBe(false);
  });

  it("edits the name and role of an account", () => {
    const { result, onUpdate } = setup();

    act(() => result.current.openEdit("primary"));
    expect(result.current).toMatchObject({ isNew: false, name: "", role: "bills" });
    expect(result.current.editing?.account.id).toBe("primary");
    act(() => result.current.setName("Sabadell"));
    act(() => result.current.submit(submitEvent));
    expect(onUpdate).toHaveBeenCalledWith("primary", { name: "Sabadell", role: "bills" });
  });

  it("asks before deleting and closes everything after", () => {
    const { result, onDelete } = setup();

    act(() => result.current.openEdit("savings"));
    act(() => result.current.requestDelete());
    expect(result.current.confirmingDelete).toBe(true);
    act(() => result.current.cancelDelete());
    expect(result.current.confirmingDelete).toBe(false);
    expect(onDelete).not.toHaveBeenCalled();

    act(() => result.current.requestDelete());
    act(() => result.current.confirmDelete());
    expect(onDelete).toHaveBeenCalledWith(summaries[1]);
    expect(result.current).toMatchObject({ open: false, confirmingDelete: false });
  });
});
