import { describe, expect, it } from "vitest";
import { markNewExpenseIntentHandled, readNewExpenseIntent } from "./new-expense-intent";

function host(search = "", state: Record<string, unknown> | null = { __NA: true }) {
  const history = {
    state,
    replaceState(next: Record<string, unknown>) {
      history.state = next;
    },
  };
  return { history, location: { search } } as unknown as Pick<Window, "history" | "location">;
}

describe("new expense shortcut", () => {
  it("opens the form or the voice capture once per history entry", () => {
    const form = host();
    expect(readNewExpenseIntent(true, form)).toBe("form");
    markNewExpenseIntentHandled(form);
    expect(readNewExpenseIntent(true, form)).toBeNull();
    // Conserva el estado del router.
    expect(form.history.state).toMatchObject({ __NA: true });

    expect(readNewExpenseIntent(true, host("?mode=voice"))).toBe("voice");
    expect(readNewExpenseIntent(false, host("?mode=voice"))).toBeNull();
  });
});
