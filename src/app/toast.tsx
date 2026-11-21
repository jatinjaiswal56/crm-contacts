import { X } from "lucide-react";
import styles from "./contacts-workspace.module.css";
import type { ToastState } from "./use-toast";

type Props = {
  toast: ToastState | null;
  onDismiss: () => void;
};

export function Toast({ toast, onDismiss }: Props) {
  if (!toast) return null;

  return (
    <div
      className={`${styles.toast} ${
        toast.tone === "error" ? styles.toastError : styles.toastSuccess
      }`}
      role={toast.tone === "error" ? "alert" : "status"}
    >
      <span>{toast.message}</span>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={onDismiss}
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
