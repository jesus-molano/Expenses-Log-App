"use client";

import { useEffect, useRef } from "react";
import { registerHistoryLayer } from "./sheet-history";

// Mientras `active`, Atrás llama a `onClose` en lugar de salir de la pantalla.
export function useHistoryLayer(active: boolean, onClose: (() => void) | undefined) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!active) return;
    return registerHistoryLayer(() => onCloseRef.current?.());
  }, [active]);
}
