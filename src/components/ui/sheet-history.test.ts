import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Entry = { state: Record<string, unknown> | null };

// Historial falso: go() es asíncrono y dispara un solo popstate, como el real.
function installFakeHistory(initial: Entry[] = [{ state: null }], index = initial.length - 1) {
  const fake = {
    entries: initial.map((entry) => ({ ...entry })),
    index,
    scrollRestoration: "auto" as ScrollRestoration,
    get state() {
      return this.entries[this.index].state;
    },
    pushState(state: Record<string, unknown>) {
      this.entries.splice(this.index + 1);
      this.entries.push({ state });
      this.index += 1;
    },
    replaceState(state: Record<string, unknown>) {
      this.entries[this.index] = { state };
    },
    go(delta: number) {
      const target = this.index + delta;
      if (target < 0 || target >= this.entries.length) return;
      setTimeout(() => {
        this.index = target;
        window.dispatchEvent(new PopStateEvent("popstate", { state: this.state }));
      });
    },
    back() {
      this.go(-1);
    },
  };
  Object.defineProperty(window, "history", { configurable: true, value: fake });
  return fake;
}

async function settle() {
  for (let step = 0; step < 6; step += 1) await new Promise((resolve) => setTimeout(resolve, 0));
}

async function load() {
  vi.resetModules();
  return import("./sheet-history");
}

const originalHistory = window.history;

describe("sheet history", () => {
  let fake: ReturnType<typeof installFakeHistory>;
  // Cada test carga el módulo de nuevo; el oyente de popstate del anterior se
  // quita para que no intervenga.
  const listeners: EventListenerOrEventListenerObject[] = [];

  beforeEach(() => {
    fake = installFakeHistory();
    const add = window.addEventListener.bind(window);
    vi.spyOn(window, "addEventListener").mockImplementation(((
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ) => {
      if (type === "popstate") listeners.push(listener);
      add(type, listener, options);
    }) as typeof window.addEventListener);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    listeners.splice(0).forEach((listener) => window.removeEventListener("popstate", listener));
    Object.defineProperty(window, "history", { configurable: true, value: originalHistory });
  });

  it("adds an entry while open and removes it when closed from the sheet", async () => {
    const { registerHistoryLayer } = await load();

    const unregister = registerHistoryLayer(vi.fn());
    expect(fake.index).toBe(1);
    expect(fake.scrollRestoration).toBe("manual");

    unregister();
    await settle();
    expect(fake.index).toBe(0);
    expect(fake.scrollRestoration).toBe("auto");
  });

  it("closes only the top layer on Back", async () => {
    const { registerHistoryLayer } = await load();
    const closeSheet = vi.fn();
    const closePicker = vi.fn();

    registerHistoryLayer(closeSheet);
    registerHistoryLayer(closePicker);
    expect(fake.index).toBe(2);

    fake.back();
    await settle();
    expect(closePicker).toHaveBeenCalledTimes(1);
    expect(closeSheet).not.toHaveBeenCalled();
    expect(fake.index).toBe(1);
  });

  it("undoes layers closed together with one step back", async () => {
    const { registerHistoryLayer } = await load();
    const go = vi.spyOn(fake, "go");

    const unregisterSheet = registerHistoryLayer(vi.fn());
    const unregisterPicker = registerHistoryLayer(vi.fn());
    unregisterPicker();
    unregisterSheet();
    await settle();

    expect(go).toHaveBeenCalledTimes(1);
    expect(go).toHaveBeenCalledWith(-2);
    expect(fake.index).toBe(0);
  });

  it("waits for a closing sheet before adding the next one (capture → form)", async () => {
    const { registerHistoryLayer } = await load();
    const closeForm = vi.fn();

    const unregisterCapture = registerHistoryLayer(vi.fn());
    unregisterCapture();
    registerHistoryLayer(closeForm);
    await settle();

    expect(fake.index).toBe(1);
    expect(fake.entries).toHaveLength(2);
    fake.back();
    await settle();
    expect(closeForm).toHaveBeenCalledTimes(1);
  });

  it("survives a remount in the same tick (StrictMode)", async () => {
    const { registerHistoryLayer } = await load();
    const close = vi.fn();

    const first = registerHistoryLayer(close);
    first();
    registerHistoryLayer(close);
    await settle();

    expect(fake.index).toBe(1);
    expect(fake.entries).toHaveLength(2);
  });

  it("does not go back when a navigation replaced the entry", async () => {
    const { registerHistoryLayer } = await load();
    const go = vi.spyOn(fake, "go");

    const unregister = registerHistoryLayer(vi.fn());
    fake.pushState({ page: "/login" });
    unregister();
    await settle();

    expect(go).not.toHaveBeenCalled();
    expect(fake.index).toBe(2);
  });

  it("skips a layer entry that no longer has a sheet", async () => {
    const { registerHistoryLayer } = await load();

    const unregister = registerHistoryLayer(vi.fn());
    fake.pushState({ page: "/login" });
    unregister();
    await settle();

    // Atrás desde /login cae en la entrada de la hoja ya cerrada: se salta.
    fake.back();
    await settle();
    expect(fake.index).toBe(0);
  });

  it("reuses the current layer entry after a reload", async () => {
    fake = installFakeHistory([{ state: null }, { state: { __sheet: "sheet-9" } }]);
    const { registerHistoryLayer } = await load();
    const close = vi.fn();

    registerHistoryLayer(close);
    expect(fake.entries).toHaveLength(2);
    expect(fake.index).toBe(1);

    fake.back();
    await settle();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("steps off orphan layer entries when the app starts on one", async () => {
    fake = installFakeHistory([
      { state: null },
      { state: { __sheet: "sheet-3" } },
      { state: { __sheet: "sheet-4" } },
    ]);
    const { skipOrphanLayerEntry } = await load();

    skipOrphanLayerEntry();
    await settle();

    expect(fake.index).toBe(0);
    expect(fake.scrollRestoration).toBe("auto");
  });

  it("stops waiting for a step back that never happens", async () => {
    vi.useFakeTimers();
    fake = installFakeHistory([{ state: { __sheet: "sheet-1" } }], 0);
    const { registerHistoryLayer, skipOrphanLayerEntry } = await load();

    skipOrphanLayerEntry();
    registerHistoryLayer(vi.fn());
    expect(fake.entries).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(2_000);

    expect(fake.entries).toHaveLength(2);
    vi.useRealTimers();
  });

  it("restores scroll on the page entry after leaving with a sheet open", async () => {
    const { registerHistoryLayer } = await load();

    const unregister = registerHistoryLayer(vi.fn());
    fake.replaceState({ page: "/login" });
    unregister();
    await settle();
    fake.scrollRestoration = "manual";

    fake.back();
    await settle();
    expect(fake.index).toBe(0);
    expect(fake.scrollRestoration).toBe("auto");
  });
});

