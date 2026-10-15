import PrivateLayout from '../components/layout/PrivateLayout.jsx';
import '../pages/admin/auth.css';

export default function NotFoundPage() {
  return (
    <PrivateLayout>
      <div className="auth__header">
        <h1 className="auth__title">Página não encontrada</h1>
        <p className="auth__subtitle">Confira o endereço digitado e tente novamente.</p>
      </div>
    </PrivateLayout>
  );
}
