import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { parseExpenseTextLocally } from "@/domain/parser";
import { useExpenseCaptureFlow } from "./use-expense-capture-flow";
import type { CaptureResult, useQuickExpenseParser } from "./use-quick-expense-parser";

const today = "2026-10-23";

function setup(result: CaptureResult) {
  let resolveParse: (value: CaptureResult) => void = () => undefined;
  const parser = {
    parse: vi.fn(
      () =>
        new Promise<CaptureResult>((resolve) => {
          resolveParse = resolve;
        }),
    ),
    cancel: vi.fn(),
    reset: vi.fn(),
    setQuickText: vi.fn(),
  } as unknown as ReturnType<typeof useQuickExpenseParser>;
  const addExpense = vi.fn();
  const addExpenses = vi.fn();
  const hook = renderHook(() =>
    useExpenseCaptureFlow({ parser, language: "es", initialFormOpen: false, addExpense, addExpenses }),
  );
  return {
    hook,
    parser,
    addExpense,
    addExpenses,
    respond: async () => {
      await act(async () => resolveParse(result));
    },
  };
}

function captured(text: string, provider: CaptureResult["provider"] = "gemini"): CaptureResult {
  return {
    drafts: parseExpenseTextLocally(text, { today }),
    provider,
    reason: provider === "local" ? "unauthenticated" : null,
  };
}

describe("useExpenseCaptureFlow", () => {
  it("ignores an answer that arrives after cancelling", async () => {
    const { hook, parser, respond } = setup(captured("Netflix 12,99 el 5"));

    act(() => hook.result.current.openCapture());
    act(() => void hook.result.current.analyze());
    act(() => hook.result.current.cancelAnalysis());
    await respond();

    expect(parser.cancel).toHaveBeenCalled();
    expect(hook.result.current.captureOpen).toBe(true);
    expect(hook.result.current.formOpen).toBe(false);
  });

  it("keeps the manual form when the AI answers late", async () => {
    const { hook, respond } = setup(captured("Netflix 12,99 el 5"));

    act(() => hook.result.current.openCapture());
    act(() => void hook.result.current.analyze());
    act(() => hook.result.current.openManualForm());
    const manualKey = hook.result.current.formKey;
    await respond();

    expect(hook.result.current.formKey).toBe(manualKey);
    expect(hook.result.current.draft.name).toBe("");
    expect(hook.result.current.reviewItems).toBeNull();
  });

  it("keeps the review selection while one item is edited", async () => {
    const { hook, addExpense, addExpenses, respond } = setup(
      captured("Tidal 10,99 y Dropbox 11,99 y Deezer 9,99"),
    );

    act(() => void hook.result.current.analyze());
    await respond();
    const [tidal, dropbox, deezer] = hook.result.current.reviewItems!;

    act(() => hook.result.current.toggleReviewItem(tidal.id));
    act(() => hook.result.current.editReviewItem(dropbox.id));
    expect(hook.result.current.reviewItems).toBeNull();
    act(() => hook.result.current.saveForm(dropbox.draft));

    expect(addExpense).toHaveBeenCalledWith(dropbox.draft, undefined);
    expect(hook.result.current.reviewItems!.map((item) => item.id)).toEqual([tidal.id, deezer.id]);
    expect(hook.result.current.excludedIds.has(tidal.id)).toBe(true);

    act(() => hook.result.current.setReviewStatus("paid"));
    act(() => hook.result.current.saveReviewed());

    expect(addExpenses).toHaveBeenCalledWith([deezer.draft], { initialStatus: "paid" });
    expect(hook.result.current.reviewItems).toBeNull();
  });

  it("tells why the local parser was used", async () => {
    const { hook, respond } = setup(captured("Netflix 12,99 el 5", "local"));

    act(() => void hook.result.current.analyze());
    await respond();

    expect(hook.result.current.formOpen).toBe(true);
    expect(hook.result.current.notice).toBe("unauthenticated");
  });
});
