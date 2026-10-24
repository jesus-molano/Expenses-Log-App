import { BALANCE_ACCOUNT_ROLES, type BalanceAccountView } from "@/domain/balance-accounts";
import type { AppLanguage, BalanceAccountRole } from "@/domain/types";
import { t, type TranslationKey } from "@/shared/i18n";

const ROLE_LABEL_KEYS = {
  bills: "insights.accounts.roles.bills",
  savings: "insights.accounts.roles.savings",
  spending: "insights.accounts.roles.spending",
} as const satisfies Record<BalanceAccountRole, TranslationKey>;

const ROLE_DETAIL_KEYS = {
  bills: "insights.accounts.roleDetails.bills",
  savings: "insights.accounts.roleDetails.savings",
  spending: "insights.accounts.roleDetails.spending",
} as const satisfies Record<BalanceAccountRole, TranslationKey>;

const DEFAULT_NAME_KEYS = {
  bills: "insights.accounts.defaultNames.bills",
  savings: "insights.accounts.defaultNames.savings",
  spending: "insights.accounts.defaultNames.spending",
} as const satisfies Record<BalanceAccountRole, TranslationKey>;

// "Recibos", "Ahorro", "Libre".
export function accountRoleLabel(role: BalanceAccountRole, language: AppLanguage) {
  return t(ROLE_LABEL_KEYS[role], language);
}

// Nombre de una cuenta sin nombre propio: el de su papel ("Cuenta de
// recibos"). Es el de la cuenta migrada del registro de saldo hasta que se
// renombra.
export function defaultAccountName(role: BalanceAccountRole, language: AppLanguage) {
  return t(DEFAULT_NAME_KEYS[role], language);
}

export function accountDisplayName(
  account: Pick<BalanceAccountView, "name" | "role">,
  language: AppLanguage,
) {
  return account.name.trim() || defaultAccountName(account.role, language);
}

// Opciones de papel para elegir al crear o editar una cuenta.
export function accountRoleOptions(language: AppLanguage) {
  return BALANCE_ACCOUNT_ROLES.map((role) => ({
    value: role,
    label: t(ROLE_LABEL_KEYS[role], language),
    description: t(ROLE_DETAIL_KEYS[role], language),
  }));
}

// Color de la etiqueta de cada papel, con las clases de chip del sistema.
export function accountRoleChipClass(role: BalanceAccountRole) {
  return {
    bills: "app-chip-blue",
    savings: "app-chip-green",
    spending: "app-chip-violet",
  }[role];
}
