import { fireEvent, render, screen } from "@testing-library/react";
import { StrictMode, useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDialogA11y } from "./use-dialog-a11y";

function Dialog({
  label,
  onEscape,
  focusMiddle = false,
}: {
  label: string;
  onEscape?: () => void;
  focusMiddle?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const middleRef = useRef<HTMLButtonElement>(null);
  useDialogA11y({
    panelRef,
    onEscape,
    initialFocusRef: focusMiddle ? middleRef : undefined,
  });

  return (
    <div ref={panelRef} role="dialog" aria-label={label} tabIndex={-1}>
      <button type="button">{label} first</button>
      <button type="button" ref={middleRef}>
        {label} middle
      </button>
      <button type="button" disabled>
        {label} disabled
      </button>
      <button type="button">{label} last</button>
    </div>
  );
}

function Harness({ focusMiddle = false }: { focusMiddle?: boolean }) {
  const [open, setOpen] = useState(false);
  const [nestedOpen, setNestedOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      {open ? (
        <Dialog label="Sheet" focusMiddle={focusMiddle} onEscape={() => setOpen(false)} />
      ) : null}
      {open ? (
        <button type="button" onClick={() => setNestedOpen(true)}>
          Open nested
        </button>
      ) : null}
      {nestedOpen ? <Dialog label="Confirm" onEscape={() => setNestedOpen(false)} /> : null}
    </>
  );
}

// Una hoja cuyo campo de importe se enfoca solo al montar (`autoFocus`).
function AutoFocusDialog({ onEscape }: { onEscape: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogA11y({ panelRef, onEscape });

  return (
    <div ref={panelRef} role="dialog" aria-label="Amount" tabIndex={-1}>
      <button type="button">Close</button>
      <input aria-label="amount" autoFocus />
    </div>
  );
}

function AutoFocusHarness() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      {open ? <AutoFocusDialog onEscape={() => setOpen(false)} /> : null}
    </>
  );
}

function pressKey(key: string, shiftKey = false) {
  fireEvent.keyDown(document.activeElement ?? document.body, { key, shiftKey });
}

describe("useDialogA11y", () => {
  beforeEach(() => {
    // El foco inicial va en el siguiente frame: aquí, en el acto.
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("focuses the first focusable element, or the one asked for", () => {
    const { unmount } = render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByRole("button", { name: "Sheet first" })).toHaveFocus();
    unmount();

    render(<Harness focusMiddle />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByRole("button", { name: "Sheet middle" })).toHaveFocus();
  });

  it("keeps Tab inside the dialog, skipping disabled controls", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    const first = screen.getByRole("button", { name: "Sheet first" });
    const last = screen.getByRole("button", { name: "Sheet last" });

    pressKey("Tab", true);
    expect(last).toHaveFocus();
    pressKey("Tab");
    expect(first).toHaveFocus();

    // Con el foco fuera, Tab lo devuelve al diálogo.
    screen.getByRole("button", { name: "Open" }).focus();
    pressKey("Tab");
    expect(first).toHaveFocus();
  });

  it("closes with Escape and gives the focus back to the opener", () => {
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Open" });
    opener.focus();
    fireEvent.click(opener);
    expect(screen.getByRole("dialog", { name: "Sheet" })).toBeInTheDocument();

    pressKey("Escape");
    expect(screen.queryByRole("dialog", { name: "Sheet" })).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it.each([
    ["", false],
    [" under StrictMode", true],
  ])(
    "keeps an autoFocused field focused and gives the focus back to the opener%s",
    (_label, strict) => {
      render(strict ? <StrictMode><AutoFocusHarness /></StrictMode> : <AutoFocusHarness />);
      const opener = screen.getByRole("button", { name: "Open" });
      opener.focus();
      fireEvent.click(opener);
      expect(screen.getByRole("textbox", { name: "amount" })).toHaveFocus();

      pressKey("Escape");
      expect(screen.queryByRole("dialog", { name: "Amount" })).not.toBeInTheDocument();
      expect(opener).toHaveFocus();
    },
  );

  it("locks the page scroll while open", () => {
    document.body.style.overflow = "auto";
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(document.body.style.overflow).toBe("hidden");

    pressKey("Escape");
    expect(document.body.style.overflow).toBe("auto");
  });

  it("lets only the top dialog handle Escape and Tab", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    const openNested = screen.getByRole("button", { name: "Open nested" });
    openNested.focus();
    fireEvent.click(openNested);
    expect(screen.getByRole("button", { name: "Confirm first" })).toHaveFocus();

    pressKey("Tab", true);
    expect(screen.getByRole("button", { name: "Confirm last" })).toHaveFocus();

    pressKey("Escape");
    expect(screen.queryByRole("dialog", { name: "Confirm" })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Sheet" })).toBeInTheDocument();
    expect(openNested).toHaveFocus();

    pressKey("Escape");
    expect(screen.queryByRole("dialog", { name: "Sheet" })).not.toBeInTheDocument();
  });
});
