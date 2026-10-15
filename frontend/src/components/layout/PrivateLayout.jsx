import Logo from '../brand/Logo.jsx';
import './PrivateLayout.css';

/** Área privada (login e troca de senha): cartão compacto e centralizado, estilo de formulário. */
export default function PrivateLayout({ children }) {
  return (
    <div className="private">
      <main className="private__card">
        <Logo className="private__logo" />
        {children}
      </main>
    </div>
  );
}
