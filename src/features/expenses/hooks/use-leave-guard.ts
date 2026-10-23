"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { afterLayerHistorySettles } from "@/components/ui/sheet-history";
import { useHistoryLayer } from "@/components/ui/use-history-layer";

const LIST_HREF = "/";
// Si Atrás no sale de la página en este plazo (se abrió el detalle desde un
// enlace directo y no hay entrada anterior), se va a la lista.
const BACK_FALLBACK_MS = 500;

// "list": a la lista sustituyendo la entrada (guardar o borrar), para que
// Atrás desde la lista no reabra el editor. "back": la entrada anterior, que
// es la lista cuando se llegó desde ella (el control de volver o Atrás).
type LeaveTarget = "list" | "back";
type LeaveIntent = { target: LeaveTarget; action?: () => void };
// Quién pidió confirmar: Atrás ya ha gastado la entrada de la guarda.
type DiscardPrompt = "back" | "control";

type AppRouter = ReturnType<typeof useRouter>;

function goBackOrToList(router: AppRouter) {
  // popstate si la entrada anterior es de la app; pagehide si es otro
  // documento (y entonces el plazo puede reanudarse al volver desde la caché
  // del navegador: no debe navegar).
  let left = false;
  const markLeft = () => {
    left = true;
  };
  window.addEventListener("popstate", markLeft, { once: true });
  window.addEventListener("pagehide", markLeft, { once: true });
  router.back();
  window.setTimeout(() => {
    window.removeEventListener("popstate", markLeft);
    window.removeEventListener("pagehide", markLeft);
    if (!left) router.replace(LIST_HREF);
  }, BACK_FALLBACK_MS);
}

// Salida de una pantalla con cambios sin guardar. Mientras hay cambios, Atrás
// (botón o gesto de Android) pregunta antes de salir en lugar de salir.
export function useLeaveGuard(dirty: boolean) {
  const router = useRouter();
  const [prompt, setPrompt] = useState<DiscardPrompt | null>(null);
  const [intent, setIntent] = useState<LeaveIntent | null>(null);

  // Tras un Atrás la entrada ya no está: se vuelve a poner si se sigue
  // editando.
  useHistoryLayer(dirty && intent === null && prompt !== "back", () =>
    setPrompt("back"),
  );

  // Al volver a la pantalla desde la caché del navegador (Adelante tras salir
  // a otro documento), la salida ya ocurrió: la guarda vuelve a estar activa.
  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      if (!event.persisted) return;
      setIntent(null);
      setPrompt(null);
    }
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  useEffect(() => {
    if (!intent) return;
    // La guarda y el diálogo se cierran en este mismo render: se navega
    // cuando han quitado su entrada del historial, porque esa vuelta atrás
    // desharía la navegación.
    return afterLayerHistorySettles(() => {
      intent.action?.();
      if (intent.target === "back") goBackOrToList(router);
      else router.replace(LIST_HREF);
    });
  }, [intent, router]);

  return {
    discardPromptOpen: prompt !== null,
    // El control de volver de la pantalla.
    requestLeave() {
      if (dirty) setPrompt("control");
      else setIntent({ target: "back" });
    },
    // Salir tras guardar o borrar. `action` corre justo antes de navegar.
    leaveToList(action?: () => void) {
      setPrompt(null);
      setIntent({ target: "list", action });
    },
    discardChanges() {
      setPrompt(null);
      setIntent({ target: "back" });
    },
    keepEditing() {
      setPrompt(null);
    },
  };
}
