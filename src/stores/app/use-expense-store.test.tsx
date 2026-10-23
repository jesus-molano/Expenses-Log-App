import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ExpenseStoreProvider } from "./use-expense-store";

vi.mock("@/utils/supabase/client", () => ({
  createClient: () => null,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

describe("ExpenseStoreProvider", () => {
  it("server-renders the fallback instead of an empty page", () => {
    const html = renderToString(
      <ExpenseStoreProvider fallback={<p>Cargando</p>}>
        <p>App</p>
      </ExpenseStoreProvider>,
    );

    expect(html).toContain("Cargando");
    expect(html).not.toContain("App");
  });

  it("shows the app once local data is hydrated", async () => {
    render(
      <ExpenseStoreProvider fallback={<p>Cargando</p>}>
        <p>App</p>
      </ExpenseStoreProvider>,
    );

    expect(await screen.findByText("App")).toBeInTheDocument();
    expect(screen.queryByText("Cargando")).not.toBeInTheDocument();
  });
});
