import { Skeleton } from "@/components/ui/skeleton";

/** What shows while the home reads the address, the session and the games: the same shape as the title, the search box, the filters and the first cards. */
export function HomeSkeleton() {
  return (
    <div aria-hidden="true" className="mx-auto grid max-w-[1200px] gap-8 px-5 pt-[clamp(32px,5vw,56px)]">
      <div className="grid gap-5">
        <Skeleton className="h-12 w-full max-w-[420px] rounded-2xl" />
        <Skeleton className="h-14 w-full max-w-[640px] rounded-full" />
      </div>
      <Skeleton className="h-48 rounded-3xl" />
      <div className="grid min-h-svh content-start gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-[300px] rounded-3xl" />
        ))}
      </div>
    </div>
  );
}
