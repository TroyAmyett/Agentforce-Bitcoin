import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useTheme } from './hooks/useTheme';
import { PortalLayout } from './components/PortalLayout';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { Dashboard } from './pages/Dashboard';
import { CaseList } from './pages/CaseList';
import { CaseDetail } from './pages/CaseDetail';
import { NewCase } from './pages/NewCase';
import { Settings } from './pages/Settings';
import { Ideas } from './pages/Ideas';
import { KnowledgeBase } from './pages/KnowledgeBase';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { UserManagement } from './pages/admin/UserManagement';
import { BrandingSettings } from './pages/admin/BrandingSettings';
import { PortalSettings } from './pages/admin/PortalSettings';
import { FAQGenerator } from './pages/admin/FAQGenerator';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="fl-loading">Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = useAuth();
  if (loading) return <div className="fl-loading">Loading...</div>;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export function App() {
  // Apply extracted website theme as CSS variable overrides
  useTheme();

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Protected routes */}
      <Route path="/" element={
        <ProtectedRoute>
          <PortalLayout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="cases" element={<CaseList />} />
        <Route path="cases/:caseId" element={<CaseDetail />} />
        <Route path="cases/new" element={<NewCase />} />
        <Route path="settings" element={<Settings />} />
        <Route path="ideas" element={<Ideas />} />
        <Route path="kb" element={<KnowledgeBase />} />

        {/* Admin routes */}
        <Route path="admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        <Route path="admin/users" element={<AdminRoute><UserManagement /></AdminRoute>} />
        <Route path="admin/branding" element={<AdminRoute><BrandingSettings /></AdminRoute>} />
        <Route path="admin/settings" element={<AdminRoute><PortalSettings /></AdminRoute>} />
        <Route path="admin/faqs" element={<AdminRoute><FAQGenerator /></AdminRoute>} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
