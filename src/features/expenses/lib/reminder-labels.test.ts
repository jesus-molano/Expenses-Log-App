import { describe, expect, it } from "vitest";
import { DEFAULT_REMINDER_PREFERENCES } from "@/domain/reminder-schedule";
import {
  bellToggleMessage,
  formatLeadDays,
  formatReminderHour,
  reminderPreferencesSummary,
} from "./reminder-labels";

describe("reminder labels", () => {
  it("formats the notice and the hour", () => {
    expect(formatLeadDays(1, "es")).toBe("1 día");
    expect(formatLeadDays(14, "es")).toBe("14 días");
    expect(formatLeadDays(1, "en")).toBe("1 day");
    expect(formatReminderHour(8)).toBe("08:00");
    expect(formatReminderHour(21)).toBe("21:00");
  });

  it("confirms the bell and hints at push when it is off", () => {
    expect(
      bellToggleMessage({
        name: "Netflix",
        reminder: { enabled: true, daysBeforeCharge: 3 },
        pushActive: true,
        language: "es",
      }),
    ).toBe("Te avisaré de Netflix 3 días antes.");
    expect(
      bellToggleMessage({
        name: "Netflix",
        reminder: { enabled: true, daysBeforeCharge: 1 },
        pushActive: false,
        language: "en",
      }),
    ).toBe(
      "I'll remind you about Netflix 1 day before. Turn on push notifications in Settings to get them.",
    );
    expect(
      bellToggleMessage({
        name: "Netflix",
        reminder: { enabled: false, daysBeforeCharge: 3 },
        pushActive: false,
        language: "es",
      }),
    ).toBe("Sin avisos para Netflix.");
  });

  it("summarizes the settings row", () => {
    expect(reminderPreferencesSummary(DEFAULT_REMINDER_PREFERENCES, "es")).toBe(
      "Solo los recibos con campana · desde las 08:00",
    );
    expect(
      reminderPreferencesSummary(
        { ...DEFAULT_REMINDER_PREFERENCES, defaultEnabled: true, pushHour: 20 },
        "es",
      ),
    ).toBe("Todos los recibos · 3 días antes · desde las 20:00");
  });
});
