import { describe, expect, it } from "vitest";
import {
  DEFAULT_REMINDER_PREFERENCES,
  buildMonthCloseNotice,
  buildOccurrenceReminders,
  buildPaydayNotice,
  countAttentionOccurrences,
  isLongCycleRecurrence,
  leadDayOptions,
  reminderStageFor,
  resolveReminderPreferences,
  resolveTemplateReminder,
  sanitizeReminderPreferences,
  sanitizeTemplateReminder,
  snapLeadDays,
  toggledTemplateReminder,
} from "./reminder-schedule";
import { emptyStore } from "./seed";
import type {
  ExpenseOccurrenceOverride,
  ExpenseStore,
  ExpenseTemplate,
  ReminderPreferences,
} from "./types";

function template(
  id: string,
  dueDay: number,
  overrides: Partial<ExpenseTemplate> = {},
): ExpenseTemplate {
  return {
    id,
    userId: "user",
    name: id,
    description: "",
    amount: 10,
    currency: "EUR",
    categoryId: "cat",
    startDate: "2026-09-01",
    dueDay,
    recurrence: { frequency: "monthly" },
    reminder: { enabled: true, daysBeforeCharge: 3 },
    active: true,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

function storeWith(
  templates: ExpenseTemplate[],
  {
    overrides = [],
    reminders,
  }: {
    overrides?: ExpenseOccurrenceOverride[];
    reminders?: Partial<ReminderPreferences>;
  } = {},
): ExpenseStore {
  return {
    ...emptyStore,
    templates,
    overrides,
    preferences: {
      theme: "vice-afterglow",
      language: "es",
      ...(reminders
        ? { reminders: { ...DEFAULT_REMINDER_PREFERENCES, ...reminders } }
        : {}),
    },
  };
}

function override(
  templateId: string,
  occurrenceDate: string,
  patch: Partial<ExpenseOccurrenceOverride>,
): ExpenseOccurrenceOverride {
  return {
    id: `ovr:${templateId}:${occurrenceDate}`,
    userId: "user",
    templateId,
    occurrenceDate,
    status: "due",
    ...patch,
  };
}

// Lunes 26 de octubre de 2026.
const monday = new Date("2026-10-26T09:00:00");

describe("reminder preferences", () => {
  it("fills defaults, clamps values and keeps unknown keys", () => {
    expect(
      sanitizeReminderPreferences({
        defaultEnabled: true,
        defaultDaysBefore: 99,
        longCycleDaysBefore: "14",
        pushHour: 27,
        timeZone: "Mars/Olympus",
        futureFlag: "kept",
        updatedAt: "2026-10-20T10:00:00.000Z",
      }),
    ).toEqual({
      ...DEFAULT_REMINDER_PREFERENCES,
      defaultEnabled: true,
      defaultDaysBefore: 30,
      longCycleDaysBefore: 14,
      pushHour: 23,
      futureFlag: "kept",
      updatedAt: "2026-10-20T10:00:00.000Z",
    });
    expect(sanitizeReminderPreferences("nope")).toBeUndefined();
    expect(resolveReminderPreferences(emptyStore)).toEqual(DEFAULT_REMINDER_PREFERENCES);
  });

  it("repairs a malformed expense reminder", () => {
    expect(sanitizeTemplateReminder({ enabled: "yes", daysBeforeCharge: 0 })).toEqual({
      enabled: false,
      daysBeforeCharge: 1,
    });
    expect(sanitizeTemplateReminder(null)).toBeUndefined();
  });
});

describe("expense reminder resolution", () => {
  const preferences: ReminderPreferences = {
    ...DEFAULT_REMINDER_PREFERENCES,
    defaultEnabled: true,
    defaultDaysBefore: 2,
    longCycleDaysBefore: 30,
  };

  it("treats quarterly, yearly and long custom cycles as long", () => {
    expect(isLongCycleRecurrence({ frequency: "quarterly" })).toBe(true);
    expect(isLongCycleRecurrence({ frequency: "yearly" })).toBe(true);
    expect(isLongCycleRecurrence({ frequency: "custom", unit: "month", interval: 6 })).toBe(true);
    expect(isLongCycleRecurrence({ frequency: "custom", unit: "year" })).toBe(true);
    expect(isLongCycleRecurrence({ frequency: "custom", unit: "week", interval: 8 })).toBe(false);
    expect(isLongCycleRecurrence({ frequency: "monthly" })).toBe(false);
    expect(leadDayOptions({ frequency: "yearly" })).toEqual([1, 3, 7, 14, 30]);
    expect(leadDayOptions({ frequency: "monthly" })).toEqual([1, 2, 3, 4, 5]);
  });

  it("snaps a lead to the closest one offered for the frequency", () => {
    expect(snapLeadDays({ frequency: "monthly" }, 30)).toBe(5);
    expect(snapLeadDays({ frequency: "monthly" }, 14)).toBe(5);
    expect(snapLeadDays({ frequency: "monthly" }, 4)).toBe(4);
    // A igual distancia de 1 y de 3, la menor.
    expect(snapLeadDays({ frequency: "yearly" }, 2)).toBe(1);
    expect(snapLeadDays({ frequency: "yearly" }, 14)).toBe(14);
    expect(snapLeadDays({ frequency: "yearly" }, 6)).toBe(7);
  });

  it("uses the expense setting first and the default otherwise", () => {
    expect(
      resolveTemplateReminder(template("own", 5, { reminder: { enabled: false, daysBeforeCharge: 4 } }), preferences),
    ).toEqual({ enabled: false, daysBeforeCharge: 4, source: "template" });
    expect(
      resolveTemplateReminder(template("monthly", 5, { reminder: undefined }), preferences),
    ).toEqual({ enabled: true, daysBeforeCharge: 2, source: "default" });
    expect(
      resolveTemplateReminder(
        template("yearly", 5, { reminder: undefined, recurrence: { frequency: "yearly" } }),
        preferences,
      ),
    ).toEqual({ enabled: true, daysBeforeCharge: 30, source: "default" });
  });

  it("turns the bell into the expense's own setting", () => {
    expect(
      toggledTemplateReminder(template("bell", 5, { reminder: undefined }), preferences),
    ).toEqual({ enabled: false, daysBeforeCharge: 2 });
    expect(
      toggledTemplateReminder(
        template("bell", 5, { reminder: { enabled: false, daysBeforeCharge: 4 } }),
        preferences,
      ),
    ).toEqual({ enabled: true, daysBeforeCharge: 4 });
  });

  it("assigns the before, charge day and charge check stages", () => {
    const stages = { onChargeDay: true, askIfCharged: true };
    expect(reminderStageFor(3, 3, stages)).toBe("before");
    expect(reminderStageFor(4, 3, stages)).toBeNull();
    expect(reminderStageFor(0, 3, stages)).toBe("charge_day");
    expect(reminderStageFor(-3, 3, stages)).toBe("charge_check");
    expect(reminderStageFor(-4, 3, stages)).toBeNull();
    // Sin la etapa del día del cargo, ese día sigue siendo "antes".
    expect(reminderStageFor(0, 3, { onChargeDay: false, askIfCharged: true })).toBe("before");
    expect(reminderStageFor(-1, 3, { onChargeDay: true, askIfCharged: false })).toBeNull();
  });
});

describe("buildOccurrenceReminders", () => {
  const stageOf = (store: ExpenseStore) =>
    buildOccurrenceReminders(store, monday).map(
      (reminder) => `${reminder.occurrence.template.id}:${reminder.stage}:${reminder.daysUntilCharge}`,
    );

  it("orders the overdue question, the charge day and the upcoming charges", () => {
    const store = storeWith([
      template("thursday", 29),
      template("today", 26),
      template("friday", 23),
      template("too-old", 22),
      // Sábado 24: el cargo estimado es hoy, lunes.
      template("weekend", 24),
      template("too-far", 30),
    ]);

    expect(stageOf(store)).toEqual([
      "friday:charge_check:-3",
      "weekend:charge_day:0",
      "today:charge_day:0",
      "thursday:before:3",
    ]);
  });

  it("honors the default setting and the long-cycle notice", () => {
    const yearly = template("insurance", 20, {
      reminder: undefined,
      startDate: "2025-11-20",
      recurrence: { frequency: "yearly", annualMonth: 11 },
    });
    const monthly = template("gym", 28, { reminder: undefined });

    expect(stageOf(storeWith([yearly, monthly]))).toEqual([]);
    expect(
      stageOf(
        storeWith([yearly, monthly], {
          reminders: { defaultEnabled: true, defaultDaysBefore: 2, longCycleDaysBefore: 30 },
        }),
      ),
    ).toEqual(["gym:before:2", "insurance:before:25"]);
    expect(
      stageOf(
        storeWith([yearly, monthly], {
          reminders: { defaultEnabled: true, defaultDaysBefore: 1, longCycleDaysBefore: 14 },
        }),
      ),
    ).toEqual([]);
  });

  it("skips paid, inactive and dismissed charges but still asks if a dismissed one was charged", () => {
    const store = storeWith(
      [
        template("paid", 28),
        template("inactive", 28, { active: false }),
        template("dismissed", 27),
        template("dismissed-check", 23),
      ],
      {
        overrides: [
          override("paid", "2026-10-28", { status: "paid", paidAt: "2026-10-25T10:00:00.000Z" }),
          override("dismissed", "2026-10-27", { reminderDismissedChargeDate: "2026-10-27" }),
          override("dismissed-check", "2026-10-23", {
            reminderDismissedChargeDate: "2026-10-23",
          }),
        ],
      },
    );

    expect(stageOf(store)).toEqual(["dismissed-check:charge_check:-3"]);
  });

  it("follows a charge moved to another day", () => {
    const store = storeWith([template("moved", 15)], {
      overrides: [override("moved", "2026-10-15", { dueDate: "2026-10-27" })],
    });

    expect(stageOf(store)).toEqual(["moved:before:1"]);
  });

  it("drops the stages turned off in the settings", () => {
    const store = storeWith([template("today", 26), template("friday", 23)], {
      reminders: { onChargeDay: false, askIfCharged: false },
    });

    expect(stageOf(store)).toEqual(["today:before:0"]);
  });

  it("still asks if a charge pushed back by bank holidays was charged", () => {
    const stagesOn = (store: ExpenseStore, day: string) =>
      buildOccurrenceReminders(store, new Date(`${day}T09:00:00`)).map(
        (reminder) => `${reminder.occurrence.dueDate}:${reminder.stage}:${reminder.daysUntilCharge}`,
      );
    // Jueves Santo de 2026: se cobra el martes 7, tras el Lunes de Pascua.
    const holyThursday = storeWith([template("holy", 2, { startDate: "2026-03-02" })]);
    expect(stagesOn(holyThursday, "2026-04-07")).toEqual(["2026-04-02:charge_day:0"]);
    expect(stagesOn(holyThursday, "2026-04-08")).toEqual(["2026-04-02:charge_check:-1"]);
    expect(stagesOn(holyThursday, "2026-04-10")).toEqual(["2026-04-02:charge_check:-3"]);
    expect(stagesOn(holyThursday, "2026-04-11")).toEqual([]);
    // 1 de mayo en viernes: se cobra el lunes 4.
    const labourDay = storeWith([template("labour", 1, { startDate: "2026-04-01" })]);
    expect(stagesOn(labourDay, "2026-05-07")).toEqual(["2026-05-01:charge_check:-3"]);
  });
});

describe("account notices", () => {
  const settled = (overrides: ExpenseOccurrenceOverride[]) =>
    storeWith([template("rent", 1), template("gym", 12)], {
      overrides: [
        override("rent", "2026-09-01", { status: "paid" }),
        override("gym", "2026-09-12", { status: "paid" }),
        ...overrides,
      ],
    });

  it("suggests closing the month once everything is paid near its end", () => {
    const store = settled([
      override("rent", "2026-10-01", { status: "paid" }),
      override("gym", "2026-10-12", { status: "paid" }),
    ]);

    expect(buildMonthCloseNotice(store, "2026-10-26")).toEqual({
      monthId: "2026-10",
      nextMonthId: "2026-11",
      paidCount: 2,
    });
    // Aún falta mucho para fin de mes y no hay cobro configurado.
    expect(buildMonthCloseNotice(store, "2026-10-13")).toBeNull();
    // Ya se pasó al mes siguiente.
    expect(
      buildMonthCloseNotice(
        {
          ...store,
          finance: {
            ...store.finance,
            monthClosures: {
              "2026-10": {
                closedAt: "2026-10-26T08:00:00.000Z",
                updatedAt: "2026-10-26T08:00:00.000Z",
              },
            },
          },
        },
        "2026-10-26",
      ),
    ).toBeNull();
  });

  it("does not suggest closing a month with pending charges", () => {
    const store = settled([override("rent", "2026-10-01", { status: "paid" })]);
    expect(buildMonthCloseNotice(store, "2026-10-26")).toBeNull();
  });

  it("announces payday with what is left to pay", () => {
    const store: ExpenseStore = {
      ...settled([override("rent", "2026-10-01", { status: "paid" })]),
      finance: {
        ...emptyStore.finance,
        monthlySalary: { "2026-10": { amount: 2000, dayOfMonth: 28 } },
      },
    };

    expect(buildPaydayNotice(store, "2026-10-27")).toBeNull();
    expect(buildPaydayNotice(store, "2026-10-28")).toEqual({
      monthId: "2026-10",
      pendingCount: 1,
      pendingTotal: 10,
    });
  });

  it("moves payday to the last day of a shorter month", () => {
    const store: ExpenseStore = {
      ...storeWith([]),
      finance: {
        ...emptyStore.finance,
        monthlySalary: { "2026-10": { amount: 2000, dayOfMonth: 31 } },
      },
    };

    expect(buildPaydayNotice(store, "2026-11-30")).toMatchObject({ monthId: "2026-11" });
    expect(buildPaydayNotice(store, "2026-11-29")).toBeNull();
  });

  it("announces the payday that opens a payday-anchored month", () => {
    const store: ExpenseStore = {
      ...storeWith([template("rent", 1), template("gym", 12)]),
      finance: {
        ...emptyStore.finance,
        monthlySalary: { "2026-09": { amount: 2000, dayOfMonth: 28 } },
        budgetCycle: { anchor: "payday", updatedAt: "2026-10-01T00:00:00.000Z" },
      },
    };

    expect(buildPaydayNotice(store, "2026-10-27")).toBeNull();
    // "Noviembre" va del 28 de octubre al 27 de noviembre: alquiler y gimnasio.
    expect(buildPaydayNotice(store, "2026-10-28")).toEqual({
      monthId: "2026-11",
      pendingCount: 2,
      pendingTotal: 20,
    });
  });

  it("skips payday without a configured salary", () => {
    expect(buildPaydayNotice(storeWith([]), "2026-10-28")).toBeNull();
  });
});

describe("countAttentionOccurrences", () => {
  it("counts overdue charges since last month and those due today", () => {
    const store = storeWith(
      [template("rent", 1), template("gym", 26), template("later", 28)],
      {
        overrides: [override("rent", "2026-10-01", { status: "paid" })],
      },
    );

    // Septiembre entero sin pagar (3) y el gimnasio de hoy; el de pasado
    // mañana aún no cuenta.
    expect(countAttentionOccurrences(store, monday)).toBe(4);
  });

  it("ignores charges of deleted expenses", () => {
    expect(countAttentionOccurrences(storeWith([]), monday)).toBe(0);
  });

  it("looks back to the previous budget month with the payday cycle", () => {
    const paydayStore = (dayOfMonth: number, templates: ExpenseTemplate[]): ExpenseStore => {
      const base = storeWith(templates);
      return {
        ...base,
        finance: {
          ...base.finance,
          monthlySalary: { "2026-01": { amount: 2000, dayOfMonth } },
          budgetCycle: { anchor: "payday", updatedAt: "2026-01-01T00:00:00.000Z" },
        },
      };
    };

    // Cobro el 28: el 5 de noviembre es "noviembre" (28 oct - 27 nov) y el
    // mes anterior empieza el 28 de septiembre, con el recibo del 29.
    const late = paydayStore(28, [template("internet", 29, { startDate: "2026-09-29" })]);
    expect(countAttentionOccurrences(late, new Date("2026-11-05T12:00:00"))).toBe(2);
    // Cobro el 5: el 10 de noviembre el mes anterior va del 5 de octubre al 4
    // de noviembre; el recibo del 2 de octubre ya no sale en Gastos.
    const early = paydayStore(5, [template("phone", 2, { startDate: "2026-09-02" })]);
    expect(countAttentionOccurrences(early, new Date("2026-11-10T12:00:00"))).toBe(1);
  });
});
