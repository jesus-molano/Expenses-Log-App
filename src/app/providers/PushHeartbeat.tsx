"use client";

import { usePushHeartbeat } from "@/features/settings/hooks/use-push-heartbeat";

export function PushHeartbeat() {
  usePushHeartbeat();
  return null;
}
