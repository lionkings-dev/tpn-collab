import { useEffect, useRef } from "react";
import "./toastPopup.css";

export type ToastType = "success" | "error" | "info";

type ToastPopupProps = {
  open: boolean;
  message: string;
  type?: ToastType;
  durationMs?: number;
  onClose: () => void;
  showCloseButton?: boolean;
};

export default function ToastPopup({
  open,
  message,
  type = "info",
  durationMs = 2500,
  onClose,
  showCloseButton = true,
}: ToastPopupProps) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    timeoutRef.current = setTimeout(() => {
      onClose();
    }, durationMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [open, durationMs, onClose, message]);

  if (!open || !message) return null;

  return (
    <div className="toast-popup-overlay" aria-live="polite">
      <div className={`toast-popup toast-${type}`} role="status">
        <span className="toast-message">{message}</span>
        {showCloseButton && (
          <button
            type="button"
            className="toast-close"
            onClick={onClose}
            aria-label="Close notification"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
