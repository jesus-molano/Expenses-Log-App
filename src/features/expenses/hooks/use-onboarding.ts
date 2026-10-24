"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  readOnboardingState,
  writeOnboardingState,
  type OnboardingState,
} from "@/data/persistence/onboarding-store";
import { configuredPayday } from "@/domain/budget-month";
import type { ExpenseStore } from "@/domain/types";
import { isAppleMobile, isStandaloneDisplay } from "@/shared/platform";
import {
  QUICK_ADD_PRESETS,
  availableQuickAdds,
  buildOnboardingChecklist,
  shouldShowOnboarding,
} from "../lib/onboarding";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function subscribeInstalled(onChange: () => void) {
  const media = window.matchMedia?.("(display-mode: standalone)");
  media?.addEventListener?.("change", onChange);
  window.addEventListener("appinstalled", onChange);
  return () => {
    media?.removeEventListener?.("change", onChange);
    window.removeEventListener("appinstalled", onChange);
  };
}

function readInstalled() {
  return isStandaloneDisplay();
}

// El permiso de avisos se activa en Ajustes: se vuelve a leer al volver.
function subscribeNotifications(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  window.addEventListener("focus", onChange);
  return () => {
    document.removeEventListener("visibilitychange", onChange);
    window.removeEventListener("focus", onChange);
  };
}

function readNotificationsEnabled() {
  return typeof Notification !== "undefined" && Notification.permission === "granted";
}

const serverFalse = () => false;

// Primeros pasos: chips de alta rápida y checklist (sueldo, primer gasto,
// avisos e instalar), con lo que el navegador sabe de avisos e instalación.
export function useOnboarding({
  store,
  monthId,
  syncing,
}: {
  store: ExpenseStore;
  monthId: string;
  syncing: boolean;
}) {
  const [state, setState] = useState<OnboardingState>(() => readOnboardingState());
  const installed = useSyncExternalStore(subscribeInstalled, readInstalled, serverFalse);
  const notificationsEnabled = useSyncExternalStore(
    subscribeNotifications,
    readNotificationsEnabled,
    serverFalse,
  );
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const checklist = buildOnboardingChecklist({
    hasSalary: configuredPayday(store.finance, monthId) !== null,
    hasExpense: store.templates.length > 0,
    notificationsEnabled,
    installed,
  });
  const visible = shouldShowOnboarding({
    templateCount: store.templates.length,
    started: Boolean(state.startedAt),
    dismissed: Boolean(state.dismissedAt),
    syncing,
  });
  // Solo se retiene el aviso de instalación del navegador mientras la guía
  // ofrece instalar; si no, el navegador muestra el suyo.
  const interceptInstallRef = useRef(false);
  useEffect(() => {
    interceptInstallRef.current = visible && !installed;
  }, [visible, installed]);

  useEffect(() => {
    function onBeforeInstallPrompt(event: Event) {
      if (!interceptInstallRef.current) return;
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setInstallPrompt(null);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const update = useCallback((patch: OnboardingState) => {
    setState((current) => {
      const next = { ...current, ...patch };
      writeOnboardingState(next);
      return next;
    });
  }, []);

  async function promptInstall() {
    if (!installPrompt) return;
    setInstallPrompt(null);
    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
    } catch {
      // Si el navegador ya no permite mostrarlo, queda la pista manual.
    }
  }

  return {
    visible,
    checklist,
    quickAdds: availableQuickAdds(QUICK_ADD_PRESETS, store.templates),
    canPromptInstall: installPrompt !== null,
    appleMobile: typeof navigator !== "undefined" && isAppleMobile(navigator),
    promptInstall,
    // El primer gasto se añade con la guía a la vista: sigue visible hasta
    // completarla u ocultarla.
    markStarted: () => {
      if (!state.startedAt) update({ startedAt: new Date().toISOString() });
    },
    dismiss: () => update({ dismissedAt: new Date().toISOString() }),
  };
}
