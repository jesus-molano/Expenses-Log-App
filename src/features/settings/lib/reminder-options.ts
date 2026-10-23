import { APP_TIME_ZONE, isValidTimeZone } from "@/domain/calendar";
import { formatReminderHour } from "@/features/expenses/lib/reminder-labels";

export const REMINDER_HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => ({
  value: hour,
  label: formatReminderHour(hour),
}));

// Zona del dispositivo que guarda los ajustes: el cron calcula en ella el día
// y la hora de cada usuario.
export function deviceTimeZone() {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isValidTimeZone(zone) ? zone : APP_TIME_ZONE;
  } catch {
    return APP_TIME_ZONE;
  }
}
