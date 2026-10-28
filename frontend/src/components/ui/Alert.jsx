import { CircleAlert, Info, TriangleAlert } from 'lucide-react';
import './Alert.css';

const ICONS = { critical: CircleAlert, info: Info, warning: TriangleAlert };

export default function Alert({ variant = 'info', title, children }) {
  const Icon = ICONS[variant];

  return (
    <div className={`alert alert--${variant}`} role={variant === 'critical' ? 'alert' : 'status'}>
      <Icon aria-hidden="true" size={20} className="alert__icon" />
      <p>
        {title && <strong>{title} </strong>}
        {children}
      </p>
    </div>
  );
}
