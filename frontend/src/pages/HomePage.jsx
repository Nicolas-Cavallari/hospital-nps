import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../components/brand/Logo.jsx';
import Button from '../components/ui/Button.jsx';
import { getApiHealth, getDatabaseHealth } from '../services/api.js';
import './HomePage.css';

const BADGE = {
  checking: { className: 'badge-neutral', label: 'Verificando' },
  ok: { className: 'badge-success', label: 'Funcionando' },
  unavailable: { className: 'badge-critical', label: 'Indisponível' },
  not_configured: { className: 'badge-warning', label: 'Não configurado' },
  skipped: { className: 'badge-neutral', label: 'Aguardando a API' },
};

const INITIAL = { api: 'checking', database: 'checking' };

// Atalhos temporários de desenvolvimento ("exemplo" não é um setor real).
const SCREEN_LINKS = [
  { to: '/pesquisa/exemplo', label: 'Pesquisa pública (fluxo completo)' },
  { to: '/login', label: 'Login' },
  { to: '/admin', label: 'Área administrativa (exige login)' },
];

export default function HomePage() {
  const [checks, setChecks] = useState(INITIAL);

  const runChecks = useCallback(async () => {
    setChecks(INITIAL);

    let api = 'unavailable';
    try {
      const result = await getApiHealth();
      if (result.ok && result.body?.status === 'ok') api = 'ok';
    } catch {
      // falha de rede: API indisponível
    }

    if (api !== 'ok') {
      setChecks({ api, database: 'skipped' });
      return;
    }

    let database = 'unavailable';
    try {
      const result = await getDatabaseHealth();
      if (result.ok && result.body?.database === 'ok') database = 'ok';
      else if (result.body?.database === 'not_configured') database = 'not_configured';
    } catch {
      // falha de rede: banco indisponível
    }

    setChecks({ api, database });
  }, []);

  useEffect(() => {
    runChecks();
  }, [runChecks]);

  const rows = [
    { name: 'Interface (frontend)', state: 'ok' },
    { name: 'API (backend)', state: checks.api },
    { name: 'Banco de dados', state: checks.database },
  ];

  return (
    <main className="home">
      <section className="home-card" aria-labelledby="home-title">
        <Logo className="home-logo" />

        <h1 id="home-title">Verificação do sistema</h1>
        <p className="home-subtitle">
          Ambiente de desenvolvimento. Esta página será substituída nas próximas etapas.
        </p>

        <ul className="home-checks" aria-live="polite">
          {rows.map(({ name, state }) => (
            <li key={name} className="home-check">
              <span>{name}</span>
              <span className={`badge ${BADGE[state].className}`}>{BADGE[state].label}</span>
            </li>
          ))}
        </ul>

        <Button variant="secondary" onClick={runChecks}>
          Verificar novamente
        </Button>

        <h2 className="home-section">Atalhos de desenvolvimento</h2>
        <ul className="home-links">
          {SCREEN_LINKS.map(({ to, label }) => (
            <li key={to}>
              <Link to={to}>{label}</Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
