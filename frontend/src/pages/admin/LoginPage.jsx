import { Lock, User } from 'lucide-react';
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { LoadingScreen } from '../../auth/RequireAuth.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import PrivateLayout from '../../components/layout/PrivateLayout.jsx';
import Alert from '../../components/ui/Alert.jsx';
import Button from '../../components/ui/Button.jsx';
import Checkbox from '../../components/ui/Checkbox.jsx';
import TextField from '../../components/ui/TextField.jsx';
import './auth.css';

const CREDENTIALS_ERROR = 'Não foi possível entrar. Confira o usuário e a senha.';

export default function LoginPage() {
  const { status, user, signIn } = useAuth();
  const [form, setForm] = useState({ username: '', password: '', remember: false });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (status === 'loading') return <LoadingScreen />;
  if (status === 'authenticated') {
    return <Navigate to={user.mustChangePassword ? '/trocar-senha' : '/admin'} replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const next = {};
    if (!form.username.trim()) next.username = 'Informe o usuário.';
    if (!form.password) next.password = 'Informe a senha.';
    setErrors(next);
    setSubmitError('');
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    const result = await signIn(form.username.trim(), form.password, form.remember);
    setSubmitting(false);
    // Em caso de sucesso, o estado muda e o redirecionamento acima acontece sozinho.
    if (!result.ok) {
      setForm((current) => ({ ...current, password: '' }));
      setSubmitError(result.message ?? CREDENTIALS_ERROR);
    }
  }

  return (
    <PrivateLayout>
      <div className="auth__header">
        <p className="eyebrow">Entrar</p>
        <h1 className="auth__title">Gestão da Experiência do Paciente</h1>
        <p className="auth__subtitle">
          Use sua conta institucional para acessar indicadores e operações.
        </p>
      </div>

      <form className="auth__form" onSubmit={handleSubmit} noValidate>
        <TextField
          label="Usuário"
          icon={User}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={form.username}
          error={errors.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
        />
        <TextField
          label="Senha"
          type="password"
          icon={Lock}
          autoComplete="current-password"
          value={form.password}
          error={errors.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <Checkbox
          checked={form.remember}
          onChange={(e) => setForm({ ...form, remember: e.target.checked })}
        >
          Manter meu usuário neste dispositivo
        </Checkbox>

        {submitError && <Alert variant="critical">{submitError}</Alert>}

        <Button type="submit" size="lg" fullWidth disabled={submitting}>
          {submitting ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
    </PrivateLayout>
  );
}
