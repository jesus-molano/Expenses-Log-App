"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { Sheet } from "@/components/ui/Sheet";
import { Surface } from "@/components/ui/Surface";
import {
  LONG_CYCLE_LEAD_DAYS,
  SHORT_CYCLE_LEAD_DAYS,
} from "@/domain/reminder-schedule";
import type { AppLanguage, ReminderPreferences } from "@/domain/types";
import { t } from "@/shared/i18n";
import type { ReminderPreferencesInput } from "@/stores/app/store-commands";
import { REMINDER_HOUR_OPTIONS } from "../../lib/reminder-options";
import { LeadDaysPicker } from "./LeadDaysPicker";
import { ReminderSwitchRow } from "./ReminderSwitchRow";

type ReminderSettingsSheetProps = {
  preferences: ReminderPreferences;
  language: AppLanguage;
  // Si este dispositivo recibe avisos push; si no, se explica cómo activarlos.
  pushActive: boolean;
  hasPayday: boolean;
  onChange: (changes: ReminderPreferencesInput) => void;
  onClose: () => void;
};

// Ajustes de avisos de la cuenta. Cada cambio se guarda al momento y se
// sincroniza: el cron los lee del store.
export function ReminderSettingsSheet({
  preferences,
  language,
  pushActive,
  hasPayday,
  onChange,
  onClose,
}: ReminderSettingsSheetProps) {
  const titleId = useId();
  const hourId = useId();
  const [hourOpen, setHourOpen] = useState(false);

  return (
    <Sheet ariaLabelledBy={titleId} onBackdropClick={onClose}>
      <div className="app-sheet-header sticky top-0 z-10 px-5 pb-3 pt-3">
        <div className="app-sheet-handle mx-auto mb-3 sm:hidden" />
        <header className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold text-[var(--app-text)]">
              {t("reminders.sheetTitle", language)}
            </h2>
            <p className="text-sm text-[var(--app-text-muted)]">
              {t("reminders.sheetSubtitle", language)}
            </p>
          </div>
          <Button
            type="button"
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="shrink-0 rounded-full"
          >
            {t("common.close", language)}
          </Button>
        </header>
      </div>

      <div className="grid gap-3 px-5 pb-5">
        {pushActive ? null : (
          <p className="app-section-card p-3 text-xs leading-relaxed text-[var(--app-text-muted)]">
            {t("reminders.pushInactiveHint", language)}
          </p>
        )}

        <Surface as="section" variant="section" padding="sm">
          <ReminderSwitchRow
            title={t("reminders.defaultTitle", language)}
            help={t("reminders.defaultHelp", language)}
            checked={preferences.defaultEnabled}
            onCheckedChange={(defaultEnabled) => onChange({ defaultEnabled })}
          />
          {preferences.defaultEnabled ? (
            <>
              <LeadDaysPicker
                title={t("reminders.leadShortTitle", language)}
                options={SHORT_CYCLE_LEAD_DAYS}
                value={preferences.defaultDaysBefore}
                language={language}
                onChange={(defaultDaysBefore) => onChange({ defaultDaysBefore })}
              />
              <LeadDaysPicker
                title={t("reminders.leadLongTitle", language)}
                options={LONG_CYCLE_LEAD_DAYS}
                value={preferences.longCycleDaysBefore}
                language={language}
                onChange={(longCycleDaysBefore) => onChange({ longCycleDaysBefore })}
              />
            </>
          ) : null}
        </Surface>

        <Surface as="section" variant="section" padding="sm">
          <h3 className="pt-1 text-xs font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">
            {t("reminders.stagesTitle", language)}
          </h3>
          <ReminderSwitchRow
            title={t("reminders.chargeDayTitle", language)}
            help={t("reminders.chargeDayHelp", language)}
            checked={preferences.onChargeDay}
            onCheckedChange={(onChargeDay) => onChange({ onChargeDay })}
          />
          <ReminderSwitchRow
            title={t("reminders.chargeCheckTitle", language)}
            help={t("reminders.chargeCheckHelp", language)}
            checked={preferences.askIfCharged}
            onCheckedChange={(askIfCharged) => onChange({ askIfCharged })}
          />
        </Surface>

        <Surface as="section" variant="section" padding="sm">
          <h3 className="pt-1 text-xs font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">
            {t("reminders.accountTitle", language)}
          </h3>
          <ReminderSwitchRow
            title={t("reminders.monthCloseTitle", language)}
            help={t("reminders.monthCloseHelp", language)}
            checked={preferences.monthClose}
            onCheckedChange={(monthClose) => onChange({ monthClose })}
          />
          <ReminderSwitchRow
            title={t("reminders.paydayTitle", language)}
            help={t("reminders.paydayHelp", language)}
            note={
              preferences.payday && !hasPayday
                ? t("reminders.paydayNeedsSalary", language)
                : undefined
            }
            checked={preferences.payday}
            onCheckedChange={(payday) => onChange({ payday })}
          />
        </Surface>

        {/* Sin recortar: el menú de horas se despliega fuera de la tarjeta. */}
        <Surface as="section" variant="section" padding="sm" className="app-settings-card">
          <div className="flex items-center justify-between gap-3 py-1">
            <p id={hourId} className="text-sm font-semibold text-[var(--app-text)]">
              {t("reminders.hourTitle", language)}
            </p>
            <div className="w-28 shrink-0" aria-labelledby={hourId} role="group">
              <SelectMenu
                open={hourOpen}
                onOpenChange={setHourOpen}
                value={preferences.pushHour}
                options={REMINDER_HOUR_OPTIONS}
                onChange={(pushHour) => onChange({ pushHour })}
              />
            </div>
          </div>
          <p className="pb-1 text-xs leading-relaxed text-[var(--app-text-muted)]">
            {t("reminders.hourHelp", language).replace("{zone}", preferences.timeZone)}
          </p>
        </Surface>
      </div>
    </Sheet>
  );
}
