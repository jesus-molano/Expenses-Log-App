import { t, type TranslationKey } from "@/shared/i18n";

export function syncedMessage(mode: "table" | "unavailable") {
  return mode === "table" ? t("settings.syncedCloud") : t("settings.savedDevice");
}

export function savedMessage(mode: "table" | "unavailable") {
  return mode === "table" ? t("settings.syncedCloud") : t("settings.savedLocal");
}

export function errorMessage(error: unknown, fallbackKey: TranslationKey) {
  return error instanceof Error ? error.message : t(fallbackKey);
}
