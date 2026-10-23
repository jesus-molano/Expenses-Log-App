"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

function readOnline() {
  return navigator.onLine;
}

// El HTML prerenderizado no conoce la red del dispositivo: en el servidor y al
// hidratar se asume conexión, y React corrige justo después si no la hay.
function readServerOnline() {
  return true;
}

// Solo para avisar: navigator.onLine dice si hay red local, no si llega a
// internet (en iOS, o con una red sin salida, puede decir que sí sin haberla).
export function useOnlineStatus() {
  return useSyncExternalStore(subscribe, readOnline, readServerOnline);
}
