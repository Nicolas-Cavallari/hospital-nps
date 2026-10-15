import { Route, Routes } from 'react-router-dom';
import ChangePasswordPage from '../pages/admin/ChangePasswordPage.jsx';
import LoginPage from '../pages/admin/LoginPage.jsx';
import HomePage from '../pages/HomePage.jsx';
import NotFoundPage from '../pages/NotFoundPage.jsx';
import SurveyPage from '../pages/public/SurveyPage.jsx';

// Caminhos conforme o "Mapa de URLs" do README (não renomear sem autorização).
// "/admin/*" continua reservado: ainda não há telas administrativas.
export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/pesquisa/:slug" element={<SurveyPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/trocar-senha" element={<ChangePasswordPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
