export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="h-6 w-48 animate-pulse rounded bg-slate-200" />
      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="h-96 animate-pulse rounded-xl bg-slate-200 lg:col-span-2" />
        <div className="h-64 animate-pulse rounded-xl bg-slate-200" />
      </div>
    </div>
  );
}
