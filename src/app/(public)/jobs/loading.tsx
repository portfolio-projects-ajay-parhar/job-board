export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="h-10 w-64 animate-pulse rounded-md bg-slate-200" />
      <div className="mt-6 h-12 w-full animate-pulse rounded-md bg-slate-200" />
      <div className="mt-8 flex flex-col gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 w-full animate-pulse rounded-xl bg-slate-200" />
        ))}
      </div>
    </div>
  );
}
