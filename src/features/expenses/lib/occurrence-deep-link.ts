import { addDays, parseISO, subDays } from "date-fns";
import { isValidDateOnly, toDateOnly } from "@/domain/calendar";
import { generateStoreOccurrences, occurrencesDueBetween } from "@/domain/finance";
import type { AppLanguage, ExpenseOccurrence, ExpenseStore } from "@/domain/types";

// Enlace de una notificación a un cobro: /?occurrence=<templateId>:<fecha>.
// Se lee en cliente para que "/" siga siendo estática y precacheada (el
// service worker ignora el parámetro al buscar en el precache).
export const OCCURRENCE_PARAM = "occurrence";

// Un recibo movido puede vencer hasta unas semanas antes o después de su fecha.
const MOVED_SEARCH_DAYS = 45;

export function occurrenceDeepLink(occurrenceId: string) {
  return `/?${OCCURRENCE_PARAM}=${encodeURIComponent(occurrenceId)}`;
}

function splitOccurrenceId(occurrenceId: string) {
  const separator = occurrenceId.lastIndexOf(":");
  if (separator <= 0) return null;
  const templateId = occurrenceId.slice(0, separator);
  const occurrenceDate = occurrenceId.slice(separator + 1);
  return isValidDateOnly(occurrenceDate) ? { templateId, occurrenceDate } : null;
}

export function readOccurrenceParam(search: string): string | null {
  const value = new URLSearchParams(search).get(OCCURRENCE_PARAM);
  if (!value || value.length > 200) return null;
  return splitOccurrenceId(value) ? value : null;
}

// La misma URL sin el parámetro, para que recargar o volver no repita el salto.
export function urlWithoutOccurrenceParam(location: Pick<Location, "pathname" | "search" | "hash">) {
  const params = new URLSearchParams(location.search);
  params.delete(OCCURRENCE_PARAM);
  const query = params.toString();
  return `${location.pathname}${query ? `?${query}` : ""}${location.hash}`;
}

export function locateOccurrence(
  store: ExpenseStore,
  occurrenceId: string,
  language: AppLanguage = "es",
): ExpenseOccurrence | null {
  const parts = splitOccurrenceId(occurrenceId);
  if (!parts) return null;
  const matches = (occurrence: ExpenseOccurrence) => occurrence.id === occurrenceId;

  const direct = generateStoreOccurrences(
    store,
    parts.occurrenceDate,
    parts.occurrenceDate,
    language,
  ).find(matches);
  if (direct) return direct;

  const date = parseISO(parts.occurrenceDate);
  return (
    occurrencesDueBetween(
      store,
      toDateOnly(subDays(date, MOVED_SEARCH_DAYS)),
      toDateOnly(addDays(date, MOVED_SEARCH_DAYS)),
      language,
    ).find(matches) ?? null
  );
}

// Mes que hay que mirar para ver el cobro: el actual si ya sale en la lista
// (por ejemplo, como pendiente del mes anterior) o el de su vencimiento.
export function deepLinkViewMonth(
  occurrence: Pick<ExpenseOccurrence, "id" | "dueDate">,
  viewMonthId: string,
  visibleIds: ReadonlySet<string>,
) {
  return visibleIds.has(occurrence.id) ? viewMonthId : occurrence.dueDate.slice(0, 7);
}
