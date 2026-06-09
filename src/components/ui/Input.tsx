"use client";

import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="space-y-1">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold text-curtain-700 tracking-wide"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "w-full px-3 py-2.5 text-sm rounded-xl border bg-cream-50",
            "placeholder:text-clay-400",
            "transition-colors duration-150",
            error
              ? "border-ruby-400 focus:ring-2 focus:ring-ruby-200 focus:border-ruby-400"
              : "border-cream-300 focus:ring-2 focus:ring-curtain-200 focus:border-curtain-300",
            "outline-none",
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-ruby-500 mt-1">{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  error?: string;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="space-y-1">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold text-curtain-700 tracking-wide"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            "w-full px-3 py-2.5 text-sm rounded-xl border bg-cream-50 resize-none",
            "placeholder:text-clay-400",
            "transition-colors duration-150",
            error
              ? "border-ruby-400 focus:ring-2 focus:ring-ruby-200 focus:border-ruby-400"
              : "border-cream-300 focus:ring-2 focus:ring-curtain-200 focus:border-curtain-300",
            "outline-none",
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-ruby-500 mt-1">{error}</p>}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
