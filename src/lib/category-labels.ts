import type { AppLanguage } from "@/domain/types";
import { t } from "@/lib/i18n";

const categoryKeyByName = {
  casa: "categories.casa",
  suscripciones: "categories.suscripciones",
  servicios: "categories.servicios",
  transporte: "categories.transporte",
  salud: "categories.salud",
  deudas: "categories.deudas",
  ocio: "categories.ocio",
  personal: "categories.personal",
  general: "categories.general",
} as const;

export function categoryLabel(name: string, language: AppLanguage): string {
  const key = name.trim().toLowerCase() as keyof typeof categoryKeyByName;
  const translationKey = categoryKeyByName[key];
  return translationKey ? t(translationKey, language) : name;
}

const englishTagLabels: Record<string, string> = {
  casa: "home",
  piso: "rent",
  compra: "groceries",
  gatos: "cats",
  suscripciones: "subscriptions",
  streaming: "streaming",
  software: "software",
  servicios: "utilities",
  internet: "internet",
  movil: "mobile",
  luz: "electricity",
  transporte: "transport",
  coche: "car",
  parking: "parking",
  gasolina: "fuel",
  salud: "health",
  seguro: "insurance",
  medico: "medical",
  deudas: "debt",
  prestamo: "loan",
  tarjeta: "card",
  ocio: "leisure",
  juegos: "games",
  salidas: "going-out",
  personal: "personal",
  gym: "gym",
  formacion: "learning",
  general: "general",
  anual: "annual",
};

export function tagLabel(tag: string, language: AppLanguage): string {
  if (language !== "en") return tag;
  return englishTagLabels[tag] ?? tag;
}
