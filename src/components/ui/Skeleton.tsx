import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  width?: string;
  height?: string;
};

export function Skeleton({ className, width, height }: Props) {
  return (
    <div
      className={cn("skeleton", className)}
      style={{ width, height }}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-cream-200 p-5 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}
