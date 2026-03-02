import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard, Users, FileText, Shield, Settings, LogOut,
  Truck, ShieldAlert, BarChart3, Megaphone, DollarSign, Building2,
  Wrench, Bell, Car,
} from 'lucide-react';
import { ForumIcon } from '@/modules/forum/components/ForumIcon';
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
  { title: 'Serviços', icon: Wrench, path: '/admin-v2/servicos' },
  { title: 'Transportadoras', icon: Building2, path: '/admin-v2/transportadoras' },
  { title: 'Veículos', icon: Car, path: '/admin-v2/veiculos' },
  { title: 'Financeiro', icon: DollarSign, path: '/admin-v2/financeiro' },
  { title: 'Mural de Avisos', icon: Megaphone, path: '/admin-v2/avisos' },
  { title: 'Notificações', icon: Bell, path: '/admin-v2/notificacoes' },
  { title: 'Gestão de Risco', icon: ShieldAlert, path: '/admin-v2/riscos' },
  { title: 'Auditoria', icon: FileText, path: '/admin-v2/auditoria' },
  { title: 'Fórum', icon: ForumIcon, path: '/admin-v2/forum' },
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
    <Sidebar className="bg-[hsl(220,25%,10%)] text-white border-r-0">
      <SidebarContent className="bg-[hsl(220,25%,10%)] flex flex-col h-full">
        {/* Header */}
        <div className="px-4 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-lg">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">AgriRoute</h1>
              <p className="text-xs text-primary font-medium">Painel Administrativo</p>
            </div>
          </div>
          <div className="mt-3 px-2 py-1.5 bg-white/5 rounded-md">
            <p className="text-xs text-white/60 truncate">👤 {adminName}</p>
          </div>
        </div>

        {/* Menu */}
        <SidebarGroup className="flex-1 pt-2">
          <SidebarGroupLabel className="text-white/30 text-[10px] uppercase tracking-wider px-4 pt-3 pb-1">
            Gestão Principal
          </SidebarGroupLabel>
          <SidebarMenu>
            {menuItems.map((item) => (
              <SidebarMenuItem key={item.path}>
                <SidebarMenuButton
                  className={`text-white/60 hover:text-white hover:bg-white/10 transition-all mx-2 rounded-lg ${
                    isActive(item.path) ? 'bg-primary/15 text-primary hover:text-primary hover:bg-primary/20' : ''
                  }`}
                  onClick={() => navigate(item.path)}
                >
                  <item.icon className={`h-4 w-4 mr-3 ${isActive(item.path) ? 'text-primary' : ''}`} />
                  <span className="flex-1">{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>

          {isSuperAdmin && (
            <>
              <SidebarGroupLabel className="text-white/30 text-[10px] uppercase tracking-wider px-4 pt-5 pb-1">
                Superadmin
              </SidebarGroupLabel>
              <SidebarMenu>
                {superAdminItems.map((item) => (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      className={`text-white/60 hover:text-white hover:bg-white/10 transition-all mx-2 rounded-lg ${
                        isActive(item.path) ? 'bg-primary/15 text-primary hover:text-primary hover:bg-primary/20' : ''
                      }`}
                      onClick={() => navigate(item.path)}
                    >
                      <item.icon className={`h-4 w-4 mr-3 ${isActive(item.path) ? 'text-primary' : ''}`} />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </>
          )}
        </SidebarGroup>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-white/10">
          <button
            onClick={() => signOut()}
            className="flex items-center gap-2 text-white/40 hover:text-destructive text-sm w-full transition-colors py-1"
          >
            <LogOut className="h-4 w-4" />
            Sair do Painel
          </button>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
