import { Button } from "@/components/ui/Button";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";
import { cn } from "@/shared/ui";

// Cabecera de las hojas del Plan: asa, título, subtítulo y Cerrar.
export function PlanSheetHeader({
  title,
  titleId,
  subtitle,
  capitalizeSubtitle = true,
  onClose,
  language,
}: {
  title: string;
  titleId?: string;
  subtitle?: string;
  // El nombre de un mes va en mayúscula; un rango de días ("28 oct – 27 nov"), no.
  capitalizeSubtitle?: boolean;
  onClose: () => void;
  language: AppLanguage;
}) {
  return (
    <>
      <div className="app-sheet-handle mx-auto mb-3 sm:hidden" />
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={titleId} className="break-words text-lg font-semibold text-[var(--app-text)]">
            {title}
          </h2>
          {subtitle ? (
            <p
              className={cn(
                "mt-1 break-words text-sm text-[var(--app-text-muted)]",
                capitalizeSubtitle && "capitalize",
              )}
            >
              {subtitle}
            </p>
          ) : null}
        </div>
        <Button type="button" onClick={onClose} variant="ghost" size="sm" className="rounded-full">
          {t("money.close", language)}
        </Button>
      </header>
    </>
  );
}
