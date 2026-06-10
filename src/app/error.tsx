"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="grid min-h-dvh place-items-center bg-slate-100 px-6 text-center text-slate-700">
      <div className="max-w-sm rounded-[1.25rem] bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-rose-700">Error de aplicacion</p>
        <h1 className="mt-2 text-xl font-semibold text-slate-950">
          No se pudo cargar esta vista
        </h1>
        <p className="mt-2 text-sm text-slate-500">{error.message}</p>
        <button
          type="button"
          onClick={reset}
          className="mt-5 h-11 rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white"
        >
          Reintentar
        </button>
      </div>
    </main>
  );
}
