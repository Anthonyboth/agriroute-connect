import React, { useState, useCallback } from 'react';
import { useHasMultipleProfiles } from '@/hooks/useHasMultipleProfiles';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Bell, Settings, LogOut, User, Menu, Leaf, ArrowLeftRight, CreditCard, Building2, Truck, FileText, ChevronDown, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { NotificationCenter, UserProfileModal } from '@/components/LazyComponents';
import { SettingsModal } from '@/components/SettingsModal';
import { AccountSwitcher } from '@/components/AccountSwitcher';
import { AddProfileModal } from '@/components/AddProfileModal';
import SubscriptionPlans from '@/components/SubscriptionPlans';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CompanyModeToggle } from '@/components/CompanyModeToggle';
import { NotificationPreferencesModal } from '@/components/NotificationPreferencesModal';
import { useCompanyDriver } from '@/hooks/useCompanyDriver';
import { AffiliationDetailsModal } from '@/components/AffiliationDetailsModal';
import { playSoundNotification } from '@/utils/playSound';
import { TutorialReplayButton } from '@/tutorial';

interface User {
  name: string;
  role: 'PRODUTOR' | 'MOTORISTA' | 'MOTORISTA_AFILIADO' | 'TRANSPORTADORA' | 'PRESTADOR_SERVICOS';
  avatar?: string;
}

interface HeaderProps {
  user?: User;
  onLogout: () => void;
  onMenuClick?: () => void;
  notifications?: number;
  userProfile?: any;
}

const Header: React.FC<HeaderProps> = ({ 
  user, 
  onLogout, 
  onMenuClick,
  notifications = 0,
  userProfile
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  // ✅ Wrapper para logout com guard de UI
  const handleLogoutClick = useCallback(async () => {
    if (isLoggingOut) return; // Evita clique duplo
    setIsLoggingOut(true);
    try {
      await onLogout();
    } finally {
      // Não resetar - redirect vai acontecer
    }
  }, [onLogout, isLoggingOut]);

  const getUserInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.split(' ').filter(Boolean);
    if (parts.length === 0) return 'U';
    if (parts.length === 1) return parts[0][0]?.toUpperCase() || 'U';
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const getRoleBadge = (role?: string, activeMode?: string) => {
    if (!role) return 'Usuário';
    if (activeMode === 'TRANSPORTADORA') return 'Transportadora';
    if (role === 'PRODUTOR') return 'Produtor';
    if (role === 'PRESTADOR_SERVICOS') return 'Prestador';
    if (role === 'MOTORISTA_AFILIADO') return 'Afiliado';
    if (role === 'MOTORISTA') return 'Motorista';
    if (role === 'TRANSPORTADORA') return 'Transportadora';
    return 'Usuário';
  };

  const getRoleColor = (role?: string) => {
    if (!role) return "bg-muted text-muted-foreground";
    if (role === 'PRODUTOR') return 'bg-primary/15 text-primary border border-primary/20';
    if (role === 'PRESTADOR_SERVICOS') return 'bg-blue-500/15 text-blue-600 border border-blue-500/20';
    if (role === 'MOTORISTA_AFILIADO') return 'bg-purple-500/15 text-purple-600 border border-purple-500/20';
    if (role === 'MOTORISTA') return 'bg-orange-500/20 text-orange-400 dark:text-orange-300 border border-orange-500/40';
    if (role === 'TRANSPORTADORA') return 'bg-orange-500/15 text-orange-600 border border-orange-500/20';
    return 'bg-muted text-muted-foreground';
  };

  const [showProfile, setShowProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);
  const [showAddProfile, setShowAddProfile] = useState(false);
  const [showPlanos, setShowPlanos] = useState(false);
  const [showNotificationPrefs, setShowNotificationPrefs] = useState(false);
  const [showAffiliation, setShowAffiliation] = useState(false);

  const [isTransportCompany, setIsTransportCompany] = React.useState(false);
  const { isCompanyDriver } = useCompanyDriver();
  const { hasMultiple: hasMultipleProfiles } = useHasMultipleProfiles();

  // Buscar solicitações de documentos pendentes para motoristas
  const { data: pendingDocRequests } = useQuery({
    queryKey: ['my-document-requests', userProfile?.id],
    queryFn: async () => {
      if (!userProfile?.id) return [];
      
      const { data, error } = await supabase
        .from('document_requests')
        .select('*')
        .eq('driver_profile_id', userProfile.id)
        .eq('status', 'PENDING');
        
      if (error) throw error;
      return data || [];
    },
    enabled: !!userProfile?.id && ['MOTORISTA', 'MOTORISTA_AFILIADO'].includes(user?.role || ''),
    staleTime: 5 * 60 * 1000, // 5 minutos
    refetchOnWindowFocus: false,
    // ❌ REMOVIDO: refetchInterval de 30s - convites pendentes não são urgentes
  });

  // Verificar se é transportadora
  React.useEffect(() => {
    const checkCompany = async () => {
      if (['MOTORISTA', 'MOTORISTA_AFILIADO'].includes(user?.role || '') && userProfile) {
        const { data } = await supabase
          .from('transport_companies')
          .select('id')
          .eq('profile_id', userProfile.id)
          .maybeSingle();
        
        setIsTransportCompany(!!data || userProfile.active_mode === 'TRANSPORTADORA');
      }
    };
    
    checkCompany();
  }, [user?.role, userProfile]);

  const menuItems = [
    { icon: User, label: 'Perfil', action: () => setShowProfile(true) },
    ...(hasMultipleProfiles && user?.role !== 'TRANSPORTADORA' ? [{ icon: ArrowLeftRight, label: 'Alternar Conta', action: () => setShowAccountSwitcher(true) }] : []),
    ...(user?.role !== 'PRODUTOR' ? [{ icon: CreditCard, label: 'Planos', action: () => setShowPlanos(true) }] : []),
    { icon: Bell, label: 'Notificações', action: () => setShowNotificationPrefs(true) },
    { icon: Settings, label: 'Configurações', action: () => setShowSettings(true) },
    ...(isCompanyDriver ? [{ icon: Truck, label: 'Minha Afiliação', action: () => setShowAffiliation(true) }] : []),
  ];

  return (
    <>
      <header className="bg-card/95 backdrop-blur-sm border-b border-border/50 shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-3 sm:px-4">
          <div className="flex items-center h-14 sm:h-16 w-full">
            {/* Logo + Badge - Left side */}
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="p-1.5 rounded-lg bg-primary/10">
                  <Leaf className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                </div>
                <span className="text-lg sm:text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                  AgriRoute
                </span>
              </div>
              
              <Badge className={`text-[10px] sm:text-xs px-2 py-0.5 ${getRoleColor(user?.role)}`}>
                {getRoleBadge(user?.role, userProfile?.active_mode)}
              </Badge>
            </div>
            
            {/* Spacer - pushes navigation to right */}
            <div className="flex-1" />

            {/* Tutorial Replay Button */}
            <TutorialReplayButton className="mr-2" />

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-2">
              {/* Notifications */}
              <Button 
                variant="ghost" 
                size="sm" 
                className="relative h-9 w-9 p-0"
                onClick={() => {
                  playSoundNotification();
                  setShowNotifications(true);
                }}
              >
                <Bell className="h-5 w-5 text-muted-foreground" />
                {notifications > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 flex items-center justify-center px-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full">
                    {notifications > 99 ? '99+' : notifications}
                  </span>
                )}
              </Button>

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-9 px-2 gap-2 hover:bg-muted/50">
                    <div className="relative">
                      <Avatar className="h-8 w-8 border-2 border-primary/20">
                        {userProfile?.profile_photo_url && (
                          <AvatarImage src={userProfile.profile_photo_url} alt={user?.name} />
                        )}
                        <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                          {getUserInitials(user?.name)}
                        </AvatarFallback>
                      </Avatar>
                      {pendingDocRequests && pendingDocRequests.length > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 h-3.5 min-w-3.5 flex items-center justify-center bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full">
                          {pendingDocRequests.length}
                        </span>
                      )}
                    </div>
                    <div className="hidden md:flex flex-col items-start">
                      <span className="text-sm font-medium text-foreground truncate max-w-[120px]">
                        {user?.name?.split(' ')[0] || 'Usuário'}
                      </span>
                    </div>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" sideOffset={8}>
                  <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-t-md">
                    <Avatar className="h-10 w-10 border-2 border-primary/20">
                      {userProfile?.profile_photo_url && (
                        <AvatarImage src={userProfile.profile_photo_url} alt={user?.name} />
                      )}
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {getUserInitials(user?.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0">
                      <p className="font-medium text-sm truncate">{user?.name ?? 'Usuário'}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {getRoleBadge(user?.role, userProfile?.active_mode)}
                      </p>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  {isTransportCompany && (
                    <>
                      <DropdownMenuItem asChild className="cursor-pointer">
                        <Link to="/dashboard/company" className="flex items-center">
                          <Building2 className="mr-2 h-4 w-4 text-orange-500" />
                          Painel da Transportadora
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  {menuItems.map((item) => (
                    <DropdownMenuItem 
                      key={item.label} 
                      onClick={item.action}
                      className="cursor-pointer"
                    >
                      <item.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                      {item.label}
                    </DropdownMenuItem>
                  ))}
                  {['MOTORISTA', 'MOTORISTA_AFILIADO'].includes(user?.role || '') && (
                    <>
                      <DropdownMenuSeparator />
                      <div className="px-2 py-1.5">
                        <CompanyModeToggle 
                          currentMode={userProfile?.active_mode}
                          currentProfile={userProfile}
                        />
                      </div>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={handleLogoutClick} 
                    disabled={isLoggingOut}
                    className="text-destructive focus:text-destructive cursor-pointer"
                  >
                    {isLoggingOut ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <LogOut className="mr-2 h-4 w-4" />
                    )}
                    {isLoggingOut ? 'Saindo...' : 'Sair'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Mobile Menu */}
            <div className="flex md:hidden items-center gap-1">
              {/* Mobile Notifications */}
              <Button 
                variant="ghost" 
                size="sm" 
                className="relative h-9 w-9 p-0"
                onClick={() => {
                  playSoundNotification();
                  setShowNotifications(true);
                }}
              >
                <Bell className="h-5 w-5 text-muted-foreground" />
                {notifications > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 flex items-center justify-center px-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full">
                    {notifications > 99 ? '99+' : notifications}
                  </span>
                )}
              </Button>

              <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[280px] p-0">
                  <div className="flex flex-col h-full">
                    {/* User Info Header */}
                    <div className="p-4 bg-muted/30 border-b">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12 border-2 border-primary/20">
                          {userProfile?.profile_photo_url && (
                            <AvatarImage src={userProfile.profile_photo_url} alt={user?.name} />
                          )}
                          <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                            {getUserInitials(user?.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground truncate">{user?.name ?? 'Usuário'}</p>
                          <Badge className={`text-[10px] mt-1 ${getRoleColor(user?.role)}`}>
                            {getRoleBadge(user?.role, userProfile?.active_mode)}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Menu Items */}
                    <div className="flex-1 overflow-y-auto p-2">
                      {/* Menu Items */}
                      {menuItems.map((item) => (
                        <Button
                          key={item.label}
                          variant="ghost"
                          className="w-full justify-start h-11 px-3 mb-1"
                          onClick={() => {
                            item.action();
                            setIsSheetOpen(false);
                          }}
                        >
                          <item.icon className="mr-3 h-5 w-5 text-muted-foreground" />
                          {item.label}
                        </Button>
                      ))}
                    </div>

                    {/* Logout */}
                    <div className="p-3 border-t">
                      <Button
                        variant="ghost"
                        disabled={isLoggingOut}
                        className="w-full justify-start h-11 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          handleLogoutClick();
                          setIsSheetOpen(false);
                        }}
                      >
                        {isLoggingOut ? (
                          <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                        ) : (
                          <LogOut className="mr-3 h-5 w-5" />
                        )}
                        {isLoggingOut ? 'Saindo...' : 'Sair da conta'}
                      </Button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      {/* Modals */}
      {userProfile && (
        <UserProfileModal
          isOpen={showProfile}
          onClose={() => setShowProfile(false)}
          user={userProfile}
        />
      )}
      
      <NotificationCenter
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
      />

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      <AccountSwitcher
        isOpen={showAccountSwitcher}
        onClose={() => setShowAccountSwitcher(false)}
        onCreateProfile={() => setShowAddProfile(true)}
        currentProfile={userProfile ? {
          id: userProfile.id,
          role: userProfile.active_mode || userProfile.role,
          full_name: userProfile.full_name,
          status: userProfile.status,
          profile_photo_url: userProfile.profile_photo_url
        } : null}
      />

      {userProfile && (
        <AddProfileModal
          isOpen={showAddProfile}
          onClose={() => setShowAddProfile(false)}
          currentRole={userProfile.active_mode || userProfile.role}
          onProfileAdded={() => {
            setShowAddProfile(false);
            setShowAccountSwitcher(false);
          }}
        />
      )}

      <Dialog open={showPlanos} onOpenChange={setShowPlanos}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Planos de Assinatura
            </DialogTitle>
          </DialogHeader>
          <SubscriptionPlans />
        </DialogContent>
      </Dialog>

      <NotificationPreferencesModal
        isOpen={showNotificationPrefs}
        onClose={() => setShowNotificationPrefs(false)}
      />

      <AffiliationDetailsModal
        isOpen={showAffiliation}
        onClose={() => setShowAffiliation(false)}
      />
    </>
  );
};

export default Header;
