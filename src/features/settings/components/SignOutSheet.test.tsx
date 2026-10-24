import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SignOutSheet } from "./SignOutSheet";

function renderSheet(props: Partial<Parameters<typeof SignOutSheet>[0]> = {}) {
  const onSignOut = vi.fn();
  const onClose = vi.fn();
  render(
    <SignOutSheet
      language="es"
      hasPendingChanges={false}
      busy={false}
      onClose={onClose}
      onSignOut={onSignOut}
      {...props}
    />,
  );
  return { onSignOut, onClose };
}

describe("SignOutSheet", () => {
  it("offers to keep or delete the data on this device", () => {
    const { onSignOut } = renderSheet();

    expect(screen.getByRole("dialog", { name: "¿Cerrar sesión?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Salir y conservar los datos aquí" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Salir y borrar los datos de este dispositivo" }),
    );

    expect(onSignOut.mock.calls).toEqual([
      [{ clearLocalData: false }],
      [{ clearLocalData: true }],
    ]);
  });

  it("warns about changes that are not uploaded yet", () => {
    renderSheet({ hasPendingChanges: true });

    expect(screen.getByRole("note")).toHaveTextContent("Hay cambios sin subir");
  });

  it("disables every action while signing out", () => {
    const { onSignOut } = renderSheet({ busy: true });

    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled();
    }
    expect(screen.getByRole("button", { name: "Cerrando sesión..." })).toBeDisabled();
    expect(onSignOut).not.toHaveBeenCalled();
  });
});
