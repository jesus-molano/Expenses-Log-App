import Link from "next/link";
import { LogIn, Mic, Pencil, Plus, Sparkles, Square, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Sheet } from "@/components/ui/Sheet";
import { CAPTURE_TEXT_MAX_LENGTH } from "@/domain/expense-capture";
import type { AppLanguage } from "@/domain/types";
import { t, type TranslationKey } from "@/shared/i18n";
import type { DictationError } from "../lib/voice-support";
import { cn } from "@/shared/ui";

type QuickCaptureProps = {
  open: boolean;
  value: string;
  statusLabel: string;
  statusTone: "neutral" | "success" | "warning";
  isParsing: boolean;
  needsLogin: boolean;
  dictation: {
    supported: boolean;
    listening: boolean;
    busy: boolean;
    error: DictationError | null;
    toggle: () => void;
  };
  language: AppLanguage;
  onClose: () => void;
  onValueChange: (value: string) => void;
  onAnalyze: () => void;
  onCancel: () => void;
  onManualAdd: () => void;
};

export function AddExpenseButton({
  language,
  visible,
  onClick,
}: {
  language: AppLanguage;
  visible: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={t("expenses.addExpense", language)}
      data-state={visible ? "visible" : "hidden"}
      onClick={onClick}
      className="app-fab"
    >
      <Plus size={24} strokeWidth={2.4} />
    </button>
  );
}

const DICTATION_ERRORS: Record<DictationError, TranslationKey> = {
  offline: "expenses.dictationOffline",
  "not-allowed": "expenses.dictationNotAllowed",
  "no-speech": "expenses.dictationNoSpeech",
  network: "expenses.dictationUnavailable",
  "service-not-allowed": "expenses.dictationUnavailable",
  "audio-capture": "expenses.dictationNoMicrophone",
  "language-not-supported": "expenses.dictationLanguage",
};

const EXAMPLES: Record<AppLanguage, string[]> = {
  es: [
    "Netflix 12,99 el 5",
    "Seguro del coche 420 al año en marzo",
    "Gimnasio 35 al mes el día 1 y Spotify 10,99",
  ],
  en: [
    "Netflix 12.99 on the 5th",
    "Car insurance 420 yearly in March",
    "Gym 35 monthly on the 1st and Spotify 10.99",
  ],
};

export function QuickCapture({
  open,
  value,
  statusLabel,
  statusTone,
  isParsing,
  needsLogin,
  dictation,
  language,
  onClose,
  onValueChange,
  onAnalyze,
  onCancel,
  onManualAdd,
}: QuickCaptureProps) {
  if (!open) return null;

  const dictationMessage = dictation.listening
    ? t("expenses.dictationListening", language)
    : dictation.error
      ? t(DICTATION_ERRORS[dictation.error], language)
      : dictation.supported
        ? ""
        : t("expenses.dictationKeyboardHint", language);

  return (
    <Sheet
      ariaLabel={t("expenses.addExpense", language)}
      onBackdropClick={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!isParsing && value.trim()) onAnalyze();
        }}
      >
        <div className="app-sheet-header sticky top-0 z-10 px-5 pb-3 pt-3">
          <div className="app-sheet-handle mx-auto mb-3 sm:hidden" />
          <header className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-[var(--app-text)]">
                {t("expenses.addExpense", language)}
              </h2>
              <p className="truncate text-sm text-[var(--app-text-muted)]">
                {t("expenses.newExpenseSubtitle", language)}
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

        <div className="grid gap-3 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <label className="sr-only" htmlFor="quick-expense-text">
            {t("expenses.analyzeText", language)}
          </label>
          <div className="relative">
            <textarea
              id="quick-expense-text"
              value={value}
              rows={3}
              maxLength={CAPTURE_TEXT_MAX_LENGTH}
              aria-describedby="quick-expense-hint"
              onChange={(event) => {
                const textarea = event.currentTarget;
                textarea.style.height = "auto";
                textarea.style.height = `${textarea.scrollHeight}px`;
                onValueChange(textarea.value);
              }}
              onKeyDown={(event) => {
                // Con teclado físico, Intro analiza; Mayús+Intro o un teclado
                // componiendo (IME) no. En pantallas táctiles no hay
                // Mayús+Intro: Intro hace otra línea y se analiza con el botón.
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing &&
                  !window.matchMedia("(pointer: coarse)").matches
                ) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              // Mientras se dicta, el texto lo escribe el dictado: lo tecleado
              // se perdería con el siguiente resultado.
              readOnly={dictation.busy}
              placeholder={t("expenses.quickPlaceholder", language)}
              className={cn(
                "input-control h-auto min-h-24 w-full resize-none py-3 leading-relaxed",
                dictation.supported && "pr-14",
              )}
            />
            {dictation.supported ? (
              <IconButton
                type="button"
                size="touch"
                variant={dictation.listening ? "default" : "ghost"}
                onClick={dictation.toggle}
                disabled={isParsing || (dictation.busy && !dictation.listening)}
                aria-label={
                  dictation.listening
                    ? t("expenses.dictationStop", language)
                    : t("expenses.dictationStart", language)
                }
                className={cn(
                  "absolute bottom-2 right-2",
                  dictation.listening && "app-dictation-active",
                )}
              >
                {dictation.listening ? <Square size={16} /> : <Mic size={18} />}
              </IconButton>
            ) : null}
          </div>
          <p aria-live="polite" className="min-h-4 text-xs text-[var(--app-text-muted)]">
            {dictationMessage}
          </p>
          <p id="quick-expense-hint" className="text-xs text-[var(--app-text-muted)]">
            {t("expenses.captureHint", language)}
          </p>

          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label={t("expenses.captureExamples", language)}
          >
            {EXAMPLES[language].map((example) => (
              <button
                key={example}
                type="button"
                className="app-chip app-focus-ring min-h-9 px-3 py-1.5 text-left text-xs font-medium disabled:opacity-50"
                disabled={dictation.busy}
                onClick={() => onValueChange(example)}
              >
                {example}
              </button>
            ))}
          </div>

          {/* Claves distintas: si React reutilizara el mismo <button>, al
              cancelar pasaría a type=submit antes de que el navegador
              procese el clic y enviaría el formulario otra vez. */}
          {isParsing ? (
            <Button
              key="cancel"
              type="button"
              onClick={(event) => {
                event.preventDefault();
                onCancel();
              }}
              className="w-full"
              size="lg"
            >
              {t("expenses.captureCancel", language)}
            </Button>
          ) : (
            <Button
              key="submit"
              type="submit"
              disabled={!value.trim()}
              className="w-full"
              variant="primary"
              size="lg"
              leadingIcon={<Sparkles size={17} />}
            >
              {t("expenses.analyzeText", language)}
            </Button>
          )}

          <p
            role="status"
            className={cn(
              "min-h-4 text-xs font-medium",
              statusTone === "success" &&
                "text-[color-mix(in_srgb,var(--app-success)_78%,var(--app-text))]",
              statusTone === "warning" &&
                "text-[color-mix(in_srgb,var(--app-warning)_78%,var(--app-text))]",
              statusTone === "neutral" && "text-[var(--app-text-muted)]",
            )}
          >
            {statusLabel}
          </p>

          {needsLogin ? (
            <Link href="/login" replace className="app-button app-button-secondary">
              <LogIn size={16} />
              {t("expenses.captureLogin", language)}
            </Link>
          ) : null}

          <Button
            type="button"
            onClick={onManualAdd}
            className="w-full"
            variant="ghost"
            leadingIcon={<Pencil size={17} />}
          >
            {t("expenses.manual", language)}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
