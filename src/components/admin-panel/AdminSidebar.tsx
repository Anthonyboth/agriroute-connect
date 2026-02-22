import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard, Users, FileText, Shield, Settings, LogOut,
  Truck, ShieldAlert, BarChart3,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';

interface AdminSidebarProps {
  isSuperAdmin: boolean;
  adminName: string;
}

const menuItems = [
  { title: 'Dashboard', icon: LayoutDashboard, path: '/admin-v2' },
  { title: 'Cadastros', icon: Users, path: '/admin-v2/cadastros', badge: 'cadastros' },
  { title: 'Fretes', icon: Truck, path: '/admin-v2/fretes' },
  { title: 'Gestão de Risco', icon: ShieldAlert, path: '/admin-v2/riscos' },
  { title: 'Auditoria', icon: FileText, path: '/admin-v2/auditoria' },
];

const superAdminItems = [
  { title: 'Relatórios', icon: BarChart3, path: '/admin-v2/relatorios' },
  { title: 'Administradores', icon: Shield, path: '/admin-v2/admins' },
  { title: 'Configurações', icon: Settings, path: '/admin-v2/configuracoes' },
];

export function AdminSidebar({ isSuperAdmin, adminName }: AdminSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();

  const isActive = (path: string) => {
    if (path === '/admin-v2') return location.pathname === '/admin-v2' || location.pathname === '/admin-v2/';
    return location.pathname.startsWith(path);
  };

  return (
    <Sidebar className="bg-slate-900 text-white border-r-0">
      <SidebarContent className="bg-slate-900 flex flex-col h-full">
        {/* Header */}
        <div className="px-4 py-5 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <Shield className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">AgriRoute</h1>
              <p className="text-xs text-emerald-400 font-medium">Painel Administrativo</p>
            </div>
          </div>
          <div className="mt-3 px-2 py-1.5 bg-slate-800 rounded-md">
            <p className="text-xs text-slate-400 truncate">👤 {adminName}</p>
          </div>
        </div>

        {/* Menu */}
        <SidebarGroup className="flex-1 pt-2">
          <SidebarGroupLabel className="text-slate-500 text-[10px] uppercase tracking-wider px-4 pt-3 pb-1">
            Gestão Principal
          </SidebarGroupLabel>
          <SidebarMenu>
            {menuItems.map((item) => (
              <SidebarMenuItem key={item.path}>
                <SidebarMenuButton
                  className={`text-slate-300 hover:text-white hover:bg-slate-800 transition-all mx-2 rounded-lg ${
                    isActive(item.path) ? 'bg-emerald-600/20 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-600/25' : ''
                  }`}
                  onClick={() => navigate(item.path)}
                >
                  <item.icon className={`h-4 w-4 mr-3 ${isActive(item.path) ? 'text-emerald-400' : ''}`} />
                  <span className="flex-1">{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>

          {isSuperAdmin && (
            <>
              <SidebarGroupLabel className="text-slate-500 text-[10px] uppercase tracking-wider px-4 pt-5 pb-1">
                Superadmin
              </SidebarGroupLabel>
              <SidebarMenu>
                {superAdminItems.map((item) => (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      className={`text-slate-300 hover:text-white hover:bg-slate-800 transition-all mx-2 rounded-lg ${
                        isActive(item.path) ? 'bg-emerald-600/20 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-600/25' : ''
                      }`}
                      onClick={() => navigate(item.path)}
                    >
                      <item.icon className={`h-4 w-4 mr-3 ${isActive(item.path) ? 'text-emerald-400' : ''}`} />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </>
          )}
        </SidebarGroup>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-700">
          <button
            onClick={() => signOut()}
            className="flex items-center gap-2 text-slate-400 hover:text-red-400 text-sm w-full transition-colors py-1"
          >
            <LogOut className="h-4 w-4" />
            Sair do Painel
          </button>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
