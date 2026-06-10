"use client";

import { Pencil, Sparkles } from "lucide-react";

type QuickCaptureProps = {
  value: string;
  statusLabel: string;
  isParsing: boolean;
  onValueChange: (value: string) => void;
  onAnalyze: () => void;
  onManualAdd: () => void;
};

export function QuickCapture({
  value,
  statusLabel,
  isParsing,
  onValueChange,
  onAnalyze,
  onManualAdd,
}: QuickCaptureProps) {
  return (
    <section className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 mx-auto max-w-2xl rounded-[1.35rem] border border-white/70 bg-white/90 p-2.5 shadow-[0_18px_55px_rgba(15,23,42,0.22)] backdrop-blur-xl lg:static lg:mx-0 lg:mt-4 lg:max-w-none lg:border-slate-200 lg:bg-white lg:shadow-sm">
      <div className="flex min-h-13 items-center gap-2 rounded-[1rem] bg-slate-100 px-3">
        <Sparkles size={18} className="shrink-0 text-slate-500" />
        <input
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          placeholder="Netflix 15,99 mensual dia 12"
          className="h-12 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-slate-400"
        />
      </div>
      <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
        <button
          type="button"
          onClick={onAnalyze}
          disabled={isParsing || !value.trim()}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-500"
        >
          <Sparkles size={17} />
          {isParsing ? "Analizando" : "Analizar texto"}
        </button>
        <button
          type="button"
          onClick={onManualAdd}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200"
        >
          <Pencil size={17} />
          Manual
        </button>
      </div>
      {statusLabel ? (
        <div className="mt-2 px-1 text-xs text-slate-500">{statusLabel}</div>
      ) : null}
    </section>
  );
}
