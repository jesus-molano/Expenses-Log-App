"use client";

import { useCallback, useEffect, useState } from "react";
import { t } from "@/shared/i18n";
import {
  createPushSubscription,
  deletePushSubscription,
  fetchPushHealth,
  fetchPushSubscribeConfig,
  getCurrentPushSubscription,
  PushApiError,
  type PushHealth,
  savePushSubscription,
  sendPushTest,
} from "../lib/push-notifications";

export type NotificationState =
  | "unsupported"
  | "permission-denied"
  | "inactive"
  | "syncing"
  | "local-only"
  | "ready"
  | "error";

function supportsPushNotifications() {
  return (
    "serviceWorker" in navigator &&
    "Notification" in window &&
    "PushManager" in window
  );
}

function pushErrorMessage(error: unknown) {
  if (!(error instanceof PushApiError)) {
    return t("settings.notificationsVerificationError");
  }

  if (error.code === "UNAUTHENTICATED") {
    return t("settings.notificationsLoginRequired");
  }
  if (error.code === "PUSH_NOT_CONFIGURED") {
    return t("settings.notificationsServiceUnavailable");
  }
  if (error.code === "PUSH_SUBSCRIPTION_EXPIRED") {
    return t("settings.notificationsExpired");
  }

  return t("settings.notificationsVerificationError");
}

export function useNotificationSettings(setMessage: (message: string) => void) {
  const [notificationState, setNotificationState] =
    useState<NotificationState>("inactive");
  const [notificationHealth, setNotificationHealth] =
    useState<PushHealth | null>(null);
  const [isTestingNotification, setIsTestingNotification] = useState(false);
  const [lastTestSentAt, setLastTestSentAt] = useState<string | null>(null);

  const synchronizeSubscription = useCallback(
    async (subscription: PushSubscription, announce: boolean) => {
      setNotificationState("syncing");
      try {
        const saved = await savePushSubscription(subscription);
        if (saved.mode === "demo") {
          setNotificationHealth({ mode: "demo", registered: false });
          setNotificationState("local-only");
          if (announce) {
            setMessage(saved.message ?? t("settings.notificationsDemo"));
          }
          return;
        }

        const health = await fetchPushHealth(subscription);
        setNotificationHealth(health);
        setNotificationState(health.registered ? "ready" : "error");
        if (announce) {
          setMessage(
            health.registered
              ? t("settings.notificationsEnabled")
              : t("settings.notificationsVerificationError"),
          );
        }
      } catch (error) {
        if (
          error instanceof PushApiError &&
          error.code === "UNAUTHENTICATED"
        ) {
          setNotificationHealth({ mode: "demo", registered: false });
          setNotificationState("local-only");
        } else {
          setNotificationHealth(null);
          setNotificationState("error");
        }
        if (announce) setMessage(pushErrorMessage(error));
      }
    },
    [setMessage],
  );

  const refreshNotificationState = useCallback(async () => {
    if (!supportsPushNotifications()) {
      setNotificationState("unsupported");
      setNotificationHealth(null);
      return;
    }

    if (Notification.permission === "denied") {
      setNotificationState("permission-denied");
      setNotificationHealth(null);
      return;
    }

    if (Notification.permission !== "granted") {
      setNotificationState("inactive");
      setNotificationHealth(null);
      return;
    }

    try {
      const subscription = await getCurrentPushSubscription();
      if (!subscription) {
        setNotificationState("inactive");
        setNotificationHealth(null);
        return;
      }
      await synchronizeSubscription(subscription, false);
    } catch {
      setNotificationState("error");
      setNotificationHealth(null);
    }
  }, [synchronizeSubscription]);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => {
      void refreshNotificationState();
    }, 0);

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void refreshNotificationState();
      }
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearTimeout(initialRefresh);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refreshNotificationState]);

  async function enableNotifications() {
    if (!supportsPushNotifications()) {
      setNotificationState("unsupported");
      setMessage(t("settings.browserNoNotifications"));
      return;
    }

    try {
      const permissionPromise = Notification.requestPermission();
      const permission = await permissionPromise;
      if (permission !== "granted") {
        setNotificationState("permission-denied");
        setNotificationHealth(null);
        setMessage(t("settings.notificationsDenied"));
        return;
      }

      setNotificationState("syncing");
      const { publicKey } = await fetchPushSubscribeConfig();
      const registration = await navigator.serviceWorker.register("/sw.js", {
        updateViaCache: "none",
      });
      const subscription = await createPushSubscription(registration, publicKey);
      await synchronizeSubscription(subscription, true);
    } catch (error) {
      setNotificationState("error");
      setNotificationHealth(null);
      setMessage(pushErrorMessage(error));
    }
  }

  async function disableNotifications() {
    if (!supportsPushNotifications()) {
      setNotificationState("unsupported");
      setMessage(t("settings.browserNoNotifications"));
      return;
    }

    try {
      const subscription = await getCurrentPushSubscription();
      if (subscription) {
        let remoteDeleteFailed = false;
        try {
          await deletePushSubscription(subscription);
        } catch {
          remoteDeleteFailed = true;
        }
        await subscription.unsubscribe();
        setMessage(
          remoteDeleteFailed
            ? t("settings.notificationsRemoteCleanup")
            : t("settings.notificationsDisabled"),
        );
      } else {
        setMessage(t("settings.notificationsDisabled"));
      }
      setNotificationState("inactive");
      setNotificationHealth(null);
      setLastTestSentAt(null);
    } catch {
      setNotificationState("error");
      setMessage(t("settings.notificationsSaveError"));
    }
  }

  async function sendTestNotification() {
    setIsTestingNotification(true);
    try {
      const subscription = await getCurrentPushSubscription();
      if (!subscription) {
        setNotificationState("inactive");
        setMessage(t("settings.notificationsExpired"));
        return;
      }

      const result = await sendPushTest(subscription);
      setLastTestSentAt(result.sentAt);
      setMessage(t("settings.notificationsTestSent"));
    } catch (error) {
      if (
        error instanceof PushApiError &&
        error.code === "PUSH_SUBSCRIPTION_EXPIRED"
      ) {
        const subscription = await getCurrentPushSubscription().catch(() => null);
        await subscription?.unsubscribe().catch(() => false);
        setNotificationState("inactive");
        setNotificationHealth(null);
      }
      setMessage(pushErrorMessage(error));
    } finally {
      setIsTestingNotification(false);
    }
  }

  return {
    notificationState,
    notificationHealth,
    notificationsActive:
      notificationState === "ready" || notificationState === "local-only",
    isTestingNotification,
    lastTestSentAt,
    enableNotifications,
    disableNotifications,
    sendTestNotification,
    refreshNotificationState,
  };
}
