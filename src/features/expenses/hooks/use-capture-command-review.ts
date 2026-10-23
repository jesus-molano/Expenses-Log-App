"use client";

import { useMemo, useState } from "react";
import {
  resolveCaptureCommand,
  type CaptureCommand,
  type ResolvedCaptureCommand,
} from "@/domain/capture-commands";
import type { AppLanguage, ExpenseStore } from "@/domain/types";
import { formatMoneyInput, parseMoneyInput } from "@/shared/money";
import type { ConfirmedCaptureCommand } from "@/stores/app/capture-command-actions";

type MoveScope = NonNullable<ConfirmedCaptureCommand["scope"]>;

type Entry = {
  id: string;
  command: CaptureCommand;
  // Serie elegida a mano (si el nombre no se encontró o era ambiguo).
  templateId: string | null;
  // Importe pagado editado; null mientras no se toca.
  amountText: string | null;
  scope: MoveScope;
  excluded: boolean;
};

export type CommandReviewItem = {
  id: string;
  resolved: ResolvedCaptureCommand;
  amountText: string;
  amount: number | null;
  scope: MoveScope;
  // Se puede aplicar (sin problemas y con un importe válido).
  applicable: boolean;
  included: boolean;
};

// Revisión de las órdenes de una captura: cada una se resuelve contra el
// store al vuelo, y el usuario puede elegir la serie, corregir lo pagado,
// decidir si un cambio de día afecta a los siguientes o descartarla.
export function useCaptureCommandReview({
  commands,
  store,
  today,
  monthId,
  language,
}: {
  commands: CaptureCommand[];
  store: ExpenseStore;
  today: string;
  monthId: string;
  language: AppLanguage;
}) {
  const [entries, setEntries] = useState<Entry[]>(() =>
    commands.map((command, index) => ({
      id: `command-${index}`,
      command,
      templateId: null,
      amountText: null,
      scope: "single",
      excluded: false,
    })),
  );

  const items = useMemo(
    () =>
      entries.map((entry): CommandReviewItem => {
        // undefined: sin tocar; null: escrito pero ilegible (no se aplica).
        const editedAmount =
          entry.amountText === null ? undefined : parseMoneyInput(entry.amountText);
        const command =
          typeof editedAmount === "number"
            ? { ...entry.command, amount: editedAmount }
            : entry.command;
        const resolved = resolveCaptureCommand(command, store, {
          today,
          monthId,
          language,
          templateId: entry.templateId,
        });
        const amountText =
          entry.amountText ??
          (resolved.amount !== null ? formatMoneyInput(resolved.amount, language) : "");
        const amount =
          command.intent === "pay" && editedAmount !== null ? resolved.amount : null;
        const amountValid = command.intent !== "pay" || (amount !== null && amount > 0);
        const applicable = resolved.issue === null && amountValid;
        return {
          id: entry.id,
          resolved,
          amountText,
          amount,
          scope: entry.scope,
          applicable,
          included: applicable && !entry.excluded,
        };
      }),
    [entries, store, today, monthId, language],
  );

  function update(id: string, patch: Partial<Entry>) {
    setEntries((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    );
  }

  const confirmed: ConfirmedCaptureCommand[] = items
    .filter((item) => item.included)
    .map((item) => ({ resolved: item.resolved, amount: item.amount, scope: item.scope }));

  return {
    items,
    confirmed,
    chooseTemplate: (id: string, templateId: string) =>
      update(id, { templateId, excluded: false }),
    setAmountText: (id: string, amountText: string) => update(id, { amountText }),
    setScope: (id: string, scope: MoveScope) => update(id, { scope }),
    toggle: (id: string) =>
      setEntries((current) =>
        current.map((entry) =>
          entry.id === id ? { ...entry, excluded: !entry.excluded } : entry,
        ),
      ),
  };
}
