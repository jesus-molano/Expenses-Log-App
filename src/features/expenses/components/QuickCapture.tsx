"use client";

import { Pencil, Sparkles } from "lucide-react";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";

type QuickCaptureProps = {
  value: string;
  statusLabel: string;
  isParsing: boolean;
  visible: boolean;
  language: AppLanguage;
  onValueChange: (value: string) => void;
  onAnalyze: () => void;
  onManualAdd: () => void;
};

export function QuickCapture({
  value,
  statusLabel,
  isParsing,
  visible,
  language,
  onValueChange,
  onAnalyze,
  onManualAdd,
}: QuickCaptureProps) {
  return (
    <section
      className={`fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 mx-auto max-w-2xl rounded-[1.35rem] border border-white/10 bg-[#070d1b] p-2.5 shadow-[0_18px_55px_rgba(0,0,0,0.45),0_0_38px_rgba(132,204,22,0.08)] transition duration-300 lg:static lg:mx-0 lg:mt-4 lg:max-w-none lg:translate-y-0 lg:bg-slate-950/70 lg:opacity-100 ${
        visible
          ? "translate-y-0 opacity-100"
          : "translate-y-[calc(100%+1.5rem)] opacity-0"
      }`}
    >
      <div className="flex min-h-13 items-center gap-2 rounded-[1rem] bg-white/[0.07] px-3 ring-1 ring-white/10">
        <Sparkles size={18} className="shrink-0 text-lime-200" />
        <input
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          placeholder={t("expenses.quickPlaceholder", language)}
          className="h-12 min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-slate-500"
        />
      </div>
      <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
        <button
          type="button"
          onClick={onAnalyze}
          disabled={isParsing || !value.trim()}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-lime-300 px-4 text-sm font-semibold text-slate-950 shadow-[0_0_28px_rgba(132,204,22,0.25)] transition hover:bg-lime-200 disabled:bg-white/10 disabled:text-slate-500"
        >
          <Sparkles size={17} />
          {isParsing
            ? t("expenses.analyzing", language)
            : t("expenses.analyzeText", language)}
        </button>
        <button
          type="button"
          onClick={onManualAdd}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-2xl bg-white/8 px-4 text-sm font-semibold text-white ring-1 ring-white/10"
        >
          <Pencil size={17} />
          {t("expenses.manual", language)}
        </button>
      </div>
      {statusLabel ? (
        <div className="mt-2 px-1 text-xs text-slate-500">{statusLabel}</div>
      ) : null}
    </section>
  );
}

