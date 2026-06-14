import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SelectMenu } from "./SelectMenu";

function SelectMenuHarness() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("one");

  return (
    <SelectMenu
      open={open}
      onOpenChange={setOpen}
      value={value}
      onChange={setValue}
      options={[
        { value: "one", label: "One" },
        { value: "two", label: "Two" },
        { value: "three", label: "Three" },
      ]}
    />
  );
}

describe("SelectMenu", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not select on pointer down and closes after click selection", () => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });

    render(<SelectMenuHarness />);
    fireEvent.click(screen.getByRole("button", { name: "One" }));

    const option = screen.getByRole("option", { name: "Two" });
    fireEvent.pointerDown(option);

    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "One" })).toBeInTheDocument();

    fireEvent.click(option);

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Two" })).toBeInTheDocument();
  });
});
