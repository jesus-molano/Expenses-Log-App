"use client";

import { useState } from "react";
import { parseExpenseTextLocally } from "@/domain/parser";
import type { AppLanguage, DraftExpense } from "@/domain/types";
import { t } from "@/shared/i18n";
import { createEmptyDraft } from "../lib/dashboard-config";

type ParserStatus = "idle" | "loading" | "gemini" | "local" | "error";
type ParserStatusTone = "neutral" | "success" | "warning";
type LocalFallbackReason =
  | "missing_key"
  | "rate_limited"
  | "quota_exhausted"
  | "ai_unavailable"
  | "invalid_response"
  | "timeout";

type ParseResponse = {
  provider?: "gemini" | "local";
  reason?: LocalFallbackReason;
  expenses?: DraftExpense[];
};

export function useQuickExpenseParser(language: AppLanguage) {
  const [quickText, setQuickText] = useState("");
  const [status, setStatus] = useState<ParserStatus>("idle");
  const [fallbackReason, setFallbackReason] = useState<
    LocalFallbackReason | null
  >(null);

  async function parse(): Promise<DraftExpense | null> {
    const text = quickText.trim();
    if (!text) return null;

    setStatus("loading");
    setFallbackReason(null);

    try {
      const response = await fetch("/api/ai/parse-expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) throw new Error("AI parse failed");

      const payload = (await response.json()) as ParseResponse;
      const first = payload.expenses?.[0] as DraftExpense | undefined;
      if (payload.provider === "gemini") {
        setStatus("gemini");
      } else {
        setFallbackReason(payload.reason ?? "ai_unavailable");
        setStatus("local");
      }

      return first ?? parseExpenseTextLocally(text)[0] ?? createEmptyDraft();
    } catch {
      setStatus("error");
      setFallbackReason("ai_unavailable");
      return parseExpenseTextLocally(text)[0] ?? createEmptyDraft();
    }
  }

  const localStatusLabel = fallbackReason
    ? {
        missing_key: t("expenses.aiNotConfigured", language),
        rate_limited: t("expenses.aiRateLimited", language),
        quota_exhausted: t("expenses.aiQuotaExhausted", language),
        ai_unavailable: t("expenses.aiUnavailable", language),
        invalid_response: t("expenses.aiInvalidResponse", language),
        timeout: t("expenses.aiTimeout", language),
      }[fallbackReason]
    : t("expenses.aiLocal", language);

  const statusLabel = {
    idle: "",
    loading: t("expenses.analyzing", language),
    gemini: t("expenses.aiReady", language),
    local: localStatusLabel,
    error: t("expenses.aiUnavailable", language),
  }[status];
  const statusTone: ParserStatusTone =
    status === "gemini" ? "success" : status === "idle" ? "neutral" : "warning";

  return {
    quickText,
    status,
    statusLabel,
    statusTone,
    setQuickText,
    parse,
  };
}
