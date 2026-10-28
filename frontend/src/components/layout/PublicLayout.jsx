import Logo from '../brand/Logo.jsx';
import './PublicLayout.css';

/** Área pública (pesquisa): cartão alto, pensado para toque, com a ação principal fixa no rodapé. */
export default function PublicLayout({ children, notice = null }) {
  return (
    <div className="public">
      <main className="public__card">
        <header className="public__header">
          <Logo className="public__logo" />
        </header>
        {notice && <div className="public__notice">{notice}</div>}
        {children}
      </main>
    </div>
  );
}
