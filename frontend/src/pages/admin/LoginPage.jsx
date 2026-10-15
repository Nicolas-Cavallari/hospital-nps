import { Lock, User } from 'lucide-react';
import { useState } from 'react';
import PrivateLayout from '../../components/layout/PrivateLayout.jsx';
import Alert from '../../components/ui/Alert.jsx';
import Button from '../../components/ui/Button.jsx';
import Checkbox from '../../components/ui/Checkbox.jsx';
import TextField from '../../components/ui/TextField.jsx';
import './auth.css';

/** ETAPA 2 — somente interface: o login real (e a mensagem de erro de credenciais) vêm na etapa de autenticação. */
export default function LoginPage() {
  const [form, setForm] = useState({ username: '', password: '', remember: false });
  const [errors, setErrors] = useState({});
  const [showNotice, setShowNotice] = useState(false);

  function handleSubmit(event) {
    event.preventDefault();
    const next = {};
    if (!form.username.trim()) next.username = 'Informe o usuário.';
    if (!form.password) next.password = 'Informe a senha.';
    setErrors(next);
    setShowNotice(Object.keys(next).length === 0);
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

        {showNotice && (
          <Alert variant="info">
            O login ainda não está ativo. Ele será habilitado na etapa de autenticação.
          </Alert>
        )}

        <Button type="submit" size="lg" fullWidth>
          Entrar
        </Button>
      </form>
    </PrivateLayout>
  );
}
