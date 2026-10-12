import { Skeleton } from "@/components/ui/misc";

// Instant loading state for every page in the app. It also makes link
// prefetching cheap: Next only prefetches dynamic routes down to the nearest
// loading boundary, so visible links no longer render whole pages (and run
// their database queries) in the background.
export default function AppLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="space-y-3">
        <Skeleton className="h-8 w-56 rounded-xl" />
        <Skeleton className="h-4 w-80 max-w-full rounded-lg" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-36 w-full rounded-3xl" />
          ))}
        </div>
        <Skeleton className="hidden h-64 w-full rounded-3xl lg:block" />
      </div>
    </div>
  );
}
