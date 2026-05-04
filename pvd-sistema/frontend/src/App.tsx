import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/auth.store';
import LoginPage from './pages/LoginPage';
import AppShell from './components/AppShell';
import PDVPage from './pages/PDVPage';
import KitchenPage from './pages/KitchenPage';
import DeliveriesPage from './pages/DeliveriesPage';
import ProductsPage from './pages/ProductsPage';
import ReportsPage from './pages/ReportsPage';
import EquipePage from './pages/EquipePage';
import DescontosPage from './pages/DescontosPage';
import CaixaPage from './pages/CaixaPage';
import CategoriesPage from './pages/CategoriesPage';

function Protected({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Protected><AppShell /></Protected>}>
        <Route index element={<Navigate to="/pdv" replace />} />
        <Route path="pdv" element={<PDVPage />} />
        <Route path="cozinha" element={<KitchenPage />} />
        <Route path="entregas" element={<DeliveriesPage />} />
        <Route path="caixa" element={<CaixaPage />} />
        <Route path="categorias" element={<CategoriesPage />} />
        <Route path="produtos" element={<ProductsPage />} />
        <Route path="relatorios" element={<ReportsPage />} />
        <Route path="equipe" element={<EquipePage />} />
        <Route path="descontos" element={<DescontosPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
