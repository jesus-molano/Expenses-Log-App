// Atrás (botón o gesto de Android, o el del navegador) cierra la hoja de
// encima en lugar de salir de la pantalla. Cada hoja abierta añade una entrada
// al historial con la misma URL y la quita al cerrarse desde la propia hoja.
//
// Un único gestor para todas las hojas: si una se cierra (history.back) justo
// cuando se abre otra, la nueva espera a que termine esa vuelta atrás antes
// de añadir su entrada, para que ese popstate no la cierre.

type SheetEntry = { id: string; close: () => void; pushed: boolean };

const stack: SheetEntry[] = [];
let pendingBacks = 0;
let listening = false;
let nextId = 0;

function pushEntry(entry: SheetEntry) {
  const state = window.history.state as Record<string, unknown> | null;
  window.history.pushState({ ...(state ?? {}), __sheet: entry.id }, "");
  entry.pushed = true;
}

function handlePopState() {
  if (pendingBacks > 0) {
    pendingBacks -= 1;
    if (pendingBacks === 0) stack.filter((entry) => !entry.pushed).forEach(pushEntry);
    return;
  }
  // El usuario ha ido atrás: el navegador ya ha quitado la entrada de la hoja
  // de encima, solo falta cerrarla.
  stack.pop()?.close();
}

export function registerSheet(close: () => void): () => void {
  if (!listening) {
    window.addEventListener("popstate", handlePopState);
    listening = true;
  }
  nextId += 1;
  const entry: SheetEntry = { id: `sheet-${nextId}`, close, pushed: false };
  stack.push(entry);
  if (pendingBacks === 0) pushEntry(entry);

  return () => {
    const index = stack.indexOf(entry);
    if (index === -1) return;
    stack.splice(index, 1);
    const state = window.history.state as { __sheet?: string } | null;
    // Si la hoja se cierra por una navegación, la entrada actual ya no es la
    // suya y no hay nada que deshacer.
    if (entry.pushed && state?.__sheet === entry.id) {
      pendingBacks += 1;
      window.history.back();
    }
  };
}
