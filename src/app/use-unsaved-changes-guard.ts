import { useCallback, useEffect } from "react";

type Options = {
  open: boolean;
  hasUnsavedChanges: boolean;
  saving: boolean;
  onClose: () => void;
};

export function useUnsavedChangesGuard({
  open,
  hasUnsavedChanges,
  saving,
  onClose,
}: Options) {
  const requestClose = useCallback(() => {
    if (saving) {
      onClose();
      return;
    }
    if (
      hasUnsavedChanges &&
      !window.confirm("You have unsaved changes. Discard them and close?")
    ) {
      return;
    }
    onClose();
  }, [hasUnsavedChanges, onClose, saving]);

  useEffect(() => {
    if (!open || !hasUnsavedChanges) return;
    const preventLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", preventLeaving);
    return () => window.removeEventListener("beforeunload", preventLeaving);
  }, [hasUnsavedChanges, open]);

  return requestClose;
}
