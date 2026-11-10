import { ChartNoAxesCombined, LogOut, MessageSquare } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import Logo from '../brand/Logo.jsx';
import './AdminLayout.css';

const roles = { super_admin: 'Super Admin', ouvidoria: 'Ouvidoria', gestor: 'Gestor' };

/** Estrutura visual compartilhada da área administrativa, baseada nas referências FHDOD. */
export default function AdminLayout({ title, children }) {
  const { user, signOut } = useAuth();
  const initials = user.fullName.trim().split(/\s+/).map((name) => name[0]).slice(0, 2).join('');
  return <div className="admin-layout">
    <a className="admin-layout__skip" href="#admin-content">Ir para o conteúdo</a>
    <aside className="admin-layout__sidebar">
      <NavLink to="/admin" className="admin-layout__brand" aria-label="FHDOD — Indicadores"><Logo /></NavLink>
      <p className="admin-layout__label">Experiência do paciente</p>
      <nav className="admin-layout__nav" aria-label="Área administrativa">
        <NavLink to="/admin" end><ChartNoAxesCombined size={19} aria-hidden="true" />Indicadores</NavLink>
        {['super_admin', 'ouvidoria'].includes(user.role) && <NavLink to="/admin/ouvidoria"><MessageSquare size={19} aria-hidden="true" />Ouvidoria</NavLink>}
      </nav>
      <section className="admin-layout__profile" aria-label="Perfil ativo">
        <p className="admin-layout__label">Perfil ativo</p>
        <strong>{roles[user.role]}</strong>
        <p>{user.role === 'gestor' ? 'Acesso restrito ao seu setor' : 'Todos os setores autorizados'}</p>
      </section>
      <footer className="admin-layout__institution">Fundação Hospitalar Dr. Oswaldo Diesel</footer>
    </aside>
    <div className="admin-layout__workspace">
      <header className="admin-layout__topbar">
        <div><strong>{title}</strong><p>FHDOD • Experiência do paciente</p></div>
        <div className="admin-layout__account"><span className="admin-layout__avatar" aria-hidden="true">{initials}</span><div><strong>{user.fullName}</strong><p>{roles[user.role]}</p></div><button type="button" onClick={signOut} className="admin-layout__logout"><LogOut size={17} aria-hidden="true" /><span>Sair</span></button></div>
      </header>
      <main id="admin-content" className="admin-layout__content">{children}</main>
      <footer className="admin-layout__footer"><span>FHDOD • Experiência do paciente</span><span>Dados exibidos conforme as permissões do perfil</span></footer>
    </div>
  </div>;
}
