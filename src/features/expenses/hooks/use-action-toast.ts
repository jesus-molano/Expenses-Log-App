"use client";

import { useCallback, useEffect, useState } from "react";

export type ActionToastState = {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export const ACTION_TOAST_DURATION_MS = 6_000;

// Un solo aviso a la vez: uno nuevo sustituye al anterior. Mientras tiene el
// foco o el puntero encima no se cierra, para poder usar su acción.
export function useActionToast(durationMs = ACTION_TOAST_DURATION_MS) {
  const [toast, setToast] = useState<ActionToastState | null>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!toast || paused) return;
    const timer = window.setTimeout(() => setToast(null), durationMs);
    return () => window.clearTimeout(timer);
  }, [durationMs, paused, toast]);

  const show = useCallback((next: Omit<ActionToastState, "id">) => {
    setToast({ ...next, id: Date.now() });
  }, []);

  const dismiss = useCallback(() => {
    setToast(null);
    setPaused(false);
  }, []);

  return {
    toast,
    show,
    dismiss,
    pause: useCallback(() => setPaused(true), []),
    resume: useCallback(() => setPaused(false), []),
  };
}
