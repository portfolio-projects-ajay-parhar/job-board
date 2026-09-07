"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

type ToastType = "success" | "error" | "info";
type Toast = { id: number; message: string; type: ToastType };

const ToastContext = createContext<{ toast: (message: string, type?: ToastType) => void }>({
  toast: () => {},
});

/** Access the app-wide toast function. */
export const useToast = () => useContext(ToastContext);

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
      }),
  );
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = "info") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <ToastContext.Provider value={{ toast }}>
          {children}
          <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
            {toasts.map((t) => (
              <div
                key={t.id}
                role="status"
                className={`rounded-lg px-4 py-3 text-sm text-white shadow-lg ${
                  t.type === "success"
                    ? "bg-emerald-600"
                    : t.type === "error"
                      ? "bg-red-600"
                      : "bg-slate-800"
                }`}
              >
                {t.message}
              </div>
            ))}
          </div>
        </ToastContext.Provider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
