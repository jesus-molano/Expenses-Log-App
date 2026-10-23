"use client";

import { Bell, BellRing } from "lucide-react";
import type { AppLanguage, ExpenseOccurrence } from "@/domain/types";
import { t } from "@/shared/i18n";
import { useRowReminderControls } from "./RowReminderContext";

type ReminderBellButtonProps = {
  occurrence: ExpenseOccurrence;
  language: AppLanguage;
};

function stopRowGesture(event: React.SyntheticEvent) {
  // Ni deslizar, ni arrastrar, ni abrir la fila: solo cambia el aviso.
  event.stopPropagation();
}

// Campana de la fila: muestra si el gasto avisa (propio o por defecto) y lo
// cambia. Solo en recibos pendientes de gastos que siguen existiendo, también
// los que arrastra el mes anterior.
export function ReminderBellButton({ occurrence, language }: ReminderBellButtonProps) {
  const controls = useRowReminderControls();
  const reminder = controls?.reminderFor(occurrence) ?? null;
  if (!controls || !reminder || occurrence.status !== "due") return null;

  const label = t("reminders.bellLabel", language).replace(
    "{name}",
    occurrence.template.name,
  );

  return (
    <button
      type="button"
      className="app-row-bell"
      aria-pressed={reminder.enabled}
      aria-label={label}
      title={label}
      onPointerDown={stopRowGesture}
      onMouseDown={stopRowGesture}
      onTouchStart={stopRowGesture}
      onKeyDown={stopRowGesture}
      onClick={(event) => {
        event.stopPropagation();
        controls.onToggle(occurrence);
      }}
    >
      {reminder.enabled ? (
        <BellRing size={14} aria-hidden="true" />
      ) : (
        <Bell size={14} aria-hidden="true" />
      )}
    </button>
  );
}
