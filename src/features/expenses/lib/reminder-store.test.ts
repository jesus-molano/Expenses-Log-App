import { describe, expect, it } from "vitest";
import { DEFAULT_REMINDER_PREFERENCES } from "@/domain/reminder-schedule";
import type {
  ExpenseStore,
  ExpenseTemplate,
  ReminderPreferences,
} from "@/domain/types";
import { planUserReminders } from "./reminder-notifications";
import { toReminderStore } from "./reminder-store";

function template(overrides: Partial<ExpenseTemplate> = {}): ExpenseTemplate {
  return {
    id: "template-1",
    userId: "user-1",
    name: "Spotify",
    description: "",
    amount: 10,
    currency: "EUR",
    categoryId: "cat-general",
    startDate: "2026-06-12",
    dueDay: 12,
    recurrence: { frequency: "monthly" },
    reminder: { enabled: true, daysBeforeCharge: 2 },
    active: true,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

// Un gasto sin aviso propio: sigue el aviso por defecto de Ajustes.
function withoutReminder(overrides: Partial<ExpenseTemplate> = {}): ExpenseTemplate {
  const value = template(overrides);
  delete value.reminder;
  return value;
}

function store(
  templates: ExpenseTemplate[],
  reminders?: Partial<ReminderPreferences>,
): ExpenseStore {
  return {
    schemaVersion: 3,
    categories: [],
    templates,
    overrides: [],
    finance: {
      incomeEvents: [],
      monthlySalary: {},
      monthlySavingsTargets: {},
    },
    preferences: {
      theme: "vice-afterglow",
      language: "es",
      ...(reminders
        ? { reminders: { ...DEFAULT_REMINDER_PREFERENCES, ...reminders } }
        : {}),
    },
  };
}

// Jueves 11 de junio, 09:00 en Canarias: pasada la hora de aviso por defecto.
const today = new Date("2026-06-11T08:00:00.000Z");

describe("toReminderStore", () => {
  it("rejects values that are not a store", () => {
    expect(toReminderStore(null, today)).toBeNull();
    expect(toReminderStore("store", today)).toBeNull();
    expect(toReminderStore([], today)).toBeNull();
    expect(toReminderStore({ templates: [] }, today)).toBeNull();
    expect(toReminderStore({ templates: "x", overrides: [] }, today)).toBeNull();
  });

  it("keeps only well-formed templates, whatever their reminder", () => {
    const result = toReminderStore(
      {
        templates: [
          template({ id: "valid" }),
          // Sin aviso o con él apagado no avisan, pero cuentan para el mes al
          // día, el día de cobro y el número del icono.
          template({ id: "off", reminder: { enabled: false, daysBeforeCharge: 2 } }),
          withoutReminder({ id: "default" }),
          template({ id: "inactive", active: false }),
          { ...template({ id: "no-recurrence" }), recurrence: null },
          { ...template({ id: "bad-frequency" }), recurrence: { frequency: "daily" } },
          { ...template({ id: "bad-start" }), startDate: "2026-13-01" },
          { ...template({ id: "bad-end" }), endDate: "soon" },
          { ...template({ id: "bad-day" }), dueDay: "12" },
          { ...template({ id: "bad-amount" }), amount: "10" },
          { ...template({ id: "bad-active" }), active: "yes" },
          { ...template({ id: 7 as unknown as string }) },
          "template",
          null,
        ],
        overrides: [],
      },
      today,
    );

    expect(result?.templates.map((item) => item.id)).toEqual([
      "valid",
      "off",
      "default",
      "inactive",
    ]);
  });

  it("reads a template's own reminder with the app's rules", () => {
    const result = toReminderStore(
      {
        templates: [
          { ...template({ id: "incomplete" }), reminder: { enabled: true } },
          { ...template({ id: "unreadable" }), reminder: "yes" },
        ],
        overrides: [],
      },
      today,
    );

    expect(result?.templates[0].reminder).toEqual({ enabled: true, daysBeforeCharge: 3 });
    // Un aviso ilegible se descarta y el gasto sigue el de Ajustes.
    expect(result?.templates[1]).not.toHaveProperty("reminder");
  });

  it("reminds a template without its own reminder when reminders are on by default", () => {
    const templates = [
      withoutReminder({ id: "netflix", name: "Netflix" }),
      template({
        id: "gym",
        name: "Gym",
        reminder: { enabled: false, daysBeforeCharge: 2 },
      }),
    ];
    const kindsFor = (reminders: Partial<ReminderPreferences>) =>
      planUserReminders(toReminderStore(store(templates, reminders), today)!, today)
        ?.candidates.map((candidate) =>
          "reminder" in candidate
            ? `${candidate.kind}:${candidate.reminder.occurrence.template.id}`
            : candidate.kind,
        );

    expect(kindsFor({ defaultEnabled: true })).toEqual(["last_chance:netflix"]);
    expect(kindsFor({ defaultEnabled: false })).toEqual([]);
  });

  it("drops unusable overrides and strips unreadable moved dates", () => {
    const result = toReminderStore(
      {
        templates: [template({ id: "spotify" })],
        overrides: [
          {
            id: "ovr:spotify:2026-06-12",
            templateId: "spotify",
            occurrenceDate: "2026-06-12",
            status: "paid",
            dueDate: "never",
            name: 42,
            amount: "12",
          },
          { templateId: "spotify", occurrenceDate: "12/06/2026", status: "due" },
          { templateId: "spotify", occurrenceDate: "2026-07-12", status: "done" },
          { occurrenceDate: "2026-07-12", status: "due" },
          "override",
        ],
        preferences: { language: "en" },
      },
      today,
    );

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

  it("keeps only readable occurrence records", () => {
    const record = {
      id: "record:spotify:2026-05-12",
      userId: "user-1",
      templateId: "spotify",
      occurrenceDate: "2026-05-12",
      monthId: "2026-05",
      dueDate: "2026-05-12",
      name: "Spotify",
      description: "",
      plannedAmount: 10,
      currency: "EUR",
      categoryId: "cat-general",
      categoryName: "General",
      status: "paid",
      sortOrder: 0,
      source: "native",
      createdAt: "2026-05-12T00:00:00.000Z",
      updatedAt: "2026-05-12T00:00:00.000Z",
    };
    const result = toReminderStore(
      {
        ...store([template({ id: "spotify" })]),
        occurrenceRecords: [
          record,
          { ...record, id: "record:spotify:2026-04-12", occurrenceDate: "2026-04-12", dueDate: "nope" },
          { ...record, id: "record:spotify:2026-03-12", occurrenceDate: 12 },
          { ...record, id: "record:spotify:2026-02-12", plannedAmount: "10" },
          null,
          "record",
        ],
      },
      today,
    );

    expect(result?.occurrenceRecords?.map((item) => item.id)).toEqual([
      "record:spotify:2026-05-12",
    ]);
  });

  it("plans the same reminders as the full store for valid data", () => {
    const full = store([template({ id: "spotify", name: "Spotify", dueDay: 12 })]);

    expect(planUserReminders(toReminderStore(full, today)!, today)).toEqual(
      planUserReminders(full, today),
    );
    expect(planUserReminders(full, today)?.candidates).toHaveLength(1);
  });

  it("keeps a paid override with a broken moved date from reminding again", () => {
    const reminderStore = toReminderStore(
      {
        ...store([template({ id: "spotify", name: "Spotify", dueDay: 12 })]),
        overrides: [
          {
            id: "ovr:spotify:2026-06-12",
            userId: "user-1",
            templateId: "spotify",
            occurrenceDate: "2026-06-12",
            status: "paid",
            dueDate: "2026-06-99",
          },
        ],
      },
      today,
    );

    expect(planUserReminders(reminderStore!, today)?.candidates).toEqual([]);
  });
});
