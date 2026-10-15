import { useId } from 'react';
import './TextField.css';

export default function TextField({
  label,
  icon: Icon,
  error,
  hint,
  id,
  className = '',
  inputRef,
  ...inputProps
}) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const describedBy = [error && errorId, hint && hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`field ${error ? 'field--error' : ''} ${className}`.trim()}>
      <label className="field__label" htmlFor={inputId}>
        {label}
      </label>
      <div className="field__control">
        {Icon && <Icon className="field__icon" aria-hidden="true" size={20} />}
        <input
          id={inputId}
          ref={inputRef}
          className={`field__input ${Icon ? 'field__input--icon' : ''}`.trim()}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...inputProps}
        />
      </div>
      {error && (
        <p id={errorId} className="field__error">
          {error}
        </p>
      )}
      {hint && (
        <p id={hintId} className="field__hint">
          {hint}
        </p>
      )}
    </div>
  );
}
