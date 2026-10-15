import { Check } from 'lucide-react';
import './Checkbox.css';

export default function Checkbox({ children, className = '', ...inputProps }) {
  return (
    <label className={`check ${className}`.trim()}>
      <input type="checkbox" className="check__input" {...inputProps} />
      <span className="check__box" aria-hidden="true">
        <Check size={14} strokeWidth={3} />
      </span>
      <span className="check__label">{children}</span>
    </label>
  );
}
