import { describe, expect, it } from "vitest";
import type { ExpenseStore, ExpenseTemplate } from "@/domain/types";
import {
  buildDailyReminder,
  dailyReminderBody,
  dailyReminderTitle,
  toReminderStore,
} from "./daily-reminders";

function template(overrides: Partial<ExpenseTemplate>): ExpenseTemplate {
  return {
    id: overrides.id ?? "template-1",
    userId: "user-1",
    name: overrides.name ?? "Spotify",
    description: "",
    amount: overrides.amount ?? 10,
    currency: "EUR",
    categoryId: "cat-general",
    startDate: overrides.startDate ?? "2026-06-12",
    dueDay: overrides.dueDay ?? 12,
    recurrence: overrides.recurrence ?? { frequency: "monthly" },
    reminder: overrides.reminder ?? {
      enabled: true,
      daysBeforeCharge: 2,
    },
    active: overrides.active ?? true,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
  };
}

function store(templates: ExpenseTemplate[]): ExpenseStore {
  return {
    categories: [],
    templates,
    overrides: [],
    finance: {
      incomeEvents: [],
      monthlySalary: {},
      monthlySavingsTargets: {},
    },
  };
}

describe("daily reminders", () => {
  it("returns expenses inside their configured push window", () => {
    const reminder = buildDailyReminder(
      store([
        template({ id: "spotify", name: "Spotify", dueDay: 12 }),
        template({ id: "netflix", name: "Netflix", dueDay: 15 }),
      ]),
      new Date("2026-06-11T08:00:00"),
    );

    expect(reminder?.occurrences.map((item) => item.template.name)).toEqual([
      "Spotify",
    ]);
    expect(dailyReminderTitle(reminder!)).toBe("Revisa este cobro");
    expect(dailyReminderBody(reminder!)).toBe("Spotify se cobrará pronto.");
  });

  it("catches up before the charge when the configured day was missed", () => {
    const reminder = buildDailyReminder(
      store([
        template({
          id: "insurance",
          name: "Seguro",
          dueDay: 15,
          reminder: { enabled: true, daysBeforeCharge: 5 },
        }),
      ]),
      new Date("2026-06-13T08:00:00"),
    );

    expect(reminder?.occurrences.map((item) => item.template.name)).toEqual([
      "Seguro",
    ]);
  });

  it("does not remind paid occurrences", () => {
    const reminder = buildDailyReminder(
      {
        ...store([template({ id: "spotify", name: "Spotify", dueDay: 12 })]),
        overrides: [
          {
            id: "override-1",
            userId: "user-1",
            templateId: "spotify",
            occurrenceDate: "2026-06-12",
            status: "paid",
          },
        ],
      },
      new Date("2026-06-11T08:00:00"),
    );

    expect(reminder).toBeNull();
  });

  it("does not remind dismissed occurrences", () => {
    const reminder = buildDailyReminder(
      {
        ...store([template({ id: "spotify", name: "Spotify", dueDay: 12 })]),
        overrides: [
          {
            id: "override-1",
            userId: "user-1",
            templateId: "spotify",
            occurrenceDate: "2026-06-12",
            status: "due",
            reminderDismissedAt: "2026-06-11T09:00:00.000Z",
            reminderDismissedChargeDate: "2026-06-12",
          },
        ],
      },
      new Date("2026-06-11T08:00:00"),
    );

    expect(reminder).toBeNull();
  });
});

describe("toReminderStore", () => {
  it("rejects values that are not a store", () => {
    expect(toReminderStore(null)).toBeNull();
    expect(toReminderStore("store")).toBeNull();
    expect(toReminderStore([])).toBeNull();
    expect(toReminderStore({ templates: [] })).toBeNull();
    expect(toReminderStore({ templates: "x", overrides: [] })).toBeNull();
  });

  it("keeps only active, well-formed templates with the reminder on", () => {
    const valid = template({ id: "valid" });
    const result = toReminderStore({
      templates: [
        valid,
        template({ id: "off", reminder: { enabled: false, daysBeforeCharge: 2 } }),
        template({ id: "inactive", active: false }),
        { ...template({ id: "no-recurrence" }), recurrence: null },
        { ...template({ id: "bad-frequency" }), recurrence: { frequency: "daily" } },
        { ...template({ id: "bad-start" }), startDate: "2026-13-01" },
        { ...template({ id: "bad-end" }), endDate: "soon" },
        { ...template({ id: "bad-day" }), dueDay: "12" },
        { ...template({ id: "bad-reminder" }), reminder: { enabled: true } },
        { ...template({ id: 7 as unknown as string }) },
        "template",
        null,
      ],
      overrides: [],
    });

    expect(result?.templates.map((item) => item.id)).toEqual(["valid"]);
  });

  it("drops unusable overrides and strips unreadable moved dates", () => {
    const result = toReminderStore({
      templates: [template({ id: "spotify" })],
      overrides: [
        {
          id: "ovr:spotify:2026-06-12",
          templateId: "spotify",
          occurrenceDate: "2026-06-12",
          status: "paid",
          dueDate: "never",
          name: 42,
        },
        { templateId: "spotify", occurrenceDate: "12/06/2026", status: "due" },
        { templateId: "spotify", occurrenceDate: "2026-07-12", status: "done" },
        { occurrenceDate: "2026-07-12", status: "due" },
        "override",
      ],
      preferences: { language: "en" },
    });

    expect(result?.overrides).toEqual([
      {
        id: "ovr:spotify:2026-06-12",
        templateId: "spotify",
        occurrenceDate: "2026-06-12",
        status: "paid",
      },
    ]);
    expect(result?.preferences?.language).toBe("en");
  });

  it("builds the same reminder as the full store for valid data", () => {
    const full = store([template({ id: "spotify", name: "Spotify", dueDay: 12 })]);
    const today = new Date("2026-06-11T08:00:00");

    expect(buildDailyReminder(toReminderStore(full)!, today)).toEqual(
      buildDailyReminder(full, today),
    );
  });

  it("keeps a paid override with a broken moved date from reminding again", () => {
    const reminderStore = toReminderStore({
      ...store([template({ id: "spotify", name: "Spotify", dueDay: 12 })]),
      overrides: [
        {
          id: "override-1",
          userId: "user-1",
          templateId: "spotify",
          occurrenceDate: "2026-06-12",
          status: "paid",
          dueDate: "2026-06-99",
        },
      ],
    });

    expect(
      buildDailyReminder(reminderStore!, new Date("2026-06-11T08:00:00")),
    ).toBeNull();
  });
});
