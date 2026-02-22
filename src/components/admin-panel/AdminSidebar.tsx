import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarTrigger,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard, Users, FileText, Shield, Settings, LogOut, Menu,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface AdminSidebarProps {
  isSuperAdmin: boolean;
  adminName: string;
}

const menuItems = [
  { title: 'Dashboard', icon: LayoutDashboard, path: '/admin-v2' },
  { title: 'Cadastros', icon: Users, path: '/admin-v2/cadastros' },
  { title: 'Auditoria', icon: FileText, path: '/admin-v2/auditoria' },
];

const superAdminItems = [
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
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-emerald-400" />
            <div>
              <h1 className="text-sm font-bold text-white">AgriRoute Admin</h1>
              <p className="text-xs text-slate-400 truncate">{adminName}</p>
            </div>
          </div>
        </div>

        {/* Menu */}
        <SidebarGroup className="flex-1">
          <SidebarGroupLabel className="text-slate-500 text-xs uppercase px-4 pt-4">
            Gestão
          </SidebarGroupLabel>
          <SidebarMenu>
            {menuItems.map((item) => (
              <SidebarMenuItem key={item.path}>
                <SidebarMenuButton
                  className={`text-slate-300 hover:text-white hover:bg-slate-800 transition-colors mx-2 rounded-md ${
                    isActive(item.path) ? 'bg-slate-800 text-white' : ''
                  }`}
                  onClick={() => navigate(item.path)}
                >
                  <item.icon className="h-4 w-4 mr-3" />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>

          {isSuperAdmin && (
            <>
              <SidebarGroupLabel className="text-slate-500 text-xs uppercase px-4 pt-6">
                Superadmin
              </SidebarGroupLabel>
              <SidebarMenu>
                {superAdminItems.map((item) => (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      className={`text-slate-300 hover:text-white hover:bg-slate-800 transition-colors mx-2 rounded-md ${
                        isActive(item.path) ? 'bg-slate-800 text-white' : ''
                      }`}
                      onClick={() => navigate(item.path)}
                    >
                      <item.icon className="h-4 w-4 mr-3" />
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
            className="flex items-center gap-2 text-slate-400 hover:text-white text-sm w-full transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
