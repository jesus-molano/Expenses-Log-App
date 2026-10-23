import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfirmActionDialog } from "./ConfirmActionDialog";

function renderDialog(props: Partial<React.ComponentProps<typeof ConfirmActionDialog>> = {}) {
  const onCancel = vi.fn();
  const onConfirm = vi.fn();
  render(
    <ConfirmActionDialog
      title="¿Borrar «Netflix»?"
      body="No se puede deshacer."
      cancelLabel="Cancelar"
      confirmLabel="Borrar"
      onCancel={onCancel}
      onConfirm={onConfirm}
      {...props}
    />,
  );
  return { onCancel, onConfirm };
}

describe("ConfirmActionDialog", () => {
  beforeEach(() => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is an alert dialog named by its title and described by its body, over the page", () => {
    renderDialog();
    const dialog = screen.getByRole("alertdialog", { name: "¿Borrar «Netflix»?" });

    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription("No se puede deshacer.");
    // En un portal sobre body, fuera del contenedor del componente.
    expect(dialog.closest(".app-dialog-backdrop")?.parentElement).toBe(document.body);
  });

  it("starts on Cancel and cancels with Escape", () => {
    const { onCancel, onConfirm } = renderDialog();

    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("confirms with the confirm button", () => {
    const { onConfirm } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Borrar" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("cannot be cancelled while the action runs", () => {
    const { onCancel } = renderDialog({ loading: true });

    fireEvent.keyDown(document.body, { key: "Escape" });
    fireEvent.mouseDown(screen.getByRole("alertdialog").parentElement!);
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    expect(screen.getByRole("alertdialog")).toHaveAttribute("aria-busy", "true");
  });

  it("cancels when tapping outside the dialog", () => {
    const { onCancel } = renderDialog();

    fireEvent.mouseDown(screen.getByRole("alertdialog"));
    expect(onCancel).not.toHaveBeenCalled();
    fireEvent.mouseDown(screen.getByRole("alertdialog").parentElement!);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("asks for the phrase before confirming", () => {
    renderDialog({ confirmPhrase: "BORRAR", confirmPhraseLabel: "Escribe BORRAR" });
    const confirm = screen.getByRole("button", { name: "Borrar" });

    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Escribe BORRAR"), { target: { value: "BORRAR" } });
    expect(confirm).toBeEnabled();
  });

  it("uses the danger button only for the danger tone", () => {
    renderDialog({ tone: "default" });

    expect(screen.getByRole("button", { name: "Borrar" })).toHaveClass("app-button-primary");
    expect(screen.getByRole("alertdialog")).toHaveAttribute("data-tone", "default");
  });
});
