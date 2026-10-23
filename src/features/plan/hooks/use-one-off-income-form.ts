"use client";

import { type FormEvent, useState } from "react";
import { parseMoneyInput } from "@/shared/money";

type UseOneOffIncomeFormOptions = {
  today: string;
  onAddIncome: (income: {
    name: string;
    amount: number;
    receivedAt: string;
  }) => void;
};

export function useOneOffIncomeForm({
  today,
  onAddIncome,
}: UseOneOffIncomeFormOptions) {
  const [extraName, setExtraName] = useState("Bizum");
  const [extraAmount, setExtraAmount] = useState("");

  function saveExtra(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = parseMoneyInput(extraAmount);
    if (amount === null || amount <= 0) return;

    onAddIncome({
      name: extraName,
      amount,
      receivedAt: today,
    });
    setExtraName("Bizum");
    setExtraAmount("");
  }

  return {
    extraName,
    extraAmount,
    setExtraName,
    setExtraAmount,
    saveExtra,
  };
}
