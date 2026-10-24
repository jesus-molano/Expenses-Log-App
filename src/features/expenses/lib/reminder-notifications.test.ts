import { describe, expect, it } from "vitest";
import { formatCurrency } from "@/domain/calendar";
import { DEFAULT_REMINDER_PREFERENCES } from "@/domain/reminder-schedule";
import { emptyStore } from "@/domain/seed";
import type {
  AppLanguage,
  ExpenseOccurrenceOverride,
  ExpenseStore,
  ExpenseTemplate,
  ReminderPreferences,
} from "@/domain/types";
import {
  REMINDER_TTL_SECONDS,
  buildReminderDeliveryKey,
  buildReminderNotifications,
  joinNames,
  planUserReminders,
  relativeDay,
} from "./reminder-notifications";

function template(
  id: string,
  name: string,
  dueDay: number,
  amount = 10,
): ExpenseTemplate {
  return {
    id,
    userId: "user",
    name,
    description: "",
    amount,
    currency: "EUR",
    categoryId: "cat",
    startDate: "2026-09-01",
    dueDay,
    recurrence: { frequency: "monthly" },
    reminder: { enabled: true, daysBeforeCharge: 3 },
    active: true,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
}

function storeWith(
  templates: ExpenseTemplate[],
  {
    language = "es",
    reminders = {},
    overrides = [],
    finance = emptyStore.finance,
  }: {
    language?: AppLanguage;
    reminders?: Partial<ReminderPreferences>;
    overrides?: ExpenseOccurrenceOverride[];
    finance?: ExpenseStore["finance"];
  } = {},
): ExpenseStore {
  return {
    ...emptyStore,
    templates,
    overrides,
    finance,
    preferences: {
      theme: "vice-afterglow",
      language,
      reminders: { ...DEFAULT_REMINDER_PREFERENCES, ...reminders },
    },
  };
}

function paid(templateId: string, occurrenceDate: string): ExpenseOccurrenceOverride {
  return {
    id: `ovr:${templateId}:${occurrenceDate}`,
    userId: "user",
    templateId,
    occurrenceDate,
    status: "paid",
  };
}

// Lunes 26 de octubre, 08:05 en Canarias (UTC+0 tras el cambio de hora).
const mondayMorning = new Date("2026-10-26T08:05:00.000Z");

function notificationsFor(store: ExpenseStore, now = mondayMorning) {
  const plan = planUserReminders(store, now);
  if (!plan) return null;
  return buildReminderNotifications(plan, plan.candidates);
}

describe("planUserReminders", () => {
  it("waits for the chosen hour in the user's zone", () => {
    const store = storeWith([template("netflix", "Netflix", 29)]);

    expect(planUserReminders(store, new Date("2026-10-26T07:30:00.000Z"))).toBeNull();
    expect(planUserReminders(store, mondayMorning)).toMatchObject({
      localDate: "2026-10-26",
      language: "es",
    });
    // Nueva York: a las 08:05 UTC aún son las 04:05.
    expect(
      planUserReminders(
        storeWith([template("netflix", "Netflix", 29)], {
          reminders: { timeZone: "America/New_York" },
        }),
        mondayMorning,
      ),
    ).toBeNull();
  });

  it("uses the local date when the server is already on the next day", () => {
    // 00:30 UTC del martes = 20:30 del lunes en Nueva York.
    const plan = planUserReminders(
      storeWith([template("today", "Hoy", 26)], {
        reminders: { timeZone: "America/New_York", pushHour: 20 },
      }),
      new Date("2026-10-27T00:30:00.000Z"),
    );

    expect(plan?.localDate).toBe("2026-10-26");
    expect(plan?.candidates.map((candidate) => candidate.kind)).toEqual(["charge_day"]);
  });

  it("adds month close and payday only when turned on", () => {
    const finance = {
      ...emptyStore.finance,
      monthlySalary: { "2026-10": { amount: 2000, dayOfMonth: 26 } },
    };
    const settledTemplates = [template("rent", "Alquiler", 1)];
    const overrides = [paid("rent", "2026-09-01"), paid("rent", "2026-10-01")];

    expect(
      planUserReminders(storeWith(settledTemplates, { finance, overrides }), mondayMorning)
        ?.candidates,
    ).toEqual([]);

    const plan = planUserReminders(
      storeWith(settledTemplates, {
        finance,
        overrides,
        reminders: { monthClose: true, payday: true },
      }),
      mondayMorning,
    );
    expect(plan?.candidates.map(({ kind, key }) => `${kind}:${key}`)).toEqual([
      "month_close:2026-10",
      "payday:2026-10",
    ]);
  });
});

describe("buildReminderNotifications", () => {
  it("names, prices and links a single upcoming charge", () => {
    const [notification] = notificationsFor(
      storeWith([template("netflix", "Netflix", 29, 12.99)]),
    )!;

    expect(notification).toMatchObject({
      kind: "last_chance",
      ttlSeconds: REMINDER_TTL_SECONDS.last_chance,
      payload: {
        title: "Netflix se cobra en 3 días",
        body: `${formatCurrency(12.99)} · jueves 29 oct. Revísalo por si quieres cambiarlo o cancelarlo.`,
        url: "/?occurrence=netflix%3A2026-10-29",
        tag: "last_chance:netflix:2026-10-29",
        lang: "es",
      },
    });
  });

  it("writes the notification in the user's language", () => {
    const [notification] = notificationsFor(
      storeWith([template("gym", "Gym", 26, 35)], { language: "en" }),
    )!;

    expect(notification.payload).toMatchObject({
      title: "Gym is charged today",
      body: `${formatCurrency(35)}. Mark it as paid when you see it in your bank.`,
      lang: "en",
    });
  });

  it("summarizes several charges of the same stage", () => {
    const notifications = notificationsFor(
      storeWith([
        template("light", "Luz", 26, 60),
        template("water", "Agua", 26, 20),
        template("check", "Seguro", 23, 30),
      ]),
    )!;

    expect(notifications.map((notification) => notification.payload.title)).toEqual([
      "¿Se cobró Seguro?",
      "Hoy se cobran 2 recibos",
    ]);
    expect(notifications[1].payload).toMatchObject({
      body: `Luz y Agua · ${formatCurrency(80)}`,
      url: "/?occurrence=light%3A2026-10-26",
      tag: "charge_day:2026-10-26",
    });
    expect(notifications[0].payload.body).toBe(
      `${formatCurrency(30)} · previsto el viernes 23 oct. Márcalo como pagado si ya salió de tu cuenta.`,
    );
  });

  it("builds the month close and payday notices", () => {
    const store = storeWith([template("rent", "Alquiler", 1), template("gym", "Gym", 12)], {
      finance: {
        ...emptyStore.finance,
        monthlySalary: { "2026-10": { amount: 2000, dayOfMonth: 26 } },
      },
      overrides: [
        paid("rent", "2026-09-01"),
        paid("gym", "2026-09-12"),
        paid("rent", "2026-10-01"),
        paid("gym", "2026-10-12"),
      ],
      reminders: { monthClose: true, payday: true },
    });

    expect(notificationsFor(store)?.map(({ kind, payload }) => ({ kind, ...payload }))).toEqual([
      expect.objectContaining({
        kind: "payday",
        title: "Hoy es día de cobro",
        body: "Octubre está al día. Buen momento para apartar el ahorro.",
        url: "/money",
      }),
      expect.objectContaining({
        kind: "month_close",
        title: "Octubre al día",
        body: "Todo pagado. ¿Pasamos a noviembre?",
        url: "/",
      }),
    ]);
  });

  it("only includes the claimed candidates and carries the badge count", () => {
    const plan = planUserReminders(
      storeWith([template("light", "Luz", 26), template("water", "Agua", 26)]),
      mondayMorning,
    )!;
    const [notification] = buildReminderNotifications(plan, plan.candidates.slice(0, 1));

    expect(notification.candidates).toHaveLength(1);
    expect(notification.payload.title).toMatch(/^Hoy se cobra /);
    // Los dos recibos de hoy y los de septiembre sin pagar.
    expect(notification.payload.badgeCount).toBe(plan.badgeCount);
    expect(plan.badgeCount).toBe(4);
  });
});

describe("notification text helpers", () => {
  it("keeps the delivery key of the original reminder", () => {
    expect(
      buildReminderDeliveryKey({
        template: { id: "tpl" },
        occurrenceDate: "2026-10-24",
        estimatedChargeDate: "2026-10-26",
      } as Parameters<typeof buildReminderDeliveryKey>[0]),
    ).toBe("tpl:2026-10-24:2026-10-26");
  });

  it("joins names and relative days", () => {
    expect(joinNames(["Luz"], "es")).toBe("Luz");
    expect(joinNames(["Luz", "Agua"], "en")).toBe("Luz and Agua");
    expect(joinNames(["Luz", "Agua", "Gas", "Wifi"], "es")).toBe("Luz, Agua y 2 más");
    expect(relativeDay(1, "es")).toBe("mañana");
    expect(relativeDay(5, "en")).toBe("in 5 days");
  });
});
