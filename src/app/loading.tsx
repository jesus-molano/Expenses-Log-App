export default function Loading() {
  return (
    <main className="grid min-h-dvh place-items-center bg-slate-100 px-6 text-center text-slate-600">
      <div>
        <div className="mx-auto size-10 animate-pulse rounded-full bg-slate-300" />
        <p className="mt-3 text-sm font-medium">Cargando gastos...</p>
      </div>
    </main>
  );
}
