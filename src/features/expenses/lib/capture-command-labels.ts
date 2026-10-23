import { format, parseISO } from "date-fns";
import { enUS, es } from "date-fns/locale";
import {
  commandMonthId,
  type CaptureCommand,
  type CommandIssue,
  type ResolvedCaptureCommand,
} from "@/domain/capture-commands";
import { formatCurrency } from "@/domain/calendar";
import type { AppLanguage } from "@/domain/types";
import { t, type TranslationKey } from "@/shared/i18n";
import { formatMonthName } from "./month-view";

const INTENT_LABELS: Record<CaptureCommand["intent"], TranslationKey> = {
  pay: "captureCommands.intentPay",
  skip: "captureCommands.intentSkip",
  move: "captureCommands.intentMove",
};

export function commandIntentLabel(intent: CaptureCommand["intent"], language: AppLanguage) {
  return t(INTENT_LABELS[intent], language);
}

function shortDate(date: string, language: AppLanguage) {
  return format(parseISO(date), "d MMM", { locale: language === "en" ? enUS : es });
}

// "71,20 € · vence el 8 oct", "Cobro del 1 oct" o "Del 28 oct al 10 oct".
export function commandDetailLabel(
  resolved: ResolvedCaptureCommand,
  language: AppLanguage,
  amount: number | null = resolved.amount,
) {
  const { occurrence, command } = resolved;
  if (!occurrence) return "";
  if (command.intent === "pay") {
    return t("captureCommands.payDetail", language)
      .replace("{amount}", amount !== null ? formatCurrency(amount) : "—")
      .replace("{date}", shortDate(occurrence.dueDate, language));
  }
  if (command.intent === "skip") {
    return t("captureCommands.skipDetail", language).replace(
      "{date}",
      shortDate(occurrence.dueDate, language),
    );
  }
  if (!resolved.newDueDate) return "";
  return t("captureCommands.moveDetail", language)
    .replace("{from}", shortDate(occurrence.dueDate, language))
    .replace("{to}", shortDate(resolved.newDueDate, language));
}

const ISSUE_LABELS: Record<CommandIssue, TranslationKey> = {
  notFound: "captureCommands.notFound",
  ambiguous: "captureCommands.ambiguous",
  noOccurrence: "captureCommands.noOccurrence",
  alreadyPaid: "captureCommands.alreadyPaid",
  alreadySkipped: "captureCommands.alreadySkipped",
  sameDate: "captureCommands.sameDate",
  missingDate: "captureCommands.missingDate",
  closedMonth: "captureCommands.closedMonth",
};

// Por qué una orden no se puede aplicar tal cual. `viewMonthId` es el mes
// que se mira (donde se busca el cobro si la orden no nombra otro).
export function commandIssueLabel(
  issue: CommandIssue,
  command: CaptureCommand,
  viewMonthId: string,
  language: AppLanguage,
) {
  return t(ISSUE_LABELS[issue], language)
    .replace("{name}", command.target)
    .replace("{month}", formatMonthName(commandMonthId(command, viewMonthId), language));
}
