"use client";

import { AlertTriangle, CheckCircle2, CloudOff, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";
import { useOfflineReadiness } from "../../hooks/use-offline-readiness";
import type { OfflineDiagnostic } from "@/data/persistence/offline-diagnostic-store";
import type {
  OfflineReadiness,
  OfflineStatus,
} from "../../lib/offline-readiness";
import { SettingRow } from "../SettingRow";

function offlineDescription(
  readiness: OfflineReadiness | undefined,
  status: OfflineStatus | null | undefined,
  lastFailure: OfflineDiagnostic | null | undefined,
  language: AppLanguage,
) {
  if (!readiness) return t("settings.offlineChecking", language);
  if (readiness === "ready") {
    return t("settings.offlineReady", language)
      .replace("{cached}", String(status?.cached ?? 0))
      .replace("{expected}", String(status?.expected ?? 0));
  }
  if (readiness === "failed" && lastFailure?.url) {
    return t("settings.offlineFailed", language)
      .replace("{url}", lastFailure.url)
      .replace(
        "{status}",
        lastFailure.status
          ? String(lastFailure.status)
          : t("settings.offlineNoResponse", language),
      );
  }

  return {
    unsupported: t("settings.offlineUnsupported", language),
    missing: t("settings.offlineMissing", language),
    legacy: t("settings.offlineLegacy", language),
    unknown: t("settings.offlineUnknown", language),
    failed: t("settings.offlineFailedGeneric", language),
    preparing: t("settings.offlinePreparing", language),
  }[readiness];
}

function offlineIcon(readiness: OfflineReadiness | undefined) {
  if (readiness === "ready") return <CheckCircle2 size={18} />;
  if (readiness === "failed" || readiness === "legacy" || readiness === "unknown") {
    return <AlertTriangle size={18} />;
  }
  if (readiness === "preparing" || !readiness) {
    return <LoaderCircle size={18} />;
  }
  return <CloudOff size={18} />;
}

export function OfflineRow({ language }: { language: AppLanguage }) {
  const { readiness, status, lastFailure, checking, check } =
    useOfflineReadiness();

  return (
    <SettingRow
      icon={offlineIcon(readiness)}
      title={t("settings.offlineTitle", language)}
      description={offlineDescription(readiness, status, lastFailure, language)}
      wrapDescription
      action={
        readiness === "unsupported" ? undefined : (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void check()}
            disabled={checking}
          >
            {t("settings.offlineCheck", language)}
          </Button>
        )
      }
    />
  );
}
