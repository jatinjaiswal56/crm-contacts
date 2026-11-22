import type {
  ChangeEventHandler,
  FocusEventHandler,
  InputHTMLAttributes,
} from "react";
import type { ContactWriteFields } from "@/lib/contacts/validation";
import styles from "./contact-dialog.module.css";

type Props = {
  name: keyof ContactWriteFields;
  label: string;
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  onBlur: FocusEventHandler<HTMLInputElement>;
  disabled: boolean;
  maxLength: number;
  error?: string;
  type?: InputHTMLAttributes<HTMLInputElement>["type"];
  inputMode?: InputHTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: string;
  pattern?: string;
  ariaLabel?: string;
  initialFocus?: boolean;
  fullWidth?: boolean;
  prefix?: string;
};

export function FormField({
  name,
  label,
  value,
  onChange,
  onBlur,
  disabled,
  maxLength,
  error,
  type,
  inputMode,
  autoComplete,
  pattern,
  ariaLabel,
  initialFocus,
  fullWidth,
  prefix,
}: Props) {
  const errorId = `${name}-error`;
  const input = (
    <input
      name={name}
      type={type}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      required
      disabled={disabled}
      maxLength={maxLength}
      inputMode={inputMode}
      autoComplete={autoComplete}
      pattern={pattern}
      aria-label={ariaLabel}
      aria-invalid={Boolean(error)}
      aria-describedby={error ? errorId : undefined}
      data-dialog-initial-focus={initialFocus ? "true" : undefined}
    />
  );

  return (
    <label className={fullWidth ? styles.dialogFullField : undefined}>
      <span>
        {label}
        <span className={styles.requiredMarker} aria-hidden="true">
          *
        </span>
      </span>
      {prefix ? (
        <span
          className={`${styles.phoneInput} ${
            error ? styles.invalidPhoneInput : ""
          }`}
        >
          <span className={styles.phonePrefix} aria-hidden="true">
            {prefix}
          </span>
          {input}
        </span>
      ) : (
        input
      )}
      {error ? (
        <span className={styles.fieldError} id={errorId}>
          {error}
        </span>
      ) : null}
    </label>
  );
}
