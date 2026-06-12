"use client";

import { useEffect, useState } from "react";
import { t } from "@/shared/i18n";
import {
  createPushSubscription,
  deletePushSubscription,
  fetchPushSubscribeConfig,
  getCurrentPushSubscription,
  savePushSubscription,
} from "../lib/push-notifications";

export function useNotificationSettings(setMessage: (message: string) => void) {
  const [notificationsActive, setNotificationsActive] = useState(false);

  useEffect(() => {
    if (
      !("serviceWorker" in navigator) ||
      !("Notification" in window) ||
      !("PushManager" in window) ||
      Notification.permission !== "granted"
    ) {
      return;
    }

    void getCurrentPushSubscription()
      .then((subscription) => setNotificationsActive(Boolean(subscription)))
      .catch(() => setNotificationsActive(false));
  }, []);

  async function enableNotifications() {
    if (!("serviceWorker" in navigator) || !("Notification" in window)) {
      setMessage(t("settings.browserNoNotifications"));
      return;
    }

    if (!("PushManager" in window)) {
      setMessage(t("settings.browserNoNotifications"));
      return;
    }

    try {
      const { publicKey } = await fetchPushSubscribeConfig();
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setNotificationsActive(false);
        setMessage(t("settings.notificationsDenied"));
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      const subscription = await createPushSubscription(registration, publicKey);
      const result = await savePushSubscription(subscription);

      setNotificationsActive(true);
      setMessage(
        result.mode === "demo"
          ? (result.message ?? t("settings.notificationsDemo"))
          : t("settings.notificationsEnabled"),
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : t("settings.notificationsSaveError"),
      );
    }
  }

  async function disableNotifications() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setMessage(t("settings.browserNoNotifications"));
      return;
    }

    try {
      const subscription = await getCurrentPushSubscription();
      if (!subscription) {
        setNotificationsActive(false);
        setMessage(t("settings.notificationsDisabled"));
        return;
      }

      const result = await deletePushSubscription(subscription);
      await subscription.unsubscribe();
      setNotificationsActive(false);
      setMessage(
        result.mode === "demo"
          ? (result.message ?? t("settings.notificationsDisabled"))
          : t("settings.notificationsDisabled"),
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : t("settings.notificationsSaveError"),
      );
    }
  }

  return {
    notificationsActive,
    enableNotifications,
    disableNotifications,
  };
}
