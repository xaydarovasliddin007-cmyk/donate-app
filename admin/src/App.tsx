import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { Layout } from './components/Layout';
import { Loading } from './components/Loading';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { UsersPage } from './pages/UsersPage';
import { UserDetailPage } from './pages/UserDetailPage';
import { OrdersPage } from './pages/OrdersPage';
import { OrderDetailPage } from './pages/OrderDetailPage';
import { TopUpsPage } from './pages/TopUpsPage';
import { RefundsPage } from './pages/RefundsPage';
import { ReceivingMethodsPage } from './pages/ReceivingMethodsPage';
import { ProductsPage } from './pages/ProductsPage';
import { ProvidersPage } from './pages/ProvidersPage';
import { AdminsPage } from './pages/AdminsPage';
import { AuditLogsPage } from './pages/AuditLogsPage';

function RequireAuth({ children }: { children: React.ReactElement }) {
  const { admin, loading } = useAuth();
  if (loading) return <Loading />;
  if (!admin) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/users/:userId" element={<UserDetailPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/orders/:orderId" element={<OrderDetailPage />} />
        <Route path="/topups" element={<TopUpsPage />} />
        <Route path="/refunds" element={<RefundsPage />} />
        <Route path="/receiving-methods" element={<ReceivingMethodsPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/providers" element={<ProvidersPage />} />
        <Route path="/audit-logs" element={<AuditLogsPage />} />
        <Route path="/admins" element={<AdminsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
