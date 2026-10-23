"use client";

import { useMemo } from "react";
import {
  resolveReminderPreferences,
  toggledTemplateReminder,
} from "@/domain/reminder-schedule";
import type {
  AppLanguage,
  ExpenseOccurrence,
  ExpenseReminderSettings,
  ExpenseStore,
} from "@/domain/types";
import { t } from "@/shared/i18n";
import type { RowReminderControls } from "../components/row/RowReminderContext";
import { bellToggleMessage } from "../lib/reminder-labels";
import type { ActionToastState } from "./use-action-toast";

type UseReminderBellOptions = {
  store: ExpenseStore;
  language: AppLanguage;
  setTemplateReminder: (
    templateId: string,
    reminder: ExpenseReminderSettings | undefined,
  ) => void;
  showToast: (toast: Omit<ActionToastState, "id">) => void;
  dismissToast: () => void;
};

function pushPermissionGranted() {
  return typeof Notification !== "undefined" && Notification.permission === "granted";
}

// La campana de las filas: cambia el aviso del gasto y lo confirma con un
// aviso que permite deshacerlo (vuelve al ajuste anterior, también "por
// defecto").
export function useReminderBell({
  store,
  language,
  setTemplateReminder,
  showToast,
  dismissToast,
}: UseReminderBellOptions): RowReminderControls {
  const preferences = useMemo(() => resolveReminderPreferences(store), [store]);

  function onToggle(occurrence: ExpenseOccurrence) {
    const template = store.templates.find((item) => item.id === occurrence.template.id);
    if (!template) return;
    const previous = template.reminder;
    const next = toggledTemplateReminder(template, preferences);

    setTemplateReminder(template.id, next);
    showToast({
      message: bellToggleMessage({
        name: template.name,
        reminder: next,
        pushActive: pushPermissionGranted(),
        language,
      }),
      actionLabel: t("common.undo", language),
      onAction: () => {
        setTemplateReminder(template.id, previous);
        dismissToast();
      },
    });
  }

  return { preferences, onToggle };
}
