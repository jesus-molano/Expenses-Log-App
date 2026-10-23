// El atajo "Añadir gasto" (/expenses/new) o "Añadir por voz" (?mode=voice)
// abre el formulario o la captura una sola vez por entrada del historial: al
// volver a esta pantalla con Atrás desde otra no se repite.
const HANDLED_KEY = "__newExpenseHandled";

export type NewExpenseIntent = "form" | "voice" | null;

type HistoryHost = Pick<Window, "history" | "location">;

export function readNewExpenseIntent(requested: boolean, host: HistoryHost = window): NewExpenseIntent {
  if (!requested) return null;
  const state = host.history.state as Record<string, unknown> | null;
  if (state?.[HANDLED_KEY]) return null;
  return new URLSearchParams(host.location.search).get("mode") === "voice" ? "voice" : "form";
}

export function markNewExpenseIntentHandled(host: HistoryHost = window) {
  const state = host.history.state as Record<string, unknown> | null;
  host.history.replaceState({ ...(state ?? {}), [HANDLED_KEY]: true }, "");
}
