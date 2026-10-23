// "Aún no" a "¿Has cobrado?": se guarda por dispositivo el día en que se
// respondió, para no volver a preguntar hasta el día siguiente. No se
// sincroniza: la respuesta de verdad (cobrado) sí va en el store.
const DISMISSED_PREFIX = "salary-prompt-dismissed:";

export function readSalaryPromptDismissedOn(monthId: string): string | null {
  try {
    return window.localStorage.getItem(`${DISMISSED_PREFIX}${monthId}`);
  } catch {
    return null;
  }
}

export function writeSalaryPromptDismissedOn(monthId: string, today: string) {
  try {
    window.localStorage.setItem(`${DISMISSED_PREFIX}${monthId}`, today);
  } catch {
    // Sin localStorage la pregunta vuelve a aparecer al recargar.
  }
}
