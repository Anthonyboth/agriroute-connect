/**
 * AdminPanelV2 — Painel Administrativo com allowlist (admin_users).
 * Acessível somente por admins cadastrados diretamente no banco.
 * Rota: /admin/*
 */
import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { AppSpinner } from '@/components/ui/AppSpinner';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { Shield, AlertCircle, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { AdminSidebar } from '@/components/admin-panel/AdminSidebar';
import { SidebarProvider } from '@/components/ui/sidebar';

// Lazy load admin sub-pages
const AdminDashboard = lazy(() => import('@/components/admin-panel/AdminDashboard'));
const AdminRegistrations = lazy(() => import('@/components/admin-panel/AdminRegistrations'));
const AdminRegistrationDetail = lazy(() => import('@/components/admin-panel/AdminRegistrationDetail'));
const AdminAuditLogs = lazy(() => import('@/components/admin-panel/AdminAuditLogs'));
const AdminUsersManager = lazy(() => import('@/components/admin-panel/AdminUsersManager'));
const AdminSettingsPage = lazy(() => import('@/components/admin-panel/AdminSettingsPage'));

const AdminPanelV2 = () => {
  const { adminUser, isAdmin, isSuperAdmin, loading, error } = useAdminAuth();
  const { signOut } = useAuth();
  const navigate = useNavigate();

  // Meta noindex for security
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => { document.head.removeChild(meta); };
  }, []);

  if (loading) {
    return <AppSpinner fullscreen />;
  }

  if (error || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="text-center space-y-6 max-w-md">
          <Shield className="h-16 w-16 text-destructive mx-auto" />
          <h2 className="text-2xl font-bold">Acesso Negado</h2>
          <p className="text-muted-foreground">
            Este painel é restrito a administradores autorizados.
          </p>
          {error && (
            <div className="bg-destructive/10 p-3 rounded-lg">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
          <div className="flex gap-3 justify-center">
            <Button onClick={() => navigate('/')} variant="outline">
              Voltar à Página Inicial
            </Button>
            <Button onClick={() => signOut()} variant="ghost">
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gray-50">
        <AdminSidebar isSuperAdmin={isSuperAdmin} adminName={adminUser?.full_name || adminUser?.email || 'Admin'} />
        <div className="flex-1 flex flex-col min-w-0">
          <Suspense fallback={<div className="flex-1 flex items-center justify-center"><AppSpinner /></div>}>
            <Routes>
              <Route index element={<AdminDashboard />} />
              <Route path="cadastros" element={<AdminRegistrations />} />
              <Route path="cadastros/:id" element={<AdminRegistrationDetail />} />
              <Route path="auditoria" element={<AdminAuditLogs />} />
              {isSuperAdmin && (
                <>
                  <Route path="admins" element={<AdminUsersManager />} />
                  <Route path="configuracoes" element={<AdminSettingsPage />} />
                </>
              )}
              <Route path="*" element={<Navigate to="/admin-v2" replace />} />
            </Routes>
          </Suspense>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AdminPanelV2;
