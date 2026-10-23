"use client";

import {
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

export function useExpenseDndSensors() {
  return useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        delay: 220,
        tolerance: 6,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 260,
        tolerance: 8,
      },
    }),
    // Intro queda para abrir las acciones del cobro; Espacio arrastra.
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: {
        start: ["Space"],
        cancel: ["Escape"],
        end: ["Space", "Enter"],
      },
    }),
  );
}
