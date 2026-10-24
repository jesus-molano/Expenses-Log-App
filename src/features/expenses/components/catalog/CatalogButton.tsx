import { LayoutList } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";

type CatalogButtonProps = {
  language: AppLanguage;
  // Permanencias que acaban pronto: se marca con un punto.
  attentionCount: number;
  onClick: () => void;
};

export function CatalogButton({ language, attentionCount, onClick }: CatalogButtonProps) {
  const attention =
    attentionCount === 1
      ? t("catalog.attentionOne", language)
      : t("catalog.attentionMany", language).replace("{count}", String(attentionCount));

  return (
    <IconButton
      type="button"
      onClick={onClick}
      aria-label={
        attentionCount > 0
          ? `${t("catalog.open", language)} · ${attention}`
          : t("catalog.open", language)
      }
      className="relative shrink-0 rounded-full"
    >
      <LayoutList size={18} />
      {attentionCount > 0 ? (
        <span
          aria-hidden="true"
          className="absolute right-1.5 top-1.5 size-2 rounded-full bg-[var(--app-warning)]"
        />
      ) : null}
    </IconButton>
  );
}
