import { describe, expect, it } from "vitest";
import {
  groupDeliverablePushSubscriptions,
  isAllowedPushEndpoint,
  MAX_PUSH_ENDPOINT_LENGTH,
  MAX_PUSH_SUBSCRIPTIONS_PER_USER,
  pushEndpointsToEvict,
} from "./push-endpoints";

describe("isAllowedPushEndpoint", () => {
  it.each([
    "https://fcm.googleapis.com/fcm/send/dQw4w9WgXcQ:APA91bH-abc_123",
    "https://fcm.googleapis.com/wp/dQw4w9WgXcQ:APA91bH",
    "https://updates.push.services.mozilla.com/wpush/v2/gAAAAABl-abc_123",
    "https://web.push.apple.com/QFzF2jvQ-abc_123",
    "https://wns2-par02p.notify.windows.com/w/?token=BQYAAAB%2bAbc%3d",
    "https://FCM.googleapis.com/fcm/send/abc",
  ])("accepts the browser push service %s", (endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(true);
  });

  it.each([
    ["http", "http://fcm.googleapis.com/fcm/send/abc"],
    ["other host", "https://push.example.test/device"],
    ["internal host", "https://169.254.169.254/latest/meta-data"],
    ["localhost", "https://localhost/fcm/send/abc"],
    ["legacy GCM", "https://android.googleapis.com/gcm/send/abc"],
    ["host suffix without dot", "https://evilpush.apple.com/abc"],
    ["bare apple domain", "https://push.apple.com/abc"],
    ["lookalike host", "https://fcm.googleapis.com.evil.test/abc"],
    ["trailing dot", "https://fcm.googleapis.com./fcm/send/abc"],
    ["userinfo", "https://fcm.googleapis.com@evil.test/abc"],
    ["userinfo before host", "https://evil.test@fcm.googleapis.com/abc"],
    ["explicit port", "https://fcm.googleapis.com:8443/abc"],
    ["default port", "https://fcm.googleapis.com:443/abc"],
    ["backslash", "https://fcm.googleapis.com\\@evil.test/abc"],
    ["tab", "https://fcm.googleapis.com/fcm/\tsend"],
    ["newline", "https://fcm.googleapis.com/fcm/send\n/abc"],
    ["space", "https://fcm.googleapis.com/fcm send"],
    ["revoked Chrome sentinel", "https://permanently-removed.invalid/fcm/send/abc"],
    ["not a url", "not-a-url"],
  ])("rejects %s", (_label, endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(false);
  });

  it("rejects values that are not strings or are too long", () => {
    expect(isAllowedPushEndpoint(undefined)).toBe(false);
    expect(isAllowedPushEndpoint(42)).toBe(false);
    expect(
      isAllowedPushEndpoint(
        `https://fcm.googleapis.com/${"a".repeat(MAX_PUSH_ENDPOINT_LENGTH)}`,
      ),
    ).toBe(false);
  });
});

describe("pushEndpointsToEvict", () => {
  const stored = Array.from(
    { length: MAX_PUSH_SUBSCRIPTIONS_PER_USER },
    (_, index) => ({
      endpoint: `https://fcm.googleapis.com/fcm/send/${index}`,
      updated_at: `2026-10-${String(index + 1).padStart(2, "0")}T08:00:00.000Z`,
    }),
  );

  it("keeps everything below the limit", () => {
    expect(
      pushEndpointsToEvict(stored.slice(0, 9), "https://fcm.googleapis.com/new"),
    ).toEqual([]);
  });

  it("evicts the least recently updated device to make room", () => {
    expect(pushEndpointsToEvict(stored, "https://fcm.googleapis.com/new")).toEqual([
      "https://fcm.googleapis.com/fcm/send/0",
    ]);
    expect(
      pushEndpointsToEvict(
        [...stored, { endpoint: "https://fcm.googleapis.com/old", updated_at: "2026-01-01T00:00:00.000Z" }],
        "https://fcm.googleapis.com/new",
      ),
    ).toEqual([
      "https://fcm.googleapis.com/fcm/send/0",
      "https://fcm.googleapis.com/old",
    ]);
  });

  it("does not count a device that is saved again", () => {
    expect(pushEndpointsToEvict(stored, stored[0].endpoint)).toEqual([]);
  });
});

describe("groupDeliverablePushSubscriptions", () => {
  function row(user: string, endpoint: string, updatedAt: string) {
    return { user_id: user, endpoint, updated_at: updatedAt };
  }

  it("groups by user, skips blocked hosts and keeps the most recent devices", () => {
    const rows = [
      row("a", "https://fcm.googleapis.com/fcm/send/old", "2026-01-01T00:00:00.000Z"),
      row("a", "https://fcm.googleapis.com/fcm/send/new", "2026-03-01T00:00:00.000Z"),
      row("a", "https://web.push.apple.com/mid", "2026-02-01T00:00:00.000Z"),
      row("a", "https://internal.example.test/hook", "2026-04-01T00:00:00.000Z"),
      row("b", "https://updates.push.services.mozilla.com/wpush/v2/b", "2026-01-01T00:00:00.000Z"),
    ];

    const { byUser, blocked } = groupDeliverablePushSubscriptions(rows, 2);

    expect(blocked).toBe(1);
    expect(byUser.get("a")?.map((item) => item.endpoint)).toEqual([
      "https://fcm.googleapis.com/fcm/send/new",
      "https://web.push.apple.com/mid",
    ]);
    expect(byUser.get("b")).toHaveLength(1);
  });
});
