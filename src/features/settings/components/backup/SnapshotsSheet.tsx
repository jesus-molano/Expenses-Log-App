"use client";

import { useEffect, useRef, useState } from "react";
import { History, RotateCcw, Save, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Sheet } from "@/components/ui/Sheet";
import type { StoreSnapshot } from "@/data/persistence/snapshot-policy";
import type { AppLanguage } from "@/domain/types";
import { formatMessage, t } from "@/shared/i18n";
import {
  formatBackupDate,
  formatStoreSummary,
  snapshotReasonLabel,
} from "../../lib/backup-summary";

type SnapshotsSheetProps = {
  language: AppLanguage;
  snapshots: StoreSnapshot[];
  loading: boolean;
  loadError: boolean;
  restoringId: string | null;
  saving: boolean;
  onRestore: (snapshot: StoreSnapshot) => Promise<boolean>;
  onSaveNow: () => void;
  onClose: () => void;
};

export function SnapshotsSheet({
  language,
  snapshots,
  loading,
  loadError,
  restoringId,
  saving,
  onRestore,
  onSaveNow,
  onClose,
}: SnapshotsSheetProps) {
  const [confirming, setConfirming] = useState<StoreSnapshot | null>(null);
  const busy = restoringId !== null;

  async function confirmRestore() {
    if (!confirming) return;
    if (await onRestore(confirming)) onClose();
    else setConfirming(null);
  }

  return (
    <Sheet
      ariaLabelledBy="snapshots-title"
      onBackdropClick={() => {
        if (!busy) onClose();
      }}
      contentClassName="max-h-[88dvh] sm:max-w-lg"
    >
      <section className="grid gap-4 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full bg-[color-mix(in_srgb,var(--app-accent)_13%,transparent)] px-2.5 py-1 text-xs font-bold text-[var(--app-accent)]">
              <History size={14} />
              {t("backup.sectionTitle", language)}
            </div>
            <h2
              id="snapshots-title"
              className="mt-2 text-xl font-semibold leading-tight text-[var(--app-text)]"
            >
              {t("backup.snapshotsTitle", language)}
            </h2>
            <p className="mt-1 text-sm text-[var(--app-text-muted)]">
              {t("backup.snapshotsHelp", language)}
            </p>
          </div>
          <IconButton
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label={t("backup.close", language)}
            className="shrink-0"
          >
            <X size={18} />
          </IconButton>
        </header>

        {confirming ? (
          <RestoreConfirmation
            language={language}
            snapshot={confirming}
            restoring={busy}
            onCancel={() => setConfirming(null)}
            onConfirm={() => void confirmRestore()}
          />
        ) : (
          <Button
            variant="secondary"
            onClick={onSaveNow}
            disabled={saving || busy}
            leadingIcon={<Save size={16} />}
          >
            {t("backup.snapshotCreate", language)}
          </Button>
        )}

        {loadError ? (
          <p className="text-sm font-semibold text-[var(--app-warning)]">
            {t("backup.snapshotsLoadError", language)}
          </p>
        ) : null}

        {snapshots.length ? (
          <ul className="app-section-card px-3">
            {snapshots.map((snapshot) => {
              const date = formatBackupDate(snapshot.createdAt, language);
              return (
                <li
                  key={snapshot.id}
                  className="flex items-center gap-3 border-b border-[var(--app-border)] py-3 last:border-b-0"
                  data-snapshot-reason={snapshot.reason}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-[var(--app-text)]">
                      {date}
                    </span>
                    <span className="block text-xs text-[var(--app-text-muted)]">
                      {snapshotReasonLabel(snapshot.reason, language)}
                    </span>
                    <span className="block text-xs text-[var(--app-text-muted)]">
                      {formatStoreSummary(snapshot.summary, language)}
                    </span>
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="shrink-0"
                    leadingIcon={<RotateCcw size={15} />}
                    aria-label={formatMessage("backup.restoreLabel", { date }, language)}
                    onClick={() => setConfirming(snapshot)}
                    disabled={busy}
                  >
                    {t("backup.restore", language)}
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : loading ? null : (
          <p className="app-empty-line p-5 text-sm font-medium">
            {t("backup.snapshotsNone", language)}
          </p>
        )}
      </section>
    </Sheet>
  );
}

// Confirmación dentro de la propia hoja: un diálogo encima quedaría fuera de
// su foco atrapado. Al abrirse, el foco va a "Cancelar", la opción segura.
function RestoreConfirmation({
  language,
  snapshot,
  restoring,
  onCancel,
  onConfirm,
}: {
  language: AppLanguage;
  snapshot: StoreSnapshot;
  restoring: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const groupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    groupRef.current
      ?.querySelector<HTMLButtonElement>("[data-restore-cancel]")
      ?.focus({ preventScroll: true });
  }, [snapshot.id]);

  return (
    <div
      ref={groupRef}
      role="group"
      aria-labelledby="restore-confirm-title"
      className="app-section-card grid gap-3 border-[color-mix(in_srgb,var(--app-danger)_32%,transparent)] p-3"
    >
      <div>
        <h3 id="restore-confirm-title" className="text-sm font-semibold text-[var(--app-text)]">
          {t("backup.restoreConfirmTitle", language)}
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-[var(--app-text-muted)]">
          {formatMessage(
            "backup.restoreConfirmBody",
            { date: formatBackupDate(snapshot.createdAt, language) },
            language,
          )}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button
          data-restore-cancel
          variant="secondary"
          onClick={onCancel}
          disabled={restoring}
        >
          {t("backup.cancel", language)}
        </Button>
        <Button variant="danger" onClick={onConfirm} disabled={restoring}>
          {restoring ? t("backup.restoring", language) : t("backup.restore", language)}
        </Button>
      </div>
    </div>
  );
}
