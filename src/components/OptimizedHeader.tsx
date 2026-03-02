import React, { useState, useCallback, memo } from 'react';
import { useHasMultipleProfiles } from '@/hooks/useHasMultipleProfiles';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Bell, Settings, LogOut, User, Menu, Leaf, ArrowLeftRight, CreditCard, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FEATURE_FORUM } from '@/modules/forum/config';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { NotificationCenter } from '@/components/NotificationCenter';
import { UserProfileModal } from '@/components/UserProfileModal';
import { SettingsModal } from '@/components/SettingsModal';
import { AccountSwitcher } from '@/components/AccountSwitcher';
import { AddProfileModal } from '@/components/AddProfileModal';
import SubscriptionPlans from '@/components/SubscriptionPlans';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface User {
  name: string;
  role: 'PRODUTOR' | 'MOTORISTA' | 'MOTORISTA_AFILIADO' | 'TRANSPORTADORA' | 'PRESTADOR_SERVICOS';
  avatar?: string;
}

interface OptimizedHeaderProps {
  user: User;
  onLogout: () => void;
  onMenuClick?: () => void;
  notifications?: number;
  userProfile?: any;
}

const OptimizedHeader = memo<OptimizedHeaderProps>(({ 
  user, 
  onLogout, 
  onMenuClick,
  notifications = 0,
  userProfile
}) => {
  const { hasMultiple: hasMultipleProfiles } = useHasMultipleProfiles();
  const navigateTo = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);
  const [showAddProfile, setShowAddProfile] = useState(false);
  const [showPlanos, setShowPlanos] = useState(false);

  const getUserInitials = useCallback((name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  }, []);

  const getRoleBadge = useCallback((role: string) => {
    if (role === 'PRODUTOR') return 'Produtor';
    if (role === 'PRESTADOR_SERVICOS') return 'Prestador de Serviço';
    if (role === 'MOTORISTA_AFILIADO') return 'Motorista Afiliado';
    if (role === 'MOTORISTA') return 'Motorista';
    if (role === 'TRANSPORTADORA') return 'Transportadora';
    return 'Usuário';
  }, []);

  // Problema 3: Cores de alto contraste para badges (WCAG AAA - 7:1)
  const getRoleColor = useCallback((role: string) => {
    if (role === 'PRODUTOR') return 'bg-emerald-100 text-emerald-800 border border-emerald-300 font-semibold';
    if (role === 'PRESTADOR_SERVICOS') return 'bg-blue-100 text-blue-800 border border-blue-300 font-semibold';
    if (role === 'MOTORISTA_AFILIADO') return 'bg-purple-100 text-purple-800 border border-purple-300 font-semibold';
    if (role === 'MOTORISTA') return 'bg-orange-100 text-orange-800 border border-orange-300 font-semibold';
    if (role === 'TRANSPORTADORA') return 'bg-amber-100 text-amber-800 border border-amber-300 font-semibold';
    return 'bg-gray-100 text-gray-800 border border-gray-300 font-semibold';
  }, []);

  // Memoized menu items to prevent recreation on every render
  const menuItems = React.useMemo(() => [
    { icon: User, label: 'Perfil', action: () => setShowProfile(true) },
    ...(hasMultipleProfiles && user.role !== 'TRANSPORTADORA' ? [{ icon: ArrowLeftRight, label: 'Alternar Conta', action: () => setShowAccountSwitcher(true) }] : []),
    ...(user.role !== 'PRODUTOR' ? [{ icon: CreditCard, label: 'Planos', action: () => setShowPlanos(true) }] : []),
    { icon: Settings, label: 'Configurações', action: () => setShowSettings(true) },
    ...(FEATURE_FORUM ? [{ icon: MessageSquare, label: 'Fórum', action: () => navigateTo('/forum') }] : []),
  ], [user.role, navigateTo]);

  // Memoized handlers
  const handleNotificationClick = useCallback(() => {
    setShowNotifications(true);
  }, []);

  const handleCloseProfile = useCallback(() => {
    setShowProfile(false);
  }, []);

  const handleCloseNotifications = useCallback(() => {
    setShowNotifications(false);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setShowSettings(false);
  }, []);

  const handleCloseAccountSwitcher = useCallback(() => {
    setShowAccountSwitcher(false);
  }, []);

  const handleCloseAddProfile = useCallback(() => {
    setShowAddProfile(false);
  }, []);

  const handleProfileAdded = useCallback(() => {
    setShowAddProfile(false);
    setShowAccountSwitcher(false);
  }, []);

  const handleCreateProfile = useCallback(() => {
    setShowAddProfile(true);
  }, []);

  return (
    <>
      <header className="bg-card border-b shadow-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo - Optimized for accessibility */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <Leaf className="h-10 w-10 text-primary" aria-hidden="true" />
                <span className="text-2xl lg:text-3xl font-bold text-foreground">AgriRoute</span>
              </div>
              <div className="hidden sm:block">
                <Badge className={`${getRoleColor(user.role)} text-base px-3 py-1`}>
                  {getRoleBadge(user.role)}
                </Badge>
              </div>
            </div>

            {/* Desktop Navigation - Larger touch targets */}
            <div className="hidden md:flex items-center space-x-6">
              {/* Notifications */}
              <Button 
                variant="ghost" 
                size="lg" 
                className="relative btn-accessible"
                onClick={handleNotificationClick}
                aria-label={`Notificações${notifications > 0 ? ` (${notifications} não lidas)` : ''}`}
              >
                <Bell className="h-6 w-6" />
                {notifications > 0 && (
                  <Badge className="absolute -top-2 -right-2 h-6 w-6 flex items-center justify-center p-0 bg-destructive text-destructive-foreground text-sm font-bold">
                    {notifications > 9 ? '9+' : notifications}
                  </Badge>
                )}
              </Button>

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    className="relative h-12 w-12 rounded-full btn-accessible"
                    aria-label="Menu do usuário"
                  >
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="gradient-primary text-primary-foreground text-lg font-bold">
                        {getUserInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64" align="end">
                  <div className="flex items-center justify-start gap-2 p-3">
                    <div className="flex flex-col space-y-1 leading-none">
                      <p className="font-semibold text-base">{user.name}</p>
                      <p className="w-[200px] truncate text-sm text-muted-foreground">
                        {getRoleBadge(user.role)}
                      </p>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  {menuItems.map((item) => (
                    <DropdownMenuItem 
                      key={item.label}
                      onClick={item.action}
                      className="py-3 text-base cursor-pointer"
                    >
                      <item.icon className="mr-3 h-5 w-5" />
                      {item.label}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={onLogout} 
                    className="text-destructive py-3 text-base cursor-pointer"
                  >
                    <LogOut className="mr-3 h-5 w-5" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Mobile Menu - Larger touch target */}
            <div className="md:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="lg" 
                    className="btn-accessible"
                    aria-label="Abrir menu"
                  >
                    <Menu className="h-7 w-7" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[350px]">
                  <div className="flex flex-col space-y-8 py-6">
                    {/* User Info - Enhanced for accessibility */}
                    <div className="flex items-center space-x-4">
                      <Avatar className="h-16 w-16">
                        <AvatarFallback className="gradient-primary text-primary-foreground text-xl font-bold">
                          {getUserInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold text-lg">{user.name}</p>
                        <Badge className={`${getRoleColor(user.role)} text-base px-3 py-1 mt-2`}>
                          {getRoleBadge(user.role)}
                        </Badge>
                      </div>
                    </div>

                    {/* Notifications */}
                    <Button 
                      variant="ghost" 
                      className="justify-start btn-accessible text-base"
                      onClick={handleNotificationClick}
                      aria-label={`Notificações${notifications > 0 ? ` (${notifications} não lidas)` : ''}`}
                    >
                      <Bell className="mr-4 h-6 w-6" />
                      Notificações
                      {notifications > 0 && (
                        <Badge className="ml-auto bg-destructive text-destructive-foreground text-sm">
                          {notifications}
                        </Badge>
                      )}
                    </Button>

                    {/* Menu Items */}
                    <div className="spacing-accessible">
                      {menuItems.map((item) => (
                        <Button
                          key={item.label}
                          variant="ghost"
                          className="justify-start btn-accessible text-base w-full"
                          onClick={item.action}
                        >
                          <item.icon className="mr-4 h-6 w-6" />
                          {item.label}
                        </Button>
                      ))}
                    </div>

                    {/* Logout */}
                    <Button
                      variant="ghost"
                      className="justify-start text-destructive hover:text-destructive btn-accessible text-base"
                      onClick={onLogout}
                    >
                      <LogOut className="mr-4 h-6 w-6" />
                      Sair
                    </Button>
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
          onClose={handleCloseProfile}
          user={userProfile}
        />
      )}
      
      <NotificationCenter
        isOpen={showNotifications}
        onClose={handleCloseNotifications}
      />

      <SettingsModal
        isOpen={showSettings}
        onClose={handleCloseSettings}
      />

      <AccountSwitcher
        isOpen={showAccountSwitcher}
        onClose={handleCloseAccountSwitcher}
        onCreateProfile={handleCreateProfile}
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
          onClose={handleCloseAddProfile}
          currentRole={userProfile.active_mode || userProfile.role}
          onProfileAdded={handleProfileAdded}
        />
      )}

      <Dialog open={showPlanos} onOpenChange={setShowPlanos}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl">
              <CreditCard className="h-6 w-6" />
              Planos de Assinatura
            </DialogTitle>
          </DialogHeader>
          <SubscriptionPlans />
        </DialogContent>
      </Dialog>
    </>
  );
});

OptimizedHeader.displayName = 'OptimizedHeader';

export default OptimizedHeader;