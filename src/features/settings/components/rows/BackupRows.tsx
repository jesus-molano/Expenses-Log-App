"use client";

import { useState } from "react";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";
import { useDataTransfer } from "../../hooks/use-data-transfer";
import { useSnapshots } from "../../hooks/use-snapshots";
import { useStoragePersistence } from "../../hooks/use-storage-persistence";
import { ImportPreviewSheet } from "../backup/ImportPreviewSheet";
import { SnapshotsSheet } from "../backup/SnapshotsSheet";
import { SnapshotsRow } from "./SnapshotsRow";
import { StorageRow } from "./StorageRow";
import { ExportRow, ImportRow } from "./TransferRows";

// Sección "Copias y datos": almacenamiento persistente, exportar, importar y
// copias automáticas de este dispositivo. El resultado de cada acción se ve
// y se anuncia aquí mismo, junto a lo que se ha tocado.
export function BackupRows({ language }: { language: AppLanguage }) {
  const [message, setMessage] = useState("");
  const storage = useStoragePersistence({ language, onMessage: setMessage });
  const transfer = useDataTransfer({ language, onMessage: setMessage });
  const snapshots = useSnapshots({ language, onMessage: setMessage });
  const [snapshotsOpen, setSnapshotsOpen] = useState(false);

  return (
    <section
      aria-labelledby="backup-section-title"
      className="mt-3 border-t border-[var(--app-border)] pt-3"
    >
      <h2
        id="backup-section-title"
        className="mb-2 px-1 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[var(--app-text-subtle)]"
      >
        {t("backup.sectionTitle", language)}
      </h2>

      <div className="grid gap-2">
        <StorageRow
          language={language}
          state={storage.state}
          requesting={storage.requesting}
          onRequest={() => void storage.request()}
        />
        <ExportRow language={language} onExport={transfer.exportFile} />
        <ImportRow
          language={language}
          reading={transfer.reading}
          onFile={(file) => void transfer.selectFile(file)}
        />
        <SnapshotsRow
          language={language}
          available={snapshots.available}
          snapshots={snapshots.snapshots}
          onOpen={() => setSnapshotsOpen(true)}
        />
      </div>

      <div role="status" aria-live="polite">
        {message ? (
          <p className="mt-2 rounded-2xl bg-[var(--app-panel-soft-alpha)] p-3 text-sm leading-relaxed text-[var(--app-text)] ring-1 ring-[var(--app-border)]">
            {message}
          </p>
        ) : null}
      </div>

      {transfer.pending ? (
        <ImportPreviewSheet
          language={language}
          pending={transfer.pending}
          mode={transfer.mode}
          importing={transfer.importing}
          onModeChange={transfer.setMode}
          onConfirm={() => void transfer.confirmImport()}
          onCancel={transfer.cancelImport}
        />
      ) : null}

      {snapshotsOpen ? (
        <SnapshotsSheet
          language={language}
          snapshots={snapshots.snapshots}
          loading={snapshots.loading}
          loadError={snapshots.loadError}
          restoringId={snapshots.restoringId}
          saving={snapshots.saving}
          onRestore={snapshots.restore}
          onSaveNow={() => void snapshots.saveNow()}
          onClose={() => setSnapshotsOpen(false)}
        />
      ) : null}
    </section>
  );
}
