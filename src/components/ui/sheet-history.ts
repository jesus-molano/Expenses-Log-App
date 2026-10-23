// Atrás (botón o gesto de Android, o el del navegador) cierra la capa de
// encima (hoja, selector de fecha...) en lugar de salir de la pantalla. Cada
// capa abierta añade una entrada al historial con la misma URL y la quita al
// cerrarse desde la propia capa.
//
// Un único gestor para todas las capas:
// - Las que se cierran en el mismo tick (una hoja y su selector, o una
//   hoja que se desmonta y vuelve a montar) se deshacen con un solo
//   history.go(-n).
// - Una capa que se abre mientras hay una vuelta atrás en curso espera a que
//   termine antes de añadir su entrada, para que ese popstate no la cierre.
// - Una entrada de capa que ya no tiene dueño (tras recargar o navegar con
//   una hoja abierta) se salta.

type LayerEntry = { id: string; close: () => void; pushed: boolean };
type LayerState = { __sheet?: string } | null;

const stack: LayerEntry[] = [];
let removed: string[] = [];
let flushScheduled = false;
let pendingBacks = 0;
let listening = false;
let nextId = 0;

function currentLayerId() {
  return (window.history.state as LayerState)?.__sheet;
}

// Mientras hay capas, el scroll de la página no se restaura al ir atrás: la
// página no ha cambiado, solo se ha cerrado la capa.
function setScrollRestoration(mode: ScrollRestoration) {
  try {
    window.history.scrollRestoration = mode;
  } catch {
    // Algún navegador puede no permitirlo; no es esencial.
  }
}

function pushEntry(entry: LayerEntry) {
  const state = window.history.state as Record<string, unknown> | null;
  setScrollRestoration("manual");
  window.history.pushState({ ...(state ?? {}), __sheet: entry.id }, "");
  entry.pushed = true;
}

function pushWaitingEntries() {
  if (pendingBacks > 0 || removed.length > 0) return;
  stack.filter((entry) => !entry.pushed).forEach(pushEntry);
  if (stack.length === 0) setScrollRestoration("auto");
}

function goBack(steps: number) {
  pendingBacks += 1;
  window.history.go(-steps);
}

function flushRemovals() {
  flushScheduled = false;
  const ids = removed;
  removed = [];
  // Si la entrada actual no es de una capa cerrada, ha habido una navegación
  // y no hay nada que deshacer.
  const current = currentLayerId();
  if (current && ids.includes(current)) {
    goBack(ids.length);
    return;
  }
  pushWaitingEntries();
}

function handlePopState(event: PopStateEvent) {
  if (pendingBacks > 0) {
    pendingBacks -= 1;
    pushWaitingEntries();
    return;
  }
  const top = stack.pop();
  if (top) {
    // El usuario ha ido atrás: el navegador ya ha quitado la entrada de la
    // capa de encima, solo falta cerrarla.
    top.pushed = false;
    top.close();
    if (stack.length === 0) setScrollRestoration("auto");
    return;
  }
  // Entrada de una capa que ya no existe: se salta para que Atrás no parezca
  // no hacer nada.
  if ((event.state as LayerState)?.__sheet) goBack(1);
}

export function registerHistoryLayer(close: () => void): () => void {
  if (!listening) {
    window.addEventListener("popstate", handlePopState);
    listening = true;
  }
  nextId += 1;
  const entry: LayerEntry = { id: `sheet-${nextId}`, close, pushed: false };
  const orphan = stack.length === 0 && pendingBacks === 0 && removed.length === 0
    ? currentLayerId()
    : undefined;
  stack.push(entry);
  if (orphan) {
    // Tras recargar con una hoja abierta, la entrada actual ya es de capa: se
    // reutiliza en lugar de apilar otra.
    const state = window.history.state as Record<string, unknown>;
    setScrollRestoration("manual");
    window.history.replaceState({ ...state, __sheet: entry.id }, "");
    entry.pushed = true;
  } else {
    pushWaitingEntries();
  }

  return () => {
    const index = stack.indexOf(entry);
    if (index === -1) return;
    stack.splice(index, 1);
    if (!entry.pushed) {
      pushWaitingEntries();
      return;
    }
    removed.push(entry.id);
    if (!flushScheduled) {
      flushScheduled = true;
      queueMicrotask(flushRemovals);
    }
  };
}
