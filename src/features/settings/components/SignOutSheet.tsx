import { LogOut, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";
import type { SignOutOptions } from "../hooks/use-settings-auth";

type SignOutSheetProps = {
  language: AppLanguage;
  hasPendingChanges: boolean;
  busy: boolean;
  onClose: () => void;
  onSignOut: (options: SignOutOptions) => void;
};

// Cerrar sesión deja elegir si los gastos se quedan en el dispositivo (el
// propio móvil) o se borran (un equipo compartido).
export function SignOutSheet({
  language,
  hasPendingChanges,
  busy,
  onClose,
  onSignOut,
}: SignOutSheetProps) {
  return (
    <Sheet
      ariaLabelledBy="sign-out-title"
      contentClassName="sm:max-w-sm"
      onBackdropClick={onClose}
    >
      <div className="p-5">
        <div className="app-sheet-handle mx-auto mb-3 sm:hidden" />
        <h2
          id="sign-out-title"
          className="text-lg font-semibold text-[var(--app-text)]"
        >
          {t("settings.signOutTitle", language)}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-[var(--app-text-muted)]">
          {t("settings.signOutBody", language)}
        </p>
        {hasPendingChanges ? (
          <p
            role="note"
            className="mt-3 rounded-2xl bg-[color-mix(in_srgb,var(--app-danger)_12%,transparent)] p-3 text-sm leading-relaxed text-[var(--app-text)] ring-1 ring-[color-mix(in_srgb,var(--app-danger)_26%,transparent)]"
          >
            {t("settings.signOutPending", language)}
          </p>
        ) : null}

        <div className="mt-5 grid gap-2" aria-busy={busy}>
          <Button
            variant="primary"
            className="w-full py-2 text-center leading-snug"
            disabled={busy}
            onClick={() => onSignOut({ clearLocalData: false })}
            leadingIcon={<LogOut size={16} className="shrink-0" />}
          >
            {busy
              ? t("settings.signingOut", language)
              : t("settings.signOutKeep", language)}
          </Button>
          <Button
            variant="danger"
            className="w-full py-2 text-center leading-snug"
            disabled={busy}
            onClick={() => onSignOut({ clearLocalData: true })}
            leadingIcon={<Trash2 size={16} className="shrink-0" />}
          >
            {t("settings.signOutClear", language)}
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            disabled={busy}
            onClick={onClose}
          >
            {t("common.back", language)}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
