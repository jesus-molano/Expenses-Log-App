export default function Loading() {
  return (
    <main className="grid min-h-dvh place-items-center bg-[radial-gradient(circle_at_50%_0%,rgba(132,204,22,0.16),transparent_28%),linear-gradient(180deg,#020617_0%,#07111f_52%,#020617_100%)] px-6 text-center text-white">
      <div>
        <div className="mx-auto size-11 animate-pulse rounded-full border border-lime-200/30 bg-lime-300/18 shadow-[0_0_34px_rgba(132,204,22,0.35)]" />
        <p className="mt-3 text-sm font-semibold text-slate-200">Cargando...</p>
      </div>
    </main>
  );
}
