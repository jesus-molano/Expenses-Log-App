"use client";

import { useCallback, useEffect, useState } from "react";

export type ActionToastState = {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export const ACTION_TOAST_DURATION_MS = 6_000;

// Un solo aviso a la vez: uno nuevo sustituye al anterior.
export function useActionToast(durationMs = ACTION_TOAST_DURATION_MS) {
  const [toast, setToast] = useState<ActionToastState | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), durationMs);
    return () => window.clearTimeout(timer);
  }, [durationMs, toast]);

  const show = useCallback((next: Omit<ActionToastState, "id">) => {
    setToast({ ...next, id: Date.now() });
  }, []);

  const dismiss = useCallback(() => setToast(null), []);

  return { toast, show, dismiss };
}
