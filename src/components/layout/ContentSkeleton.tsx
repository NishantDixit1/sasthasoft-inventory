/** Placeholder shown for the moment between first paint and hydration. */
export function ContentSkeleton() {
  return (
    <div className="animate-pulse" aria-hidden>
      <div className="mb-6 h-8 w-56 rounded-lg bg-surface-2" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className="h-[132px] rounded-[var(--radius-card)] border border-line bg-surface"
          />
        ))}
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-12">
        <div className="h-[360px] rounded-[var(--radius-card)] border border-line bg-surface xl:col-span-8" />
        <div className="h-[360px] rounded-[var(--radius-card)] border border-line bg-surface xl:col-span-4" />
      </div>
    </div>
  );
}
