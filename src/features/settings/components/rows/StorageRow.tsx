"use client";

import { HardDrive, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { StoragePersistence } from "@/data/persistence/persistent-storage";
import type { AppLanguage } from "@/domain/types";
import { formatMessage, t } from "@/shared/i18n";
import { formatStorageSize } from "../../lib/backup-summary";
import { SettingRow } from "../SettingRow";

function storageDescription(state: StoragePersistence | null, language: AppLanguage) {
  if (!state) return t("backup.storageChecking", language);
  if (!state.supported) return t("backup.storageUnsupported", language);
  const status = t(
    state.persisted ? "backup.storagePersisted" : "backup.storageNotPersisted",
    language,
  );
  // Un uso de 0 (la estimación aún no cuenta nada) no aporta nada.
  return !state.usage
    ? status
    : `${status} ${formatMessage(
        "backup.storageUsage",
        { used: formatStorageSize(state.usage, language) },
        language,
      )}`;
}

export function StorageRow({
  language,
  state,
  requesting,
  onRequest,
}: {
  language: AppLanguage;
  state: StoragePersistence | null;
  requesting: boolean;
  onRequest: () => void;
}) {
  const canRequest = Boolean(state?.supported && !state.persisted);

  return (
    <SettingRow
      icon={state?.persisted ? <ShieldCheck size={18} /> : <HardDrive size={18} />}
      title={t("backup.storageTitle", language)}
      description={storageDescription(state, language)}
      wrapDescription
      action={
        canRequest ? (
          <Button variant="secondary" size="sm" onClick={onRequest} disabled={requesting}>
            {t("backup.storageProtect", language)}
          </Button>
        ) : undefined
      }
    />
  );
}
