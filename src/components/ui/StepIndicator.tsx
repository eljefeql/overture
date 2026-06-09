"use client";

import { cn } from "@/lib/utils";
import { Check } from "@phosphor-icons/react";

type Props = {
  steps: string[];
  currentStep: number; // 0-indexed
};

export function StepIndicator({ steps, currentStep }: Props) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {steps.map((label, i) => {
        const isCompleted = i < currentStep;
        const isCurrent = i === currentStep;
        const isFuture = i > currentStep;

        return (
          <div key={label} className="flex items-center">
            {/* Circle */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors",
                  isCompleted && "bg-forest-500 text-white",
                  isCurrent && "bg-stage-500 text-curtain-900",
                  isFuture && "bg-cream-200 text-curtain-700"
                )}
              >
                {isCompleted ? (
                  <Check className="w-4 h-4" weight="bold" />
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={cn(
                  "text-[10px] font-semibold mt-1.5 tracking-wide uppercase",
                  isCurrent ? "text-curtain-900" : "text-clay-400"
                )}
              >
                {label}
              </span>
            </div>

            {/* Connector line (not after last) */}
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "w-12 sm:w-20 h-0.5 mx-2 mb-5",
                  i < currentStep ? "bg-forest-500" : "bg-cream-200"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
