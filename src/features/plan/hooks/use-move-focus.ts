"use client";

import { useEffect, useRef } from "react";

type Direction = -1 | 1;

// Subir o bajar una tarjeta la mueve en el DOM (el navegador suelta el foco
// del botón pulsado) y ese botón puede quedar desactivado al llegar al
// principio o al final. Cuando la tarjeta cambia de puesto, el foco vuelve al
// mismo botón o, si ya no se puede usar, al de la dirección contraria.
export function useMoveFocus({
  position,
  canMoveUp,
  canMoveDown,
  onMove,
}: {
  position: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (direction: Direction) => void;
}) {
  const upRef = useRef<HTMLButtonElement>(null);
  const downRef = useRef<HTMLButtonElement>(null);
  const pendingRef = useRef<Direction | null>(null);

  useEffect(() => {
    const direction = pendingRef.current;
    if (direction === null) return;
    pendingRef.current = null;
    const sameStillWorks = direction === -1 ? canMoveUp : canMoveDown;
    const focusUp = direction === -1 ? sameStillWorks : !sameStillWorks;
    (focusUp ? upRef : downRef).current?.focus();
  }, [position, canMoveUp, canMoveDown]);

  return {
    upRef,
    downRef,
    move(direction: Direction) {
      pendingRef.current = direction;
      onMove(direction);
    },
  };
}
