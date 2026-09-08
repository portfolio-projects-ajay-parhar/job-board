export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="h-8 w-56 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
        ))}
      </div>
      <div className="mt-8 h-64 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
    </div>
  );
}
