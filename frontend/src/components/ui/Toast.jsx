import Alert from './Alert.jsx';
import './Toast.css';

/** Aviso temporário no topo da tela (não bloqueia nada). */
export default function Toast({ variant = 'warning', children }) {
  return (
    <div className="toast">
      <Alert variant={variant}>{children}</Alert>
    </div>
  );
}
