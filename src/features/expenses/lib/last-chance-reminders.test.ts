import { describe, expect, it } from "vitest";
import { emptyStore } from "@/domain/seed";
import type { ExpenseStore, ExpenseTemplate } from "@/domain/types";
import {
  buildLastChanceReminders,
  buildPushLastChanceReminders,
} from "./last-chance-reminders";

function template(overrides: Partial<ExpenseTemplate>): ExpenseTemplate {
  return {
    id: overrides.id ?? "template-1",
    userId: "user-1",
    name: overrides.name ?? "iCloud",
    description: "",
    amount: overrides.amount ?? 2.99,
    currency: "EUR",
    categoryId: "cat-general",
    startDate: overrides.startDate ?? "2026-06-15",
    dueDay: overrides.dueDay ?? 15,
    recurrence: overrides.recurrence ?? { frequency: "monthly" },
    reminder: overrides.reminder ?? {
      enabled: true,
      daysBeforeCharge: 3,
    },
    active: overrides.active ?? true,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
  };
}

function store(templates: ExpenseTemplate[]): ExpenseStore {
  return {
    ...emptyStore,
    templates,
  };
}

describe("last chance reminders", () => {
  it("honors each expense reminder window from 1 to 5 days", () => {
    const reminders = buildLastChanceReminders(
      store([
        template({
          id: "one-day",
          name: "One day",
          dueDay: 15,
          reminder: { enabled: true, daysBeforeCharge: 1 },
        }),
        template({
          id: "five-days",
          name: "Five days",
          dueDay: 19,
          reminder: { enabled: true, daysBeforeCharge: 5 },
        }),
        template({
          id: "too-far",
          name: "Too far",
          dueDay: 20,
          reminder: { enabled: true, daysBeforeCharge: 5 },
        }),
      ]),
      new Date("2026-06-14T09:00:00"),
    );

    expect(reminders.map((reminder) => reminder.occurrence.template.name)).toEqual([
      "One day",
      "Five days",
    ]);
    expect(reminders.map((reminder) => reminder.daysUntilCharge)).toEqual([1, 5]);
  });

  it("uses the estimated charge date when a due date falls on a weekend", () => {
    const reminders = buildLastChanceReminders(
      store([
        template({
          id: "weekend",
          name: "Weekend",
          startDate: "2026-06-13",
          dueDay: 13,
          reminder: { enabled: true, daysBeforeCharge: 3 },
        }),
      ]),
      new Date("2026-06-12T09:00:00"),
    );

    expect(reminders[0]).toMatchObject({
      daysUntilCharge: 3,
      occurrence: {
        estimatedChargeDate: "2026-06-15",
      },
    });
  });

  it("does not return paid, skipped, disabled or dismissed occurrences", () => {
    const reminders = buildLastChanceReminders(
      {
        ...store([
          template({ id: "paid", name: "Paid" }),
          template({ id: "skipped", name: "Skipped" }),
          template({
            id: "disabled",
            name: "Disabled",
            reminder: { enabled: false, daysBeforeCharge: 3 },
          }),
          template({ id: "dismissed", name: "Dismissed" }),
        ]),
        overrides: [
          {
            id: "override-paid",
            userId: "user-1",
            templateId: "paid",
            occurrenceDate: "2026-06-15",
            status: "paid",
          },
          {
            id: "override-skipped",
            userId: "user-1",
            templateId: "skipped",
            occurrenceDate: "2026-06-15",
            status: "skipped",
          },
          {
            id: "override-dismissed",
            userId: "user-1",
            templateId: "dismissed",
            occurrenceDate: "2026-06-15",
            status: "due",
            reminderDismissedAt: "2026-06-14T09:00:00.000Z",
            reminderDismissedChargeDate: "2026-06-15",
          },
        ],
      },
      new Date("2026-06-14T09:00:00"),
    );

    expect(reminders).toEqual([]);
  });

  it("push reminders only include the day-before window", () => {
    const reminders = buildPushLastChanceReminders(
      store([
        template({ id: "tomorrow", name: "Tomorrow", dueDay: 15 }),
        template({ id: "later", name: "Later", dueDay: 16 }),
      ]),
      new Date("2026-06-14T09:00:00"),
    );

    expect(reminders.map((reminder) => reminder.occurrence.template.name)).toEqual([
      "Tomorrow",
    ]);
  });
});
