import { Navigate, useLocation } from 'react-router-dom';
import PrivateLayout from '../components/layout/PrivateLayout.jsx';
import { useAuth } from './AuthContext.jsx';

export function LoadingScreen() {
  return (
    <PrivateLayout>
      <p role="status" className="auth__subtitle">
        Carregando…
      </p>
    </PrivateLayout>
  );
}

/**
 * Guarda de rota da área privada:
 *  - sem login -> /login;
 *  - com senha temporária pendente -> só a tela de troca de senha;
 *  - sem pendência, a tela de troca obrigatória não faz sentido -> /admin.
 */
export default function RequireAuth({ children }) {
  const { status, user } = useAuth();
  const { pathname } = useLocation();

  if (status === 'loading') return <LoadingScreen />;
  if (status !== 'authenticated') return <Navigate to="/login" replace />;

  if (user.mustChangePassword && pathname !== '/trocar-senha') {
    return <Navigate to="/trocar-senha" replace />;
  }
  if (!user.mustChangePassword && pathname === '/trocar-senha') {
    return <Navigate to="/admin" replace />;
  }
  return children;
}
