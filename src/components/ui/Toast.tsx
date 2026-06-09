"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CheckCircle, WarningCircle, XCircle, X } from "@phosphor-icons/react";

type ToastType = "success" | "error" | "info";

type Toast = {
  id: string;
  type: ToastType;
  message: string;
};

type ToastContextType = {
  toast: (type: ToastType, message: string) => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

const iconMap = {
  success: CheckCircle,
  error: XCircle,
  info: WarningCircle,
};

const styleMap = {
  success: "bg-forest-700 text-white",
  error: "bg-ruby-600 text-white",
  info: "bg-curtain-800 text-white",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        {toasts.map((t) => {
          const Icon = iconMap[t.type];
          return (
            <div
              key={t.id}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg min-w-[280px] animate-scale-in",
                styleMap[t.type]
              )}
            >
              <Icon className="w-5 h-5 flex-shrink-0" weight="fill" />
              <span className="text-sm font-medium flex-1">{t.message}</span>
              <button
                onClick={() => removeToast(t.id)}
                className="opacity-70 hover:opacity-100 transition"
              >
                <X className="w-4 h-4" weight="bold" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
