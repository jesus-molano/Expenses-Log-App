"use client";

import { useEffect, useRef, useState } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { toDateOnly } from "@/domain/calendar";
import {
  createIncomeEvent,
  updateSalarySource,
} from "@/domain/finance";
import { emptyStore } from "@/domain/seed";
import type { DraftExpense, ExpenseOccurrence, ExpenseStore } from "@/domain/types";
import { loadCloudStore, saveCloudStore } from "@/lib/cloud-store";
import {
  loadExpenseStore,
  mergeExpenseStores,
  saveExpenseStore,
} from "@/lib/local-store";
import { createClient } from "@/utils/supabase/client";
import {
  buildTemplateFromDraft,
  createId,
  findOrCreateCategory,
} from "../lib/expense-actions";

type SyncStatus = "local" | "syncing" | "synced" | "error";

export function useExpenseStore() {
  const [store, setStore] = useState<ExpenseStore>(() => emptyStore);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("local");
  const [syncMessage, setSyncMessage] = useState("Modo local");
  const supabaseRef = useRef<SupabaseClient | null>(null);
  const userRef = useRef<User | null>(null);
  const hydratedRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    supabaseRef.current = supabase;

    async function hydrate() {
      const localStore = loadExpenseStore();
      if (active) setStore(localStore);

      if (!supabase) {
        hydratedRef.current = true;
        return;
      }

      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!active || !user) {
        hydratedRef.current = true;
        setSyncStatus("local");
        setSyncMessage("Modo local");
        return;
      }

      userRef.current = user;
      setSyncStatus("syncing");
      setSyncMessage("Preparando nube");

      try {
        const cloud = await loadCloudStore(supabase, user);
        if (!active) return;

        const merged = mergeExpenseStores(localStore, cloud.store);
        saveExpenseStore(merged);
        setStore(merged);
        hydratedRef.current = true;

        const saved = await saveCloudStore(supabase, user, merged);
        if (!active) return;
        setSyncStatus("synced");
        setSyncMessage(
          saved.mode === "table"
            ? "Sincronizado en la nube"
            : "Guardado en este dispositivo",
        );
      } catch (error) {
        hydratedRef.current = true;
        setSyncStatus("error");
        setSyncMessage(
          error instanceof Error
            ? error.message
            : "No se pudo sincronizar con la nube.",
        );
      }
    }

    const frame = window.requestAnimationFrame(() => void hydrate());

    return () => {
      active = false;
      window.cancelAnimationFrame(frame);
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, []);

  function persist(nextStore: ExpenseStore) {
    saveExpenseStore(nextStore);
    setStore(nextStore);
    queueCloudSave(nextStore);
  }

  function queueCloudSave(nextStore: ExpenseStore) {
    const supabase = supabaseRef.current;
    const user = userRef.current;
    if (!hydratedRef.current || !supabase || !user) return;

    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      setSyncStatus("syncing");
      setSyncMessage("Guardando cambios");
      void saveCloudStore(supabase, user, nextStore)
        .then((result) => {
          setSyncStatus("synced");
          setSyncMessage(
            result.mode === "table"
              ? "Sincronizado en la nube"
              : "Guardado localmente",
          );
        })
        .catch((error: unknown) => {
          setSyncStatus("error");
          setSyncMessage(
            error instanceof Error
              ? error.message
              : "No se pudo guardar en la nube.",
          );
        });
    }, 350);
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

  function updateMoneySettings(input: {
    salaryAmount: number;
    salaryDay: number;
    savingsTarget: number;
    sabadellAccountName: string;
    bbvaSavingsAccountName: string;
    bbvaMainAccountName: string;
  }) {
    persist({
      ...store,
      finance: {
        ...store.finance,
        incomeSources: updateSalarySource(
          store.finance.incomeSources,
          input.salaryAmount,
          input.salaryDay,
        ),
        allocation: {
          ...store.finance.allocation,
          monthlySavingsTarget: Math.max(Number(input.savingsTarget), 0),
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
    updateMoneySettings,
    addIncomeEvent,
    syncStatus,
    syncMessage,
  };
}
