import { format, parseISO } from "date-fns";
import { enUS, es } from "date-fns/locale";
import { formatCurrency, zonedDateParts } from "@/domain/calendar";
import {
  buildMonthCloseNotice,
  buildOccurrenceReminders,
  buildPaydayNotice,
  countAttentionOccurrences,
  resolveReminderPreferences,
  type MonthCloseNotice,
  type PaydayNotice,
  type ReminderStage,
  type ScheduledReminder,
} from "@/domain/reminder-schedule";
import type { AppLanguage, ExpenseOccurrence, ExpenseStore } from "@/domain/types";
import type { PushNotificationPayload } from "@/pwa/push-payload";
import { t } from "@/shared/i18n";
import { capitalize, formatMonthName } from "./month-view";
import { occurrenceDeepLink } from "./occurrence-deep-link";

// Tipos de envío del cron. Cada uno se reclama por separado en
// `push_reminder_deliveries` (columna `kind`) con el mismo RPC: un cobro puede
// recibir su aviso previo, el del día del cargo y la pregunta de si se cobró.
// "last_chance" es el aviso previo de siempre: mantener el nombre evita
// repetir los ya entregados al desplegar.
export const REMINDER_DELIVERY_KINDS = [
  "last_chance",
  "charge_day",
  "charge_check",
  "month_close",
  "payday",
] as const;

export type ReminderDeliveryKind = (typeof REMINDER_DELIVERY_KINDS)[number];
type OccurrenceKind = Extract<ReminderDeliveryKind, "last_chance" | "charge_day" | "charge_check">;

const STAGE_KIND: Record<ReminderStage, OccurrenceKind> = {
  before: "last_chance",
  charge_day: "charge_day",
  charge_check: "charge_check",
};

// Tiempo que el servicio push guarda un aviso para un dispositivo apagado. Un
// aviso que llega al día siguiente ya no sirve; el cron manda el nuevo.
const HOUR = 60 * 60;
export const REMINDER_TTL_SECONDS: Record<ReminderDeliveryKind, number> = {
  last_chance: 20 * HOUR,
  charge_day: 12 * HOUR,
  charge_check: 20 * HOUR,
  month_close: 20 * HOUR,
  payday: 12 * HOUR,
};

// Orden de las notificaciones de una misma ejecución.
const KIND_ORDER: ReminderDeliveryKind[] = [
  "charge_check",
  "charge_day",
  "last_chance",
  "payday",
  "month_close",
];

export type ReminderCandidate =
  | { kind: OccurrenceKind; key: string; reminder: ScheduledReminder }
  | { kind: "month_close"; key: string; notice: MonthCloseNotice }
  | { kind: "payday"; key: string; notice: PaydayNotice };

export type ReminderPlan = {
  // Día local del usuario en el que se calcula todo.
  localDate: string;
  language: AppLanguage;
  badgeCount: number;
  candidates: ReminderCandidate[];
};

export type ReminderNotification = {
  kind: ReminderDeliveryKind;
  candidates: ReminderCandidate[];
  payload: PushNotificationPayload;
  ttlSeconds: number;
};

// Clave de entrega de un cobro: cambia si se mueve la fecha del cargo, para
// volver a avisar de la fecha nueva.
export function buildReminderDeliveryKey(occurrence: ExpenseOccurrence) {
  return `${occurrence.template.id}:${occurrence.occurrenceDate}:${occurrence.estimatedChargeDate}`;
}

// Lo que toca avisar a un usuario en este momento, o null si en su zona aún
// no es la hora elegida. Una ejecución posterior del mismo día lo recupera.
export function planUserReminders(store: ExpenseStore, now: Date): ReminderPlan | null {
  const preferences = resolveReminderPreferences(store);
  const clock = zonedDateParts(now, preferences.timeZone);
  if (clock.hour < preferences.pushHour) return null;

  const today = parseISO(clock.date);
  const language = store.preferences?.language ?? "es";
  const occurrenceCandidates: ReminderCandidate[] = buildOccurrenceReminders(
    store,
    today,
    language,
  ).map((reminder) => ({
    kind: STAGE_KIND[reminder.stage],
    key: buildReminderDeliveryKey(reminder.occurrence),
    reminder,
  }));
  const monthClose = preferences.monthClose
    ? buildMonthCloseNotice(store, clock.date, language)
    : null;
  const payday = preferences.payday
    ? buildPaydayNotice(store, clock.date, language)
    : null;

  return {
    localDate: clock.date,
    language,
    badgeCount: countAttentionOccurrences(store, today, language),
    candidates: [
      ...occurrenceCandidates,
      ...(monthClose
        ? [{ kind: "month_close" as const, key: monthClose.monthId, notice: monthClose }]
        : []),
      ...(payday ? [{ kind: "payday" as const, key: payday.monthId, notice: payday }] : []),
    ],
  };
}

// Una notificación por tipo con los avisos ya reclamados: un cobro suelto dice
// nombre, importe y fecha y abre ese cobro; varios se resumen.
export function buildReminderNotifications(
  plan: Pick<ReminderPlan, "localDate" | "language" | "badgeCount">,
  candidates: ReminderCandidate[],
): ReminderNotification[] {
  return KIND_ORDER.flatMap((kind) => {
    const group = candidates.filter((candidate) => candidate.kind === kind);
    if (!group.length) return [];
    const payload = buildPayload(kind, group, plan);
    return payload
      ? [{ kind, candidates: group, payload, ttlSeconds: REMINDER_TTL_SECONDS[kind] }]
      : [];
  });
}

function buildPayload(
  kind: ReminderDeliveryKind,
  group: ReminderCandidate[],
  plan: Pick<ReminderPlan, "localDate" | "language" | "badgeCount">,
): PushNotificationPayload | null {
  const { language } = plan;
  const base = { badgeCount: plan.badgeCount, lang: language };
  const first = group[0];

  if (first.kind === "month_close") {
    return {
      ...base,
      title: capitalize(
        t("reminders.pushMonthCloseTitle", language).replace(
          "{month}",
          formatMonthName(first.notice.monthId, language),
        ),
      ),
      body: t("reminders.pushMonthCloseBody", language).replace(
        "{next}",
        formatMonthName(first.notice.nextMonthId, language),
      ),
      url: "/",
      tag: `month_close:${first.notice.monthId}`,
    };
  }

  if (first.kind === "payday") {
    return {
      ...base,
      title: t("reminders.pushPaydayTitle", language),
      body: paydayBody(first.notice, language),
      url: "/money",
      tag: `payday:${first.notice.monthId}`,
    };
  }

  const reminders = group.flatMap((candidate) =>
    "reminder" in candidate ? [candidate.reminder] : [],
  );
  if (!reminders.length) return null;
  const [primary] = reminders;
  const url = occurrenceDeepLink(primary.occurrence.id);

  if (reminders.length === 1) {
    return {
      ...base,
      ...singleOccurrenceText(kind, primary, language),
      url,
      tag: `${kind}:${primary.occurrence.id}`,
    };
  }

  const total = reminders.reduce(
    (sum, reminder) => sum + reminder.occurrence.template.amount,
    0,
  );
  return {
    ...base,
    title: manyTitle(kind, reminders.length, language),
    body: t("reminders.pushManyBody", language)
      .replace(
        "{names}",
        joinNames(
          reminders.map((reminder) => reminder.occurrence.template.name),
          language,
        ),
      )
      .replace("{total}", formatCurrency(total)),
    url,
    tag: `${kind}:${plan.localDate}`,
  };
}

function singleOccurrenceText(
  kind: ReminderDeliveryKind,
  { occurrence, daysUntilCharge }: ScheduledReminder,
  language: AppLanguage,
) {
  const name = occurrence.template.name;
  const amount = formatCurrency(occurrence.template.amount);
  const date = formatChargeDate(occurrence.estimatedChargeDate, language);

  if (kind === "charge_day") {
    return {
      title: t("reminders.pushChargeDayTitleOne", language).replace("{name}", name),
      body: t("reminders.pushChargeDayBodyOne", language).replace("{amount}", amount),
    };
  }
  if (kind === "charge_check") {
    return {
      title: t("reminders.pushCheckTitleOne", language).replace("{name}", name),
      body: t("reminders.pushCheckBodyOne", language)
        .replace("{amount}", amount)
        .replace("{date}", date),
    };
  }
  return {
    title: t("reminders.pushBeforeTitleOne", language)
      .replace("{name}", name)
      .replace("{when}", relativeDay(daysUntilCharge, language)),
    body: t("reminders.pushBeforeBodyOne", language)
      .replace("{amount}", amount)
      .replace("{date}", date),
  };
}

function manyTitle(kind: ReminderDeliveryKind, count: number, language: AppLanguage) {
  const key =
    kind === "charge_day"
      ? "reminders.pushChargeDayTitleMany"
      : kind === "charge_check"
        ? "reminders.pushCheckTitleMany"
        : "reminders.pushBeforeTitleMany";
  return t(key, language).replace("{count}", String(count));
}

function paydayBody(notice: PaydayNotice, language: AppLanguage) {
  const month = formatMonthName(notice.monthId, language);
  if (notice.pendingCount === 0) {
    return capitalize(t("reminders.pushPaydayBodyNone", language).replace("{month}", month));
  }
  const key =
    notice.pendingCount === 1
      ? "reminders.pushPaydayBodyOne"
      : "reminders.pushPaydayBodyMany";
  return t(key, language)
    .replace("{count}", String(notice.pendingCount))
    .replace("{month}", month)
    .replace("{total}", formatCurrency(notice.pendingTotal));
}

export function relativeDay(days: number, language: AppLanguage) {
  if (days <= 0) return t("reminders.whenToday", language);
  if (days === 1) return t("reminders.whenTomorrow", language);
  return t("reminders.whenInDays", language).replace("{days}", String(days));
}

function formatChargeDate(date: string, language: AppLanguage) {
  return format(parseISO(date), "EEEE d MMM", { locale: language === "en" ? enUS : es });
}

// "Luz", "Luz y Agua", "Luz, Agua y 2 más".
export function joinNames(names: string[], language: AppLanguage) {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) {
    return t("reminders.namesPair", language)
      .replace("{first}", names[0])
      .replace("{second}", names[1]);
  }
  return t("reminders.namesAndMore", language)
    .replace("{names}", `${names[0]}, ${names[1]}`)
    .replace("{count}", String(names.length - 2));
}
