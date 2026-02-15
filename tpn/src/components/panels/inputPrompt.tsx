import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import "./inputPrompt.css";

type InputPromptProps = {
  open: boolean;
  title: string;
  description?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  validate?: (value: string) => string | null;
  onConfirm: (value: string) => void;
  onCancel: () => void;
};

export default function InputPrompt({
  open,
  title,
  description,
  placeholder,
  defaultValue = "",
  confirmLabel = "Save",
  cancelLabel = "Cancel",
  validate,
  onConfirm,
  onCancel,
}: InputPromptProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setValue(defaultValue);
    setError("");
    const timer = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
    return () => clearTimeout(timer);
  }, [open, defaultValue]);

  if (!open) return null;

  const runValidation = (nextValue: string) => {
    if (!validate) return null;
    return validate(nextValue);
  };

  const handleConfirm = () => {
    const trimmed = value.trim();
    const validationError = runValidation(trimmed);
    if (validationError) {
      setError(validationError);
      return;
    }

    onConfirm(trimmed);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleConfirm();
    }

    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="input-prompt-backdrop" role="dialog" aria-modal="true">
      <div className="input-prompt-card">
        <h3 className="input-prompt-title">{title}</h3>
        {description && <p className="input-prompt-description">{description}</p>}
        <input
          ref={inputRef}
          className={`input-prompt-input ${error ? "is-invalid" : ""}`}
          placeholder={placeholder}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            if (error) setError("");
          }}
          onKeyDown={handleKeyDown}
        />
        {error && <p className="input-prompt-error">{error}</p>}
        <div className="input-prompt-actions">
          <button type="button" className="input-prompt-btn ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className="input-prompt-btn" onClick={handleConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
