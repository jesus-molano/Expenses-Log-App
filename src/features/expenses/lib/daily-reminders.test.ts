import { describe, expect, it } from "vitest";
import type { ExpenseStore, ExpenseTemplate } from "@/domain/types";
import {
  buildDailyReminder,
  dailyReminderBody,
  dailyReminderTitle,
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
