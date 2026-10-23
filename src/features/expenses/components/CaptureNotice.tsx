import Link from "next/link";
import { LogIn } from "lucide-react";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";
import { captureReasonLabel, type CaptureReason } from "../lib/capture-labels";

// Aviso de que el borrador viene del análisis local (sin conexión, sin
// sesión, IA caída...), visible en el formulario o la revisión que se abre.
export function CaptureNotice({
  reason,
  language,
}: {
  reason: CaptureReason;
  language: AppLanguage;
}) {
  return (
    <div
      role="status"
      className="app-section-card grid gap-2 border-[color-mix(in_srgb,var(--app-warning)_28%,transparent)] p-3 text-xs font-medium text-[color-mix(in_srgb,var(--app-warning)_78%,var(--app-text))]"
    >
      <p>{captureReasonLabel(reason, language)}</p>
      {reason === "unauthenticated" ? (
        <Link href="/login" replace className="app-button app-button-secondary">
          <LogIn size={16} />
          {t("expenses.captureLogin", language)}
        </Link>
      ) : null}
    </div>
  );
}
