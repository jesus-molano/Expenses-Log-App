"use client";

import { useEffect } from "react";
import { writeOfflineDiagnostic } from "@/data/persistence/offline-diagnostic-store";
import { isPrecacheFailedMessage } from "@/pwa/cache-policy";

const UPDATE_CHECK_INTERVAL_MS = 60_000;

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV === "development") {
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => void registration.unregister());
      });
      if ("caches" in window) {
        void caches.keys().then((keys) => {
          keys.forEach((key) => void caches.delete(key));
        });
      }
      return;
    }

    let registration: ServiceWorkerRegistration | null = null;
    let lastUpdateCheck = Date.now();
    const watchedWorkers = new WeakSet<ServiceWorker>();

    // El service worker avisa de la URL que tumba la instalación del precache.
    const recordPrecacheFailure = (event: MessageEvent<unknown>) => {
      if (!isPrecacheFailedMessage(event.data)) return;
      writeOfflineDiagnostic({ url: event.data.url, status: event.data.status });
    };

    // register() no falla aunque la instalación falle: el worker nuevo pasa a
    // "redundant" sin llegar a "installed". Se guarda para verlo en Ajustes.
    const watchInstallingWorker = () => {
      const worker = registration?.installing;
      if (!worker || watchedWorkers.has(worker)) return;
      watchedWorkers.add(worker);
      const startedAt = new Date();
      let installed = false;
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" || worker.state === "activated") {
          installed = true;
        }
        if (worker.state === "redundant" && !installed) {
          console.error("Service worker installation failed");
          writeOfflineDiagnostic(
            { url: "", status: 0 },
            { keepDetailedSince: startedAt },
          );
        }
      });
    };

    const checkForUpdateWhenVisible = () => {
      if (
        document.visibilityState !== "visible" ||
        !registration ||
        Date.now() - lastUpdateCheck < UPDATE_CHECK_INTERVAL_MS
      ) {
        return;
      }
      lastUpdateCheck = Date.now();
      void registration.update().catch(() => {
        // Sin conexión no hay actualización que comprobar.
      });
    };

    const register = () => {
      void navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then((nextRegistration) => {
          registration = nextRegistration;
          watchInstallingWorker();
          nextRegistration.addEventListener("updatefound", watchInstallingWorker);
          return navigator.serviceWorker.ready;
        })
        .then(() => navigator.storage?.persist?.())
        .catch((error: unknown) => {
          // Installability should never block the app shell.
          console.error("Service worker registration failed", error);
        });
    };

    navigator.serviceWorker.addEventListener("message", recordPrecacheFailure);
    navigator.serviceWorker.startMessages();
    document.addEventListener("visibilitychange", checkForUpdateWhenVisible);

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
    }

    return () => {
      window.removeEventListener("load", register);
      navigator.serviceWorker.removeEventListener("message", recordPrecacheFailure);
      document.removeEventListener("visibilitychange", checkForUpdateWhenVisible);
      registration?.removeEventListener("updatefound", watchInstallingWorker);
    };
  }, []);

  return null;
}
