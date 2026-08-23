import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ErrorView from "./error";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("application error boundary", () => {
  it("logs diagnostics without exposing the error to the user", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const reset = vi.fn();

    render(<ErrorView error={new Error("secret database detail")} reset={reset} />);

    expect(screen.queryByText("secret database detail")).not.toBeInTheDocument();
    expect(screen.getByText(/Tus datos guardados/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(reset).toHaveBeenCalledOnce();
    await waitFor(() => expect(consoleError).toHaveBeenCalled());
  });
});
