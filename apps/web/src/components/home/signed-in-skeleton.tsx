import { Skeleton } from "@/components/ui/skeleton";

/** What shows while the signed-in home reads the session and the person's data: same height as the greeting and the first cards. */
export function SignedInSkeleton() {
  return (
    <div aria-hidden="true" className="mx-auto grid max-w-[1200px] gap-8 px-5 pt-[clamp(32px,5vw,56px)]">
      <div className="mx-auto grid w-full max-w-[720px] justify-items-center gap-4">
        <Skeleton className="h-14 w-full max-w-[520px] rounded-2xl" />
        <Skeleton className="h-6 w-full max-w-[420px] rounded-xl" />
        <Skeleton className="h-14 w-full rounded-full" />
      </div>
      <div className="grid gap-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Skeleton className="h-[260px] rounded-3xl" />
        <Skeleton className="h-[260px] rounded-3xl" />
      </div>
    </div>
  );
}
