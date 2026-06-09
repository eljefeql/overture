import { cn } from "@/lib/utils";

type Props = {
  date: string | Date;
  className?: string;
};

/**
 * Calendar-style date block showing day number + short month.
 * Used in dashboard audition cards and audition detail post-signup.
 * See CLAUDE.md "Date Block" pattern.
 */
export function DateBlock({ date, className }: Props) {
  const d = typeof date === "string" ? new Date(date) : date;

  return (
    <div
      className={cn(
        "w-14 h-14 rounded-xl bg-stage-100 flex flex-col items-center justify-center flex-shrink-0",
        className
      )}
    >
      <span className="text-lg font-display text-stage-700 leading-none">
        {d.getDate()}
      </span>
      <span className="text-[10px] font-semibold text-stage-500 uppercase">
        {d.toLocaleDateString("en-US", { month: "short" })}
      </span>
    </div>
  );
}
