"use client";

import { useEffect } from "react";
import { skipOrphanLayerEntry } from "@/components/ui/sheet-history";

// Tras recargar con una hoja abierta, la entrada actual del historial es de
// una hoja que ya no existe: se salta para que el primer Atrás no parezca no
// hacer nada.
export function OrphanLayerGuard() {
  useEffect(() => {
    skipOrphanLayerEntry();
  }, []);
  return null;
}
