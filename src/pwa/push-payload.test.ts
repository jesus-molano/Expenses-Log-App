import { describe, expect, it } from "vitest";
import { parsePushPayload, resolveNotificationUrl } from "./push-payload";

describe("parsePushPayload", () => {
  it("keeps a complete payload", () => {
    expect(
      parsePushPayload({
        title: "Netflix se cobra mañana",
        body: "12,99 €",
        url: "/?occurrence=netflix%3A2026-10-27",
        tag: "last_chance:netflix:2026-10-27",
        badgeCount: 2,
        lang: "es",
      }),
    ).toEqual({
      title: "Netflix se cobra mañana",
      body: "12,99 €",
      url: "/?occurrence=netflix%3A2026-10-27",
      tag: "last_chance:netflix:2026-10-27",
      badgeCount: 2,
      lang: "es",
    });
  });

  it("still shows a notification with an unreadable payload", () => {
    expect(parsePushPayload(undefined)).toEqual({
      title: "Expense Reminders",
      body: "Tienes gastos por revisar.",
      url: "/",
    });
    expect(parsePushPayload({ title: "  ", badgeCount: -1, lang: "fr", tag: 3 })).toEqual({
      title: "Expense Reminders",
      body: "Tienes gastos por revisar.",
      url: "/",
    });
  });
});

describe("resolveNotificationUrl", () => {
  const origin = "https://app.example.test";

  it("opens same-origin routes and falls back to the app for anything else", () => {
    expect(resolveNotificationUrl("/money", origin)).toBe(`${origin}/money`);
    expect(resolveNotificationUrl("https://evil.example/", origin)).toBe(`${origin}/`);
    expect(resolveNotificationUrl("//evil.example/x", origin)).toBe(`${origin}/`);
    expect(resolveNotificationUrl(undefined, origin)).toBe(`${origin}/`);
  });
});
