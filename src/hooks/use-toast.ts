import { useCallback, useEffect, useRef, useState } from "react";

export type ToastTone = "error" | "success";

export type ToastState = {
  id: number;
  message: string;
  tone: ToastTone;
};

const SUCCESS_TOAST_MS = 5000;

/**
 * Single-slot toast. Success toasts dismiss themselves; error toasts stay
 * until the user dismisses them so they cannot be missed.
 */
export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastId = useRef(0);

  const notify = useCallback((message: string, tone: ToastTone) => {
    toastId.current += 1;
    setToast({ id: toastId.current, message, tone });
  }, []);

  const dismiss = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (!toast || toast.tone !== "success") return;
    const timeout = window.setTimeout(() => setToast(null), SUCCESS_TOAST_MS);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  return { toast, notify, dismiss };
}
