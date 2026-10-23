"use client";

import { useEffect } from "react";
import { syncPushHeartbeat } from "../lib/push-heartbeat";

// Espera a que la app termine de arrancar antes de tocar la red.
const START_DELAY_MS = 5_000;
// Tras un intento (fallido o no), como mucho otro por hora en esta sesión.
const ATTEMPT_THROTTLE_MS = 60 * 60 * 1000;

// Latido de la suscripción push desde cualquier pantalla, no solo Ajustes: al
// abrir la app y al volver a ella. Silencioso: un fallo se reintenta luego.
export function usePushHeartbeat() {
  useEffect(() => {
    let lastAttempt = 0;
    let running = false;

    const run = () => {
      if (
        running ||
        document.visibilityState !== "visible" ||
        navigator.onLine === false ||
        Date.now() - lastAttempt < ATTEMPT_THROTTLE_MS
      ) {
        return;
      }
      lastAttempt = Date.now();
      running = true;
      void syncPushHeartbeat()
        .catch(() => undefined)
        .finally(() => {
          running = false;
        });
    };

    const timer = window.setTimeout(run, START_DELAY_MS);
    document.addEventListener("visibilitychange", run);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", run);
    };
  }, []);
}
