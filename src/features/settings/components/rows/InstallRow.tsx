"use client";

import { useState } from "react";
import { Smartphone } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";
import { detectInstallGuide, readInstallEnvironment } from "../../lib/install-guide";
import { IosInstallSheet } from "../install/IosInstallSheet";
import { SettingRow } from "../SettingRow";

// Solo en iPhone/iPad sin instalar: explica cómo añadirla a la pantalla de
// inicio, que es lo que habilita los avisos en iOS.
export function InstallRow({ language }: { language: AppLanguage }) {
  // Ajustes se pinta solo en cliente (tras hidratar el store).
  const [guide] = useState(() => detectInstallGuide(readInstallEnvironment()));
  const [open, setOpen] = useState(false);
  if (!guide) return null;

  return (
    <>
      <SettingRow
        icon={<Smartphone size={18} />}
        title={t("reminders.installTitle", language)}
        description={t("reminders.installHelp", language)}
        wrapDescription
        action={
          <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
            {t("reminders.installAction", language)}
          </Button>
        }
      />
      {open ? (
        <IosInstallSheet guide={guide} language={language} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}
