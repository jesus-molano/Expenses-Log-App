import { describe, expect, it } from "vitest";
import {
  applicationServerKeyMatches,
  buildSubscriptionRenewal,
  urlBase64ToUint8Array,
} from "./push-subscription";

const publicKey = "SGVsbG8td29ybGQ";

describe("push subscription helpers", () => {
  it("compares the subscription key with the server key", () => {
    const sameKey = urlBase64ToUint8Array(publicKey).buffer;
    const otherKey = urlBase64ToUint8Array("T3RoZXIta2V5").buffer;

    expect(applicationServerKeyMatches(sameKey, publicKey)).toBe(true);
    expect(applicationServerKeyMatches(otherKey, publicKey)).toBe(false);
    // Sin clave legible no se puede saber: se da por buena.
    expect(applicationServerKeyMatches(null, publicKey)).toBe(true);
  });

  it("only sends the previous endpoint when it changed", () => {
    const keys = { p256dh: "p", auth: "a" };
    expect(buildSubscriptionRenewal({ endpoint: "https://push/new", keys }, "https://push/old")).toEqual({
      endpoint: "https://push/new",
      keys,
      previousEndpoint: "https://push/old",
    });
    expect(buildSubscriptionRenewal({ endpoint: "https://push/same", keys }, "https://push/same")).toEqual({
      endpoint: "https://push/same",
      keys,
    });
    expect(buildSubscriptionRenewal({ keys })).toBeNull();
  });
});
