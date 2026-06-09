import { Card } from "./Card";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value: string;
  className?: string;
};

/**
 * Stat block for displaying a label/value pair in a sunken card.
 * Used for vitals (height, vocal range), measurements, metrics.
 * See CLAUDE.md "Stat Block" pattern.
 */
export function StatBlock({ label, value, className }: Props) {
  return (
    <Card variant="flat" padding="compact" className={cn("text-center", className)}>
      <p className="text-[10px] font-semibold text-clay-400 tracking-wide uppercase">
        {label}
      </p>
      <p className="text-lg font-semibold text-curtain-900">{value}</p>
    </Card>
  );
}
