// Preferencias de vista del mes que no se sincronizan:
// - el mes que se está mirando, por pestaña y compartido entre Gastos y Mes;
// - el "Ahora no" a pasar de mes, por dispositivo y por mes.
const VIEW_MONTH_KEY = "expense-view-month";
const CLOSE_DISMISSED_PREFIX = "plan-close-dismissed:";

export function readViewMonth(): string | null {
  try {
    const value = window.sessionStorage.getItem(VIEW_MONTH_KEY);
    return value && /^\d{4}-\d{2}$/.test(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeViewMonth(monthId: string | null) {
  try {
    if (monthId) {
      window.sessionStorage.setItem(VIEW_MONTH_KEY, monthId);
    } else {
      window.sessionStorage.removeItem(VIEW_MONTH_KEY);
    }
  } catch {
    // Sin sessionStorage la vista vuelve al mes activo al recargar.
  }
}

export function readCloseDismissed(monthId: string) {
  try {
    return window.localStorage.getItem(`${CLOSE_DISMISSED_PREFIX}${monthId}`) === "1";
  } catch {
    return false;
  }
}

export function writeCloseDismissed(monthId: string) {
  try {
    window.localStorage.setItem(`${CLOSE_DISMISSED_PREFIX}${monthId}`, "1");
  } catch {
    // Sin localStorage la propuesta vuelve a aparecer al recargar.
  }
}
