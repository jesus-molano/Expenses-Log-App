"use client";

import { useState } from "react";
import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { reminderPreferencesSummary } from "@/features/expenses/lib/reminder-labels";
import { t } from "@/shared/i18n";
import type { SettingsController } from "../../types";
import { ReminderSettingsSheet } from "../reminders/ReminderSettingsSheet";
import { SettingRow } from "../SettingRow";

export function RemindersRow({ settings }: { settings: SettingsController }) {
  const [open, setOpen] = useState(false);
  const language = settings.currentLanguage;

  return (
    <>
      <SettingRow
        icon={<BellRing size={18} />}
        title={t("reminders.rowTitle", language)}
        description={reminderPreferencesSummary(settings.reminderPreferences, language)}
        wrapDescription
        action={
          <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
            {t("reminders.configure", language)}
          </Button>
        }
      />
      {open ? (
        <ReminderSettingsSheet
          preferences={settings.reminderPreferences}
          language={language}
          pushActive={settings.notificationsActive}
          hasPayday={settings.hasPayday}
          onChange={settings.updateReminderPreferences}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
