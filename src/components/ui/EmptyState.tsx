import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Props = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ icon, title, description, action, className }: Props) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 px-6 text-center", className)}>
      {icon && (
        <div className="text-curtain-200 mb-4">{icon}</div>
      )}
      <h3 className="text-lg font-display text-curtain-700 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-clay-500 max-w-sm mb-6">{description}</p>
      )}
      {action}
    </div>
  );
}
