"use client";

import { History } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { StoreSnapshot } from "@/data/persistence/snapshot-policy";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";
import { formatSnapshotsSummary } from "../../lib/backup-summary";
import { SettingRow } from "../SettingRow";

function snapshotsDescription(
  available: boolean,
  snapshots: StoreSnapshot[],
  language: AppLanguage,
) {
  if (!available) return t("backup.snapshotsUnavailable", language);
  const latest = snapshots[0];
  return latest
    ? formatSnapshotsSummary(snapshots.length, latest.createdAt, language)
    : t("backup.snapshotsEmpty", language);
}

export function SnapshotsRow({
  language,
  available,
  snapshots,
  onOpen,
}: {
  language: AppLanguage;
  available: boolean;
  snapshots: StoreSnapshot[];
  onOpen: () => void;
}) {
  return (
    <SettingRow
      icon={<History size={18} />}
      title={t("backup.snapshotsTitle", language)}
      description={snapshotsDescription(available, snapshots, language)}
      wrapDescription
      action={
        available ? (
          <Button variant="secondary" size="sm" onClick={onOpen}>
            {t("backup.snapshotsOpen", language)}
          </Button>
        ) : undefined
      }
    />
  );
}
