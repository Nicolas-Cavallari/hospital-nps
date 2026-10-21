import { Circle, CircleCheck, Lock } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import PrivateLayout from '../../components/layout/PrivateLayout.jsx';
import Alert from '../../components/ui/Alert.jsx';
import Button from '../../components/ui/Button.jsx';
import StrengthMeter from '../../components/ui/StrengthMeter.jsx';
import TextField from '../../components/ui/TextField.jsx';
import { evaluatePassword } from './passwordRules.js';
import './auth.css';

const RULES = [
  { key: 'length', label: 'Mínimo de 10 caracteres' },
  { key: 'mixedCase', label: 'Letra maiúscula e minúscula' },
  { key: 'numberAndSpecial', label: 'Número e caractere especial' },
];

/**
 * Troca obrigatória da senha temporária. As regras exibidas aqui são só orientação visual:
 * o backend aplica a política de senha e recusa o que não cumprir.
 */
export default function ChangePasswordPage() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const result = evaluatePassword(password);
  const mismatch = confirm !== '' && confirm !== password;
  const showMismatch = mismatch && (confirmTouched || confirm.length >= password.length);

  async function handleSubmit(event) {
    event.preventDefault();
    setConfirmTouched(true);
    setSubmitError('');
    if (!result.valid || confirm !== password) return;

    setSubmitting(true);
    const outcome = await updatePassword(password);
    setSubmitting(false);
    if (outcome.ok) {
      navigate('/admin', { replace: true });
    } else {
      setSubmitError(outcome.message);
    }
  }

  return (
    <PrivateLayout>
      <div className="auth__header">
        <p className="eyebrow">Senha obrigatória</p>
        <h1 className="auth__title">Defina uma nova senha</h1>
        <p className="auth__subtitle">
          Crie uma senha exclusiva para concluir a ativação da sua conta.
        </p>
      </div>

      <form className="auth__form" onSubmit={handleSubmit} noValidate>
        <TextField
          label="Nova senha"
          type="password"
          icon={Lock}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <TextField
          label="Confirmar nova senha"
          type="password"
          icon={Lock}
          autoComplete="new-password"
          value={confirm}
          error={showMismatch ? 'As senhas ainda não coincidem.' : undefined}
          onChange={(e) => setConfirm(e.target.value)}
          onBlur={() => setConfirmTouched(true)}
        />

        <StrengthMeter score={result.score} />

        <ul className="rules">
          {RULES.map(({ key, label }) => {
            const met = result.rules[key];
            const Icon = met ? CircleCheck : Circle;
            return (
              <li key={key} className={`rule ${met ? 'is-met' : ''}`.trim()}>
                <Icon aria-hidden="true" size={18} className="rule__icon" />
                <span className="visually-hidden">{met ? 'Atendido: ' : 'Pendente: '}</span>
                {label}
              </li>
            );
          })}
        </ul>

        {submitError && <Alert variant="critical">{submitError}</Alert>}

        <Button type="submit" size="lg" fullWidth disabled={submitting}>
          {submitting ? 'Salvando…' : 'Salvar nova senha'}
        </Button>
      </form>
    </PrivateLayout>
  );
}
