"use client";

import { useEffect, useState } from "react";
import { toDateOnly } from "@/domain/calendar";
import {
  createIncomeEvent,
  updateSalarySource,
} from "@/domain/finance";
import { demoStore } from "@/domain/seed";
import type { DraftExpense, ExpenseOccurrence, ExpenseStore } from "@/domain/types";
import { loadExpenseStore, saveExpenseStore } from "@/lib/local-store";
import {
  buildTemplateFromDraft,
  createId,
  findOrCreateCategory,
} from "../lib/expense-actions";

export function useExpenseStore() {
  const [store, setStore] = useState<ExpenseStore>(() => demoStore);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setStore(loadExpenseStore());
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  function persist(nextStore: ExpenseStore) {
    saveExpenseStore(nextStore);
    setStore(nextStore);
  }

  function addExpense(draft: DraftExpense) {
    const categoryResult = findOrCreateCategory(store, draft.categoryName);
    const template = buildTemplateFromDraft(
      draft,
      categoryResult.categoryId,
      toDateOnly(new Date()),
    );

    persist({
      ...categoryResult.store,
      templates: [...categoryResult.store.templates, template],
    });
  }

  function togglePaid(occurrence: ExpenseOccurrence) {
    const existing = occurrence.override;
    const isPaid = occurrence.status === "paid";
    const overrides = isPaid
      ? store.overrides.filter((override) => override.id !== existing?.id)
      : [
          ...store.overrides.filter(
            (override) =>
              !(
                override.templateId === occurrence.template.id &&
                override.occurrenceDate === occurrence.occurrenceDate
              ),
          ),
          {
            id: existing?.id ?? createId("ovr"),
            userId: "demo",
            templateId: occurrence.template.id,
            occurrenceDate: occurrence.occurrenceDate,
            dueDate:
              occurrence.dueDate !== occurrence.occurrenceDate
                ? occurrence.dueDate
                : undefined,
            status: "paid" as const,
            paidAt: new Date().toISOString(),
            amountPaid: occurrence.template.amount,
          },
        ];

    persist({ ...store, overrides });
  }

  function moveOccurrence(
    occurrence: ExpenseOccurrence,
    dueDate: string,
    sortOrder?: number,
  ) {
    const existing = occurrence.override;
    const unchangedDate = dueDate === occurrence.occurrenceDate;
    const nextOverride = {
      id: existing?.id ?? createId("ovr"),
      userId: "demo",
      templateId: occurrence.template.id,
      occurrenceDate: occurrence.occurrenceDate,
      dueDate: unchangedDate ? undefined : dueDate,
      sortOrder,
      status: occurrence.status,
      paidAt: existing?.paidAt,
      amountPaid: existing?.amountPaid,
      note: existing?.note,
    };

    const overrides = [
      ...store.overrides.filter(
        (override) =>
          !(
            override.templateId === occurrence.template.id &&
            override.occurrenceDate === occurrence.occurrenceDate
          ),
      ),
      nextOverride,
    ];

    persist({ ...store, overrides });
  }

  function moveOccurrenceSeries(occurrence: ExpenseOccurrence, dueDate: string) {
    const day = new Date(`${dueDate}T00:00:00`).getDate();

    persist({
      ...store,
      templates: store.templates.map((template) =>
        template.id === occurrence.template.id
          ? {
              ...template,
              dueDay: day,
              updatedAt: new Date().toISOString(),
            }
          : template,
      ),
    });
  }

  function updateSalary(amount: number, dayOfMonth: number) {
    persist({
      ...store,
      finance: {
        ...store.finance,
        incomeSources: updateSalarySource(
          store.finance.incomeSources,
          amount,
          dayOfMonth,
        ),
      },
    });
  }

  function updateSavingsTarget(amount: number) {
    persist({
      ...store,
      finance: {
        ...store.finance,
        allocation: {
          ...store.finance.allocation,
          monthlySavingsTarget: Math.max(Number(amount), 0),
        },
      },
    });
  }

  function updateAllocationNames(input: {
    sabadellAccountName: string;
    bbvaSavingsAccountName: string;
    bbvaMainAccountName: string;
  }) {
    persist({
      ...store,
      finance: {
        ...store.finance,
        allocation: {
          ...store.finance.allocation,
          sabadellAccountName:
            input.sabadellAccountName.trim() || "Sabadell gastos",
          bbvaSavingsAccountName:
            input.bbvaSavingsAccountName.trim() || "BBVA ahorro",
          bbvaMainAccountName:
            input.bbvaMainAccountName.trim() || "BBVA principal",
        },
      },
    });
  }

  function addIncomeEvent(input: {
    name: string;
    amount: number;
    receivedAt: string;
    note?: string;
  }) {
    persist({
      ...store,
      finance: {
        ...store.finance,
        incomeEvents: [
          createIncomeEvent(input),
          ...store.finance.incomeEvents,
        ],
      },
    });
  }

  return {
    store,
    persist,
    addExpense,
    togglePaid,
    moveOccurrence,
    moveOccurrenceSeries,
    updateSalary,
    updateSavingsTarget,
    updateAllocationNames,
    addIncomeEvent,
  };
}
