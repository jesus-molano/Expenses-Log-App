"use client";

import { useRef, useState } from "react";
import { toDateOnly } from "@/domain/calendar";
import type { CaptureField, CapturedDraft } from "@/domain/expense-capture";
import { parseExpenseTextLocally } from "@/domain/parser";
import type { AppLanguage, DraftExpense } from "@/domain/types";
import { t, type TranslationKey } from "@/shared/i18n";

type ParserStatus = "idle" | "loading" | "done";
type ParserStatusTone = "neutral" | "success" | "warning";

export type CaptureReason =
  | "missing_key"
  | "rate_limited"
  | "unauthenticated"
  | "auth_failed"
  | "model_unavailable"
  | "quota_exhausted"
  | "blocked"
  | "truncated"
  | "invalid_response"
  | "timeout"
  | "ai_unavailable"
  | "offline";

export type CaptureResult = {
  drafts: CapturedDraft[];
  provider: "gemini" | "local";
  reason: CaptureReason | null;
};

type ParseResponse = {
  provider?: "gemini" | "local";
  reason?: CaptureReason;
  expenses?: DraftExpense[];
  review?: Array<{ missingFields?: CaptureField[]; inferredFields?: CaptureField[] }>;
};

// El navegador espera algo más que el plazo del servidor (10 s) antes de
// rendirse y usar el parser local.
const CLIENT_TIMEOUT_MS = 12_000;

const REASON_LABELS: Record<CaptureReason, TranslationKey> = {
  missing_key: "expenses.aiNotConfigured",
  rate_limited: "expenses.aiRateLimited",
  unauthenticated: "expenses.aiRequiresLogin",
  auth_failed: "expenses.aiAuthFailed",
  model_unavailable: "expenses.aiModelUnavailable",
  quota_exhausted: "expenses.aiQuotaExhausted",
  blocked: "expenses.aiBlocked",
  truncated: "expenses.aiTruncated",
  invalid_response: "expenses.aiInvalidResponse",
  timeout: "expenses.aiTimeout",
  ai_unavailable: "expenses.aiUnavailable",
  offline: "expenses.aiOffline",
};

export function useQuickExpenseParser({
  language,
  categories,
}: {
  language: AppLanguage;
  categories: string[];
}) {
  const [quickText, setQuickText] = useState("");
  const [status, setStatus] = useState<ParserStatus>("idle");
  const [result, setResult] = useState<CaptureResult | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);

  function finish(next: CaptureResult) {
    setResult(next);
    setStatus("done");
    return next;
  }

  async function parse(): Promise<CaptureResult | null> {
    const text = quickText.trim();
    if (!text) return null;

    const today = toDateOnly(new Date());
    const local = (reason: CaptureReason): CaptureResult => ({
      drafts: parseExpenseTextLocally(text, { today, categories }),
      provider: "local",
      reason,
    });
    if (!navigator.onLine) return finish(local("offline"));

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    cancelledRef.current = false;
    const timer = window.setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
    setStatus("loading");
    setResult(null);

    try {
      const response = await fetch("/api/ai/parse-expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, today, language, categories }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("AI parse failed");

      const payload = (await response.json()) as ParseResponse;
      return finish({
        drafts: (payload.expenses ?? []).map((draft, index) => ({
          draft,
          missingFields: payload.review?.[index]?.missingFields ?? [],
          inferredFields: payload.review?.[index]?.inferredFields ?? [],
        })),
        provider: payload.provider ?? "local",
        reason: payload.reason ?? null,
      });
    } catch (error) {
      if (cancelledRef.current) {
        setStatus("idle");
        return null;
      }
      return finish(
        local((error as { name?: string })?.name === "AbortError" ? "timeout" : "ai_unavailable"),
      );
    } finally {
      window.clearTimeout(timer);
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }

  function cancel() {
    cancelledRef.current = true;
    controllerRef.current?.abort();
    setStatus("idle");
  }

  function reset() {
    cancel();
    setQuickText("");
    setResult(null);
  }

  const statusLabel =
    status === "loading"
      ? t("expenses.analyzing", language)
      : status === "done" && result
        ? result.provider === "local"
          ? t(result.reason ? REASON_LABELS[result.reason] : "expenses.aiLocal", language)
          : result.drafts.length === 0
            ? t("expenses.aiNothingFound", language)
            : result.drafts.length > 1
              ? t("expenses.aiFoundMany", language).replace("{count}", String(result.drafts.length))
              : t("expenses.aiReady", language)
        : "";
  const statusTone: ParserStatusTone =
    status === "done" && result?.provider === "gemini" && result.drafts.length > 0
      ? "success"
      : status === "done"
        ? "warning"
        : "neutral";

  return {
    quickText,
    status,
    result,
    statusLabel,
    statusTone,
    needsLogin: result?.reason === "unauthenticated",
    setQuickText,
    parse,
    cancel,
    reset,
  };
}
