import { describe, expect, it } from "vitest";
import { isAppleMobile } from "@/shared/platform";
import {
  QUICK_ADD_PRESETS,
  availableQuickAdds,
  buildOnboardingChecklist,
  buildQuickAddDraft,
  shouldShowOnboarding,
} from "./onboarding";

const preset = (id: string) => QUICK_ADD_PRESETS.find((item) => item.id === id)!;

describe("onboarding", () => {
  it("offers the common fixed expenses that do not exist yet, in either language", () => {
    expect(QUICK_ADD_PRESETS.map((item) => item.id)).toEqual([
      "rent",
      "electricity",
      "water",
      "internet",
      "mobile",
      "netflix",
      "spotify",
      "gym",
      "carInsurance",
      "homeInsurance",
    ]);
    const remaining = availableQuickAdds(QUICK_ADD_PRESETS, [
      { name: "alquiler" },
      { name: "Electricity" },
      { name: "Movil" },
      { name: "Netflix Premium" },
    ]).map((item) => item.id);

    expect(remaining).not.toContain("rent");
    expect(remaining).not.toContain("electricity");
    expect(remaining).not.toContain("mobile");
    // "Netflix Premium" no es "Netflix": se sigue ofreciendo.
    expect(remaining).toContain("netflix");
  });

  it("builds a draft without amount, with the usual day and frequency", () => {
    const today = new Date("2026-10-23T10:00:00");

    expect(buildQuickAddDraft(preset("rent"), "es", today)).toEqual({
      name: "Alquiler",
      description: "",
      amount: 0,
      categoryName: "Casa",
      startDate: "2026-10-23",
      dueDay: 1,
      recurrence: { frequency: "monthly" },
    });
    expect(buildQuickAddDraft(preset("water"), "en", today)).toMatchObject({
      name: "Water",
      dueDay: 23,
      recurrence: { frequency: "custom", interval: 2, unit: "month" },
    });
    expect(buildQuickAddDraft(preset("carInsurance"), "es", today)).toMatchObject({
      name: "Seguro del coche",
      categoryName: "Vehiculo",
      recurrence: { frequency: "yearly", annualMonth: 10 },
    });
  });

  it("tracks the checklist", () => {
    const checklist = buildOnboardingChecklist({
      hasSalary: false,
      hasExpense: true,
      notificationsEnabled: true,
      installed: false,
    });

    expect(checklist).toEqual({
      steps: [
        { id: "expense", done: true },
        { id: "salary", done: false },
        { id: "notifications", done: true },
        { id: "install", done: false },
      ],
      doneCount: 2,
      total: 4,
      complete: false,
    });
    expect(
      buildOnboardingChecklist({
        hasSalary: true,
        hasExpense: true,
        notificationsEnabled: true,
        installed: true,
      }).complete,
    ).toBe(true);
  });

  it("shows on an empty store, and afterwards only if the user started there", () => {
    const base = { templateCount: 0, started: false, dismissed: false, syncing: false };

    expect(shouldShowOnboarding(base)).toBe(true);
    // Con la nube cargando aún no se sabe si el usuario tiene datos.
    expect(shouldShowOnboarding({ ...base, syncing: true })).toBe(false);
    expect(shouldShowOnboarding({ ...base, templateCount: 3 })).toBe(false);
    expect(shouldShowOnboarding({ ...base, templateCount: 3, started: true })).toBe(true);
    expect(shouldShowOnboarding({ ...base, dismissed: true })).toBe(false);
    expect(shouldShowOnboarding({ ...base, templateCount: 3, started: true, dismissed: true })).toBe(
      false,
    );
  });

  it("detects iPhone and iPad, including iPadOS presenting itself as a Mac", () => {
    expect(isAppleMobile({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)", maxTouchPoints: 5 })).toBe(true);
    expect(isAppleMobile({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", maxTouchPoints: 5 })).toBe(true);
    expect(isAppleMobile({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", maxTouchPoints: 0 })).toBe(false);
    expect(isAppleMobile({ userAgent: "Mozilla/5.0 (Linux; Android 15; Pixel 7)", maxTouchPoints: 5 })).toBe(false);
  });
});
