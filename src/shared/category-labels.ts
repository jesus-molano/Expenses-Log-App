import { PRESET_EXPENSE_CATEGORIES } from "@/domain/categories";
import { matchCategoryName } from "@/domain/expense-capture";
import { foldText } from "@/domain/text";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";

// Los nombres guardados son los de las categorías preset, sin tildes
// ("Alimentacion"). No se cambian para no romper los datos ya guardados: la
// etiqueta con tildes y traducida sale de i18n al mostrarlos.
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
  ahorro: "categories.ahorro",
  ocio: "categories.ocio",
  "educacion/trabajo": "categories.educacionTrabajo",
  mascotas: "categories.mascotas",
  personal: "categories.personal",
  general: "categories.general",
} as const;

type CategoryKey = keyof typeof categoryKeyByName;

function categoryKey(name: string) {
  return foldText(name) as CategoryKey;
}

export function categoryLabel(name: string, language: AppLanguage): string {
  const translationKey = categoryKeyByName[categoryKey(name)];
  return translationKey ? t(translationKey, language) : name;
}

// Nombre guardado de la categoría a partir de lo que se ve (en español o en
// inglés, con o sin tildes) o de un alias; General si no se reconoce. Lo usa
// la importación, que recibe las etiquetas tal como se exportaron.
export function resolveCategoryName(label: string): string {
  const folded = foldText(label);
  const preset = PRESET_EXPENSE_CATEGORIES.find((category) =>
    [
      category.name,
      categoryLabel(category.name, "es"),
      categoryLabel(category.name, "en"),
    ].some((candidate) => foldText(candidate) === folded),
  );

  return preset?.name ?? matchCategoryName(label, []) ?? "General";
}
