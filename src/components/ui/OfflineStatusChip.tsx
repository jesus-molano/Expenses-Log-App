"use client";

import { WifiOff } from "lucide-react";
import type { AppLanguage } from "@/domain/types";
import { useOnlineStatus } from "@/shared/hooks/use-online-status";
import { t } from "@/shared/i18n";
import { cn } from "@/shared/ui";

type OfflineStatusChipProps = {
  language: AppLanguage;
  // Clases del chip visible (p. ej. su margen); la región vacía no ocupa sitio.
  className?: string;
  // Clases de la región que lo contiene, p. ej. para colocarla fuera del flujo.
  regionClassName?: string;
};

// La región role="status" existe siempre para que el lector de pantalla anuncie
// el chip al perder la conexión; con conexión queda vacía y sin ancho.
export function OfflineStatusChip({
  language,
  className,
  regionClassName,
}: OfflineStatusChipProps) {
  const online = useOnlineStatus();

  return (
    <span role="status" className={cn("inline-flex shrink-0", regionClassName)}>
      {online ? null : (
        <span
          className={cn(
            "app-chip app-chip-orange inline-flex items-center gap-1 whitespace-nowrap px-2 text-[11px] font-semibold leading-[14px]",
            className,
          )}
        >
          <WifiOff size={12} aria-hidden="true" />
          {t("common.offline", language)}
        </span>
      )}
    </span>
  );
}
