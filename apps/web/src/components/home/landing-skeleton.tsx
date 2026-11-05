import { Skeleton } from "@/components/ui/skeleton";

export function LandingSkeleton() {
  return (
    <div aria-hidden="true" className="mx-auto grid max-w-[1200px] gap-16 px-5 pt-[clamp(56px,7vw,96px)]">
      <Skeleton className="h-[420px] rounded-[28px]" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-[330px] rounded-3xl" />
        <Skeleton className="h-[330px] rounded-3xl max-md:hidden" />
        <Skeleton className="h-[330px] rounded-3xl max-lg:hidden" />
        <Skeleton className="h-[330px] rounded-3xl max-lg:hidden" />
      </div>
    </div>
  );
}
