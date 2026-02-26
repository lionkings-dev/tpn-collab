import { useCallback, useState } from "react";

import type { ToastType } from "../../../components/panels/toastPopup";

// Extracted from EditorPage (step 1) to keep toast state transitions in one place.

type ToastState = {
  open: boolean;
  message: string;
  type: ToastType;
};

export function useToastState() {
  const [toast, setToast] = useState<ToastState>({
    open: false,
    message: "",
    type: "info",
  });

  const notify = useCallback((message: string, type: ToastType = "info") => {
    setToast({
      open: true,
      message,
      type,
    });
  }, []);

  const closeToast = useCallback(() => {
    setToast((current) => ({
      ...current,
      open: false,
    }));
  }, []);

  return {
    toast,
    notify,
    closeToast,
  };
}
