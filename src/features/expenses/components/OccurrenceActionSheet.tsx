"use client";

import { format, parseISO } from "date-fns";
import { enUS, es } from "date-fns/locale";
import {
  CalendarClock,
  CheckCircle2,
  Pencil,
  RotateCcw,
  SkipForward,
  Wallet,
  X,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { DatePickerField } from "@/components/ui/DatePickerField";
import { Field } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Sheet } from "@/components/ui/Sheet";
import { formatCurrency } from "@/domain/calendar";
import type { AppLanguage, ExpenseOccurrence } from "@/domain/types";
import { t } from "@/shared/i18n";
import { formatMoneyInput, parseMoneyInput } from "@/shared/money";

type OccurrenceActionSheetProps = {
  occurrence: ExpenseOccurrence;
  // Primer día en que se puede mover (no se mueve a un mes cerrado).
  minMoveDate: string;
  language: AppLanguage;
  onClose: () => void;
  onTogglePaid: (occurrence: ExpenseOccurrence) => void;
  onPayAmount: (occurrence: ExpenseOccurrence, amount: number) => void;
  onMove: (occurrence: ExpenseOccurrence, dueDate: string) => void;
  onSkip: (occurrence: ExpenseOccurrence) => void;
  onEditSeries: (occurrence: ExpenseOccurrence) => void;
};

type Mode = "actions" | "amount" | "move";

// Acciones de un cobro al tocarlo: en móvil las filas solo tenían el gesto de
// deslizar, sin botones ni acceso para lectores de pantalla.
export function OccurrenceActionSheet({
  occurrence,
  minMoveDate,
  language,
  onClose,
  onTogglePaid,
  onPayAmount,
  onMove,
  onSkip,
  onEditSeries,
}: OccurrenceActionSheetProps) {
  const [mode, setMode] = useState<Mode>("actions");
  const [amountText, setAmountText] = useState(() =>
    formatMoneyInput(occurrence.template.amount, language),
  );
  const [moveDate, setMoveDate] = useState(occurrence.dueDate);
  const paid = occurrence.status === "paid";
  const locale = language === "en" ? enUS : es;
  const name = occurrence.template.name;

  function run(action: () => void) {
    action();
    onClose();
  }

  return (
    <Sheet ariaLabel={name} onBackdropClick={onClose}>
      <section>
        <div className="app-sheet-header sticky top-0 z-10 px-5 pb-3 pt-3">
          <div className="app-sheet-handle mx-auto mb-3 sm:hidden" />
          <header className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-[var(--app-text)]">
                {name}
              </h2>
              <p className="truncate text-sm text-[var(--app-text-muted)]">
                <span className="app-money">{formatCurrency(occurrence.template.amount)}</span>
                {" · "}
                {format(parseISO(occurrence.dueDate), "EEEE d MMM", { locale })}
                {" · "}
                {paid ? t("common.paid", language) : t("common.pending", language)}
              </p>
            </div>
            <IconButton
              type="button"
              onClick={onClose}
              aria-label={t("expenses.close", language)}
              className="shrink-0"
            >
              <X size={18} />
            </IconButton>
          </header>
        </div>

        <div className="grid gap-2 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {mode === "actions" ? (
            <>
              <Button
                variant="primary"
                size="lg"
                leadingIcon={paid ? <RotateCcw size={17} /> : <CheckCircle2 size={17} />}
                onClick={() => run(() => onTogglePaid(occurrence))}
              >
                {paid
                  ? t("expenses.occurrenceMarkPending", language)
                  : t("expenses.occurrenceMarkPaid", language)}
              </Button>
              {!paid ? (
                <Button leadingIcon={<Wallet size={17} />} onClick={() => setMode("amount")}>
                  {t("expenses.occurrencePayOther", language)}
                </Button>
              ) : null}
              <Button leadingIcon={<CalendarClock size={17} />} onClick={() => setMode("move")}>
                {t("expenses.occurrenceMove", language)}
              </Button>
              {!paid ? (
                <Button
                  leadingIcon={<SkipForward size={17} />}
                  onClick={() => run(() => onSkip(occurrence))}
                >
                  {t("expenses.occurrenceSkip", language)}
                </Button>
              ) : null}
              <Button
                variant="ghost"
                leadingIcon={<Pencil size={17} />}
                onClick={() => run(() => onEditSeries(occurrence))}
              >
                {t("expenses.occurrenceEditSeries", language)}
              </Button>
            </>
          ) : null}

          {mode === "amount" ? (
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                const amount = parseMoneyInput(amountText);
                if (amount === null || amount <= 0) return;
                run(() => onPayAmount(occurrence, amount));
              }}
            >
              <Field label={t("expenses.occurrencePaidAmount", language)}>
                <MoneyInput
                  value={amountText}
                  onValueChange={setAmountText}
                  invalidMessage={t("expenses.amountInvalid", language)}
                  autoFocus
                />
              </Field>
              <Button type="submit" variant="primary" size="lg">
                {t("expenses.occurrenceSavePayment", language)}
              </Button>
              <Button variant="ghost" onClick={() => setMode("actions")}>
                {t("expenses.occurrenceBack", language)}
              </Button>
            </form>
          ) : null}

          {mode === "move" ? (
            <div className="grid gap-3">
              <Field label={t("expenses.occurrenceMoveTo", language)}>
                <DatePickerField
                  value={moveDate}
                  onChange={(value) => setMoveDate(value ?? moveDate)}
                  label={t("expenses.occurrenceMoveTo", language)}
                  language={language}
                  min={minMoveDate}
                />
              </Field>
              <Button
                variant="primary"
                size="lg"
                disabled={moveDate === occurrence.dueDate || moveDate < minMoveDate}
                onClick={() => run(() => onMove(occurrence, moveDate))}
              >
                {t("expenses.occurrenceMoveConfirm", language)}
              </Button>
              <Button variant="ghost" onClick={() => setMode("actions")}>
                {t("expenses.occurrenceBack", language)}
              </Button>
            </div>
          ) : null}
        </div>
      </section>
    </Sheet>
  );
}
