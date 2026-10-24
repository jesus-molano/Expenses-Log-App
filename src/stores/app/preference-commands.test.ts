import { describe, expect, it } from "vitest";
import { DEFAULT_REMINDER_PREFERENCES } from "@/domain/reminder-schedule";
import { emptyStore } from "@/domain/seed";
import type { ExpenseStore, ExpenseTemplate } from "@/domain/types";
import { setTemplateReminderInStore } from "./expense-commands";
import {
  updateLanguageInStore,
  updateReminderPreferencesInStore,
  updateThemeInStore,
} from "./preference-commands";

const template: ExpenseTemplate = {
  id: "exp-netflix",
  userId: "user",
  name: "Netflix",
  description: "",
  amount: 12.99,
  currency: "EUR",
  categoryId: "subs",
  startDate: "2026-09-05",
  dueDay: 5,
  recurrence: { frequency: "monthly" },
  active: true,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

describe("reminder commands", () => {
  it("starts from the defaults and stamps the change", () => {
    const store = updateReminderPreferencesInStore(
      emptyStore,
      { defaultEnabled: true, pushHour: 21, timeZone: "Europe/Madrid" },
      new Date("2026-10-23T18:00:00.000Z"),
    );

    expect(store.preferences?.reminders).toEqual({
      ...DEFAULT_REMINDER_PREFERENCES,
      defaultEnabled: true,
      pushHour: 21,
      timeZone: "Europe/Madrid",
      updatedAt: "2026-10-23T18:00:00.000Z",
    });
  });

  it("keeps earlier changes and repairs impossible values", () => {
    const first = updateReminderPreferencesInStore(
      emptyStore,
      { payday: true },
      new Date("2026-10-23T18:00:00.000Z"),
    );
    const second = updateReminderPreferencesInStore(
      first,
      { pushHour: 40, timeZone: "Nowhere/Land" },
      new Date("2026-10-23T19:00:00.000Z"),
    );

    expect(second.preferences?.reminders).toMatchObject({
      payday: true,
      pushHour: 23,
      timeZone: DEFAULT_REMINDER_PREFERENCES.timeZone,
      updatedAt: "2026-10-23T19:00:00.000Z",
    });
  });

  it("keeps the reminder settings when the theme or language change", () => {
    const store = updateReminderPreferencesInStore(emptyStore, { monthClose: true });
    const themed = updateLanguageInStore(updateThemeInStore(store, "nord"), "en");

    expect(themed.preferences).toMatchObject({
      theme: "nord",
      language: "en",
      reminders: { monthClose: true },
    });
  });

  it("sets and clears an expense's own reminder", () => {
    const store: ExpenseStore = { ...emptyStore, templates: [template] };
    const withBell = setTemplateReminderInStore(store, template.id, {
      enabled: true,
      daysBeforeCharge: 2,
    });

    expect(withBell.templates[0]).toMatchObject({
      reminder: { enabled: true, daysBeforeCharge: 2 },
      name: "Netflix",
      dueDay: 5,
    });
    expect(withBell.templates[0].updatedAt > template.updatedAt).toBe(true);

    const cleared = setTemplateReminderInStore(withBell, template.id, undefined);
    expect(cleared.templates[0].reminder).toBeUndefined();
    expect(JSON.parse(JSON.stringify(cleared.templates[0]))).not.toHaveProperty("reminder");
    expect(setTemplateReminderInStore(store, "missing", undefined)).toBe(store);
  });
});
