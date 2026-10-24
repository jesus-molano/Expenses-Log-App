import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { emptyFinanceStore } from "@/domain/finance";
import type { FinanceStore } from "@/domain/types";
import { recordSalaryReceiptInStore } from "@/stores/app/store-commands";
import { emptyStore } from "@/domain/seed";
import { useSalaryPrompt } from "../hooks/use-salary-prompt";
import { SalaryPromptCard } from "./SalaryPromptCard";

const initialFinance: FinanceStore = {
  ...emptyFinanceStore,
  monthlySalary: {
    "2026-01": { amount: 2000, dayOfMonth: 28, updatedAt: "2026-01-01T00:00:00.000Z" },
  },
  salaryExtraPays: {
    "2026-01": { months: [12], updatedAt: "2026-01-01T00:00:00.000Z" },
  },
};

function Harness({ now }: { now: Date }) {
  const [finance, setFinance] = useState(initialFinance);
  const prompt = useSalaryPrompt({
    finance,
    now,
    language: "es",
    recordSalaryReceipt: (input) =>
      setFinance(
        (current) => recordSalaryReceiptInStore({ ...emptyStore, finance: current }, input).finance,
      ),
  });
  if (!prompt.prompt) return <p>Sin pregunta</p>;
  return (
    <SalaryPromptCard
      prompt={prompt.prompt}
      editing={prompt.editing}
      amountText={prompt.amountText}
      language="es"
      onConfirm={prompt.confirm}
      onStartOther={prompt.startOther}
      onCancelOther={prompt.cancelOther}
      onAmountTextChange={prompt.setAmountText}
      onSaveOther={prompt.saveOther}
      onDismiss={prompt.dismiss}
    />
  );
}

describe("SalaryPromptCard", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("asks on payday and disappears once answered", () => {
    render(<Harness now={new Date("2026-10-28T10:00:00")} />);

    const card = screen.getByRole("region", { name: "¿Has cobrado la nómina de octubre?" });
    expect(card).toHaveTextContent(/Previsto: 2\.?000,00/);
    fireEvent.click(within(card).getByRole("button", { name: "Sí, cobrada" }));

    expect(screen.getByText("Sin pregunta")).toBeInTheDocument();
  });

  it("mentions the extra pay and saves another amount", () => {
    render(<Harness now={new Date("2026-12-28T10:00:00")} />);

    const card = screen.getByRole("region", { name: "¿Has cobrado la nómina de diciembre?" });
    expect(card).toHaveTextContent(/4\.?000,00.*con la paga extra/);
    fireEvent.click(within(card).getByRole("button", { name: "Otro importe" }));
    fireEvent.change(within(card).getByLabelText("Importe cobrado"), {
      target: { value: "3950" },
    });
    fireEvent.submit(within(card).getByRole("button", { name: "Guardar" }));

    expect(screen.getByText("Sin pregunta")).toBeInTheDocument();
  });

  it("hides with 'Aún no'", () => {
    render(<Harness now={new Date("2026-10-28T10:00:00")} />);

    fireEvent.click(screen.getByRole("button", { name: "Aún no" }));

    expect(screen.getByText("Sin pregunta")).toBeInTheDocument();
    expect(window.localStorage.getItem("salary-prompt-dismissed:2026-10")).toBe("2026-10-28");
  });
});
