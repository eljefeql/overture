import { cn } from "@/lib/utils";

type Props = {
  title: string;
  showTitle?: string;
  meta?: string;
  className?: string;
  statusDot?: "auditions_open" | "callbacks" | "casting" | "cast" | "setup";
};

const dotColors: Record<string, string> = {
  auditions_open: "bg-forest-500",
  callbacks: "bg-stage-500",
  casting: "bg-curtain-500",
  cast: "bg-forest-700",
  setup: "bg-clay-400",
};

export function PageHeader({
  title,
  showTitle,
  meta,
  statusDot,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "bg-curtain-800 text-white px-6 py-3 border-b border-curtain-700",
        className
      )}
    >
      <div className="max-w-7xl mx-auto flex items-center gap-3 text-sm">
        <span className="font-display text-base text-white flex items-center gap-2">
          {statusDot && (
            <span
              className={cn(
                "w-2 h-2 rounded-full flex-shrink-0",
                dotColors[statusDot] ?? "bg-clay-400"
              )}
            />
          )}
          {title}
        </span>
        {showTitle && (
          <>
            <span className="text-curtain-500">|</span>
            <span className="text-curtain-300">{showTitle}</span>
          </>
        )}
        {meta && (
          <>
            <span className="text-curtain-500 hidden sm:inline">&middot;</span>
            <span className="text-curtain-400 hidden sm:inline">{meta}</span>
          </>
        )}
      </div>
    </div>
  );
}
