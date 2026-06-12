"use client";

import { Button } from "@/components/ui/Button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="app-page grid min-h-dvh place-items-center px-6 text-center">
      <div className="app-section-card max-w-sm p-5">
        <p className="text-sm font-semibold text-[var(--app-danger)]">
          Error de aplicacion
        </p>
        <h1 className="mt-2 text-xl font-semibold text-[var(--app-text)]">
          No se pudo cargar esta vista
        </h1>
        <p className="mt-2 text-sm text-[var(--app-text-muted)]">
          {error.message}
        </p>
        <Button
          type="button"
          onClick={reset}
          className="mt-5"
        >
          Reintentar
        </Button>
      </div>
    </main>
  );
}
