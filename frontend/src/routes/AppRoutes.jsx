import { Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext.jsx';
import RequireAuth from '../auth/RequireAuth.jsx';
import AdminHomePage from '../pages/admin/AdminHomePage.jsx';
import ChangePasswordPage from '../pages/admin/ChangePasswordPage.jsx';
import LoginPage from '../pages/admin/LoginPage.jsx';
import HomePage from '../pages/HomePage.jsx';
import NotFoundPage from '../pages/NotFoundPage.jsx';
import SurveyPage from '../pages/public/SurveyPage.jsx';

// A sessão só é consultada nas telas privadas; a pesquisa pública não depende dela.
function PrivateArea() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}

// Caminhos conforme o "Mapa de URLs" do README (não renomear sem autorização).
// "/admin/*" continua reservado; por ora existe apenas a tela inicial da área privada.
export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/pesquisa/:slug" element={<SurveyPage />} />
      <Route element={<PrivateArea />}>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/trocar-senha"
          element={
            <RequireAuth>
              <ChangePasswordPage />
            </RequireAuth>
          }
        />
        <Route
          path="/admin"
          element={
            <RequireAuth>
              <AdminHomePage />
            </RequireAuth>
          }
        />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
