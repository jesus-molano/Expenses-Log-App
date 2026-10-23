import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { ChoiceGroup } from "./ChoiceGroup";

function Harness() {
  const [value, setValue] = useState<"month" | "from" | "never">("from");
  return (
    <ChoiceGroup
      label="¿A qué meses afecta?"
      hint="Pista"
      value={value}
      options={[
        { value: "month", label: "Solo este mes" },
        { value: "from", label: "Desde este mes", description: "Y los siguientes" },
        { value: "never", label: "Nunca" },
      ]}
      onChange={setValue}
    />
  );
}

describe("ChoiceGroup", () => {
  it("behaves as a radio group with one tab stop", () => {
    render(<Harness />);

    const group = screen.getByRole("radiogroup", { name: "¿A qué meses afecta?" });
    expect(group).toHaveAccessibleDescription("Pista");
    const selected = screen.getByRole("radio", { checked: true });
    expect(selected).toHaveTextContent("Desde este mes");
    expect(selected).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("radio", { name: "Nunca" })).toHaveAttribute("tabindex", "-1");

    fireEvent.click(screen.getByRole("radio", { name: "Solo este mes" }));
    expect(screen.getByRole("radio", { name: "Solo este mes" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("moves the selection and the focus with the arrow keys, wrapping around", () => {
    render(<Harness />);

    fireEvent.keyDown(screen.getByRole("radio", { checked: true }), { key: "ArrowRight" });
    expect(screen.getByRole("radio", { name: "Nunca" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Nunca" })).toHaveFocus();

    fireEvent.keyDown(screen.getByRole("radio", { name: "Nunca" }), { key: "ArrowDown" });
    expect(screen.getByRole("radio", { name: "Solo este mes" })).toHaveFocus();

    fireEvent.keyDown(screen.getByRole("radio", { name: "Solo este mes" }), { key: "ArrowLeft" });
    expect(screen.getByRole("radio", { name: "Nunca" })).toHaveAttribute("aria-checked", "true");
  });
});
