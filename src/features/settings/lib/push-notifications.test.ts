import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchPushHealth,
  PushApiError,
  sendPushTest,
  urlBase64ToUint8Array,
} from "./push-notifications";

const subscription = {
  endpoint: "https://push.example.test/device",
} as PushSubscription;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("urlBase64ToUint8Array", () => {
  it("decodes URL-safe base64 values", () => {
    const atobSpy = vi
      .spyOn(window, "atob")
      .mockImplementation((value) => Buffer.from(value, "base64").toString("binary"));

    const output = urlBase64ToUint8Array("SGVsbG8td29ybGQ");

    expect(Array.from(output)).toEqual(
      Array.from("Hello-world", (character) => character.charCodeAt(0)),
    );
    atobSpy.mockRestore();
  });
});

describe("push API client", () => {
  it("reads registration health for the current endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          mode: "ready",
          registered: true,
          subscriptionUpdatedAt: "2026-08-23T10:00:00.000Z",
          lastScheduledDeliveryAt: "2026-08-23T08:00:00.000Z",
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchPushHealth(subscription)).resolves.toMatchObject({
      mode: "ready",
      registered: true,
      lastScheduledDeliveryAt: "2026-08-23T08:00:00.000Z",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/push/status",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      }),
    );
  });

  it("sends only the endpoint when requesting a test", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ ok: true, sentAt: "2026-08-23T11:00:00.000Z" }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendPushTest(subscription)).resolves.toEqual({
      ok: true,
      sentAt: "2026-08-23T11:00:00.000Z",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/push/test",
      expect.objectContaining({
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      }),
    );
  });

  it("keeps the stable server error code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: "PUSH_SUBSCRIPTION_EXPIRED" }), {
          status: 409,
        }),
      ),
    );

    await expect(sendPushTest(subscription)).rejects.toEqual(
      expect.objectContaining<Partial<PushApiError>>({
        code: "PUSH_SUBSCRIPTION_EXPIRED",
        status: 409,
      }),
    );
  });
});
