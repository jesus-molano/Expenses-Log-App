import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BankImportActionPicker } from "./BankImportCandidateControls";

describe("BankImportActionPicker", () => {
  it("hides match action when there are no expenses to link", () => {
    const onChange = vi.fn();

    render(
      <BankImportActionPicker
        action="create"
        canMatch={false}
        language="es"
        onChange={onChange}
      />,
    );

    expect(screen.queryByRole("button", { name: "Vincular" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Crear gasto" }));

    expect(onChange).toHaveBeenCalledWith("create");
  });
});
