import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";

const categoryKeyByName = {
  casa: "categories.casa",
  alimentacion: "categories.alimentacion",
  servicios: "categories.servicios",
  suscripciones: "categories.suscripciones",
  vehiculo: "categories.vehiculo",
  transporte: "categories.transporte",
  salud: "categories.salud",
  deporte: "categories.deporte",
  deudas: "categories.deudas",
  ocio: "categories.ocio",
  "educacion/trabajo": "categories.educacionTrabajo",
  mascotas: "categories.mascotas",
  personal: "categories.personal",
  general: "categories.general",
} as const;

export function categoryLabel(name: string, language: AppLanguage): string {
  const key = name.trim().toLowerCase() as keyof typeof categoryKeyByName;
  const translationKey = categoryKeyByName[key];
  return translationKey ? t(translationKey, language) : name;
}

const compactCategoryLabelByLanguage: Record<
  AppLanguage,
  Partial<Record<keyof typeof categoryKeyByName, string>>
> = {
  es: {
    alimentacion: "Comida",
    suscripciones: "Subs.",
    "educacion/trabajo": "Edu./trab.",
  },
  en: {
    alimentacion: "Food",
    suscripciones: "Subs.",
    "educacion/trabajo": "Edu./work",
  },
};

export function compactCategoryLabel(
  name: string,
  language: AppLanguage,
): string {
  const key = name.trim().toLowerCase() as keyof typeof categoryKeyByName;
  return compactCategoryLabelByLanguage[language][key] ?? categoryLabel(name, language);
}
