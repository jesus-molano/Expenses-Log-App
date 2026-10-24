import type { TranslationKey } from "./i18n";

// Pestañas de la navegación inferior, en su orden. "money" es Mes: conserva el
// id y la ruta de cuando era Plan, porque los avisos push, el acceso directo
// del manifiesto y `?from=money` ya apuntan ahí.
export const APP_TABS = ["expenses", "money", "accounts", "forecast"] as const;

export type AppTab = (typeof APP_TABS)[number];

const TAB_HREFS: Record<AppTab, string> = {
  expenses: "/",
  money: "/money",
  accounts: "/accounts",
  forecast: "/forecast",
};

const TAB_LABEL_KEYS: Record<AppTab, TranslationKey> = {
  expenses: "common.expenses",
  money: "common.month",
  accounts: "common.accounts",
  forecast: "common.forecast",
};

export function isAppTab(value: unknown): value is AppTab {
  return (APP_TABS as readonly unknown[]).includes(value);
}

// Pestaña de `?from=` o de `sessionStorage`; cualquier otro valor vuelve a
// Gastos.
export function parseAppTab(value: string | null | undefined): AppTab {
  return isAppTab(value) ? value : "expenses";
}

export function appTabHref(tab: AppTab) {
  return TAB_HREFS[tab];
}

export function appTabLabelKey(tab: AppTab) {
  return TAB_LABEL_KEYS[tab];
}

// Enlace a Ajustes que sabe volver a la pestaña de la que se viene.
export function settingsHrefFrom(tab: AppTab) {
  return `/settings?from=${tab}`;
}
