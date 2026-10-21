import { useAuth } from '../../auth/AuthContext.jsx';
import PrivateLayout from '../../components/layout/PrivateLayout.jsx';
import Button from '../../components/ui/Button.jsx';
import './auth.css';

const ROLE_LABELS = {
  super_admin: 'Super Admin',
  gestor: 'Gestor',
  ouvidoria: 'Ouvidoria',
};

/** Ponto de chegada após o login. As funcionalidades de cada perfil chegam nas próximas etapas. */
export default function AdminHomePage() {
  const { user, signOut } = useAuth();

  return (
    <PrivateLayout>
      <div className="auth__header">
        <p className="eyebrow">{ROLE_LABELS[user.role] ?? 'Área administrativa'}</p>
        <h1 className="auth__title">Olá, {user.fullName.split(' ')[0]}</h1>
        <p className="auth__subtitle">
          Você entrou como <strong>{user.username}</strong>. As funcionalidades da sua área serão
          liberadas nas próximas etapas.
        </p>
      </div>
      <Button variant="secondary" size="lg" fullWidth onClick={signOut}>
        Sair
      </Button>
    </PrivateLayout>
  );
}
