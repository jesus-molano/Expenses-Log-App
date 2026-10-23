import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseCaptureTextLocally } from "@/domain/parser";
import { useExpenseCaptureFlow } from "./use-expense-capture-flow";
import type { CaptureResult, useQuickExpenseParser } from "./use-quick-expense-parser";

const today = "2026-10-23";

function setup(result: CaptureResult, quickText = "") {
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
    quickText,
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
    ...parseCaptureTextLocally(text, { today }),
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

  it("asks to confirm orders first and then reviews the new expenses", async () => {
    const { hook, parser, respond } = setup(
      captured("marca la luz pagada 71,20 y Netflix 12,99 el 5"),
    );

    act(() => hook.result.current.openCapture());
    act(() => void hook.result.current.analyze());
    await respond();

    expect(hook.result.current.captureOpen).toBe(false);
    expect(hook.result.current.formOpen).toBe(false);
    expect(hook.result.current.isIdle).toBe(false);
    expect(hook.result.current.commandReview).toMatchObject({
      commands: [{ intent: "pay", target: "Luz", amount: 71.2 }],
      drafts: [expect.objectContaining({ draft: expect.objectContaining({ name: "Netflix" }) })],
    });

    act(() => hook.result.current.finishCommands());
    expect(hook.result.current.commandReview).toBeNull();
    expect(hook.result.current.formOpen).toBe(true);
    expect(hook.result.current.draft.name).toBe("Netflix");
    expect(parser.reset).not.toHaveBeenCalled();
  });

  it("clears the capture after orders with no new expenses", async () => {
    const { hook, parser, respond } = setup(captured("salta el gimnasio este mes"));

    act(() => void hook.result.current.analyze());
    await respond();
    act(() => hook.result.current.finishCommands());

    expect(hook.result.current.formOpen).toBe(false);
    expect(hook.result.current.isIdle).toBe(true);
    expect(parser.reset).toHaveBeenCalled();
  });

  it("opens the form with a quick-add draft", () => {
    const { hook } = setup(captured("Netflix 12,99"));
    const draft = { ...parseCaptureTextLocally("Luz 60", { today }).drafts[0].draft, amount: 0 };

    act(() => hook.result.current.openDraftForm(draft));

    expect(hook.result.current.formOpen).toBe(true);
    expect(hook.result.current.draft).toBe(draft);
    expect(hook.result.current.notice).toBeNull();
  });
});

describe("useExpenseCaptureFlow with dictation", () => {
  class FakeRecognition {
    static last: FakeRecognition | null = null;
    lang = "";
    continuous = false;
    interimResults = false;
    maxAlternatives = 1;
    onresult: ((event: unknown) => void) | null = null;
    onerror: ((event: unknown) => void) | null = null;
    onend: (() => void) | null = null;
    start = vi.fn();
    // Por defecto, parar termina en el acto; `slowStop` lo deja pendiente.
    static slowStop = false;
    stop = vi.fn(() => {
      if (!FakeRecognition.slowStop) this.onend?.();
    });
    abort = vi.fn();
    constructor() {
      FakeRecognition.last = this;
    }
    say(transcript: string) {
      this.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript } }] });
    }
  }

  function withRecognizer() {
    vi.stubGlobal("webkitSpeechRecognition", FakeRecognition);
    vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (Linux; Android 15; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36",
    );
  }

  afterEach(() => {
    FakeRecognition.slowStop = false;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("ignores a second mic tap while the last words are still arriving", () => {
    withRecognizer();
    FakeRecognition.slowStop = true;
    const { hook, parser } = setup(captured("Netflix 12,99"));

    act(() => hook.result.current.dictation.toggle());
    const recognition = FakeRecognition.last!;
    act(() => recognition.say("Netflix doce"));
    act(() => hook.result.current.dictation.toggle());
    act(() => hook.result.current.dictation.toggle());
    act(() => recognition.say("Netflix doce noventa y nueve"));
    act(() => recognition.onend?.());

    expect(parser.parse).toHaveBeenCalledTimes(1);
    expect(parser.parse).toHaveBeenCalledWith("Netflix doce noventa y nueve");
  });

  it("analyzes once when Analizar is pressed while the dictation is ending", () => {
    withRecognizer();
    FakeRecognition.slowStop = true;
    const { hook, parser } = setup(captured("Netflix 12,99"));

    act(() => hook.result.current.dictation.toggle());
    const recognition = FakeRecognition.last!;
    act(() => recognition.say("Netflix doce"));
    act(() => hook.result.current.dictation.toggle());
    act(() => hook.result.current.analyze());
    act(() => recognition.say("Netflix doce noventa y nueve"));
    act(() => recognition.onend?.());

    expect(parser.parse).toHaveBeenCalledTimes(1);
    expect(parser.parse).toHaveBeenCalledWith("Netflix doce noventa y nueve");
  });

  it("adds what is dictated after what was typed", () => {
    withRecognizer();
    const { hook, parser } = setup(captured("Seguro del coche 420"), "Seguro del coche");

    act(() => hook.result.current.dictation.toggle());
    act(() => FakeRecognition.last!.say("420 al año"));

    expect(parser.setQuickText).toHaveBeenLastCalledWith("Seguro del coche 420 al año");
  });

  it("analyzes the typed text when Analizar ends a dictation that heard nothing", () => {
    withRecognizer();
    const { hook, parser } = setup(captured("Netflix 12,99"), "Netflix 12,99");

    act(() => hook.result.current.dictation.toggle());
    act(() => hook.result.current.analyze());

    expect(parser.parse).toHaveBeenCalledTimes(1);
    expect(parser.parse).toHaveBeenCalledWith("Netflix 12,99");
  });

  it("does not analyze when the dictation is stopped with nothing heard", () => {
    withRecognizer();
    const { hook, parser } = setup(captured("Netflix 12,99"), "Netflix 12,99");

    act(() => hook.result.current.dictation.toggle());
    act(() => hook.result.current.dictation.toggle());

    expect(parser.parse).not.toHaveBeenCalled();
  });
});
