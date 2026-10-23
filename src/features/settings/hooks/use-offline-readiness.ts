"use client";

import { useCallback, useEffect, useState } from "react";
import {
  OFFLINE_STATUS_REQUEST,
  isLegacyCacheName,
  isOfflineStatusResponse,
} from "@/pwa/cache-policy";
import {
  clearOfflineDiagnostic,
  readOfflineDiagnostic,
  type OfflineDiagnostic,
} from "@/data/persistence/offline-diagnostic-store";
import {
  resolveOfflineReadiness,
  shouldClearOfflineDiagnostic,
  type OfflineReadiness,
  type OfflineStatus,
} from "../lib/offline-readiness";

// Un service worker parado puede tardar en arrancar para responder.
const STATUS_TIMEOUT_MS = 3_000;

type OfflineReadinessState = {
  readiness: OfflineReadiness;
  status: OfflineStatus | null;
  lastFailure: OfflineDiagnostic | null;
};

export function useOfflineReadiness() {
  const [state, setState] = useState<OfflineReadinessState | null>(null);
  const [checking, setChecking] = useState(false);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      setState(await readOfflineReadiness());
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    const initialCheck = window.setTimeout(() => {
      void check();
    }, 0);
    return () => window.clearTimeout(initialCheck);
  }, [check]);

  return { ...state, checking, check };
}

async function readOfflineReadiness(): Promise<OfflineReadinessState> {
  if (!("serviceWorker" in navigator)) {
    return { readiness: "unsupported", status: null, lastFailure: null };
  }

  const registration = await navigator.serviceWorker
    .getRegistration()
    .catch(() => undefined);
  const status = registration?.active
    ? await requestOfflineStatus(registration.active)
    : null;
  const hasLegacyCache =
    "caches" in window
      ? (await caches.keys().catch(() => [])).some(isLegacyCacheName)
      : false;
  const lastFailure = readOfflineDiagnostic();
  const isInstalling = Boolean(registration?.installing ?? registration?.waiting);
  const readiness = resolveOfflineReadiness({
    supported: true,
    hasRegistration: Boolean(registration),
    isInstalling,
    status,
    hasLegacyCache,
    lastFailure,
  });

  if (lastFailure && shouldClearOfflineDiagnostic({ readiness, isInstalling })) {
    clearOfflineDiagnostic();
  }

  return {
    readiness,
    status,
    lastFailure: readiness === "failed" ? lastFailure : null,
  };
}

function requestOfflineStatus(worker: ServiceWorker): Promise<OfflineStatus | null> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = window.setTimeout(() => {
      channel.port1.close();
      resolve(null);
    }, STATUS_TIMEOUT_MS);

    channel.port1.onmessage = (event: MessageEvent<unknown>) => {
      window.clearTimeout(timer);
      channel.port1.close();
      resolve(
        isOfflineStatusResponse(event.data)
          ? { expected: event.data.expected, cached: event.data.cached }
          : null,
      );
    };
    worker.postMessage({ type: OFFLINE_STATUS_REQUEST }, [channel.port2]);
  });
}
