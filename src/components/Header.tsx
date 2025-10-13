import React, { useState } from 'react';
import { Link } from 'react-router-dom';
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
import { Bell, Settings, LogOut, User, Menu, Leaf, ArrowLeftRight, CreditCard, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { NotificationCenter } from '@/components/NotificationCenter';
import { UserProfileModal } from '@/components/UserProfileModal';
import { SettingsModal } from '@/components/SettingsModal';
import { AccountSwitcher } from '@/components/AccountSwitcher';
import { AddProfileModal } from '@/components/AddProfileModal';
import SubscriptionPlans from '@/components/SubscriptionPlans';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CompanyModeToggle } from '@/components/CompanyModeToggle';

interface User {
  name: string;
  role: 'PRODUTOR' | 'MOTORISTA' | 'PRESTADOR';
  avatar?: string;
}

interface HeaderProps {
  user: User;
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

  const getUserInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const getRoleBadge = (role: string, activeMode?: string) => {
    if (activeMode === 'TRANSPORTADORA') return 'Transportadora';
    if (role === 'PRODUTOR') return 'Produtor';
    if (role === 'PRESTADOR') return 'Prestador de Serviço';
    return 'Motorista';
  };

  const getRoleColor = (role: string) => {
    if (role === 'PRODUTOR') return 'bg-primary/10 text-primary';
    if (role === 'PRESTADOR') return 'bg-blue-600 text-white font-medium';
    return 'bg-accent/10 text-accent';
  };

  const [showProfile, setShowProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);
  const [showAddProfile, setShowAddProfile] = useState(false);
  const [showPlanos, setShowPlanos] = useState(false);

  const [isTransportCompany, setIsTransportCompany] = React.useState(false);

  // Verificar se é transportadora
  React.useEffect(() => {
    const checkCompany = async () => {
      if (user.role === 'MOTORISTA' && userProfile) {
        const { data } = await supabase
          .from('transport_companies')
          .select('id')
          .eq('profile_id', userProfile.id)
          .maybeSingle();
        
        setIsTransportCompany(!!data || userProfile.active_mode === 'TRANSPORTADORA');
      }
    };
    
    checkCompany();
  }, [user.role, userProfile]);

  const menuItems = [
    { icon: User, label: 'Perfil', action: () => setShowProfile(true) },
    { icon: ArrowLeftRight, label: 'Alternar Conta', action: () => setShowAccountSwitcher(true) },
    ...(user.role !== 'PRODUTOR' ? [{ icon: CreditCard, label: 'Planos', action: () => setShowPlanos(true) }] : []),
    { icon: Settings, label: 'Configurações', action: () => setShowSettings(true) },
  ];

  return (
    <>
      <header className="bg-card border-b shadow-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <Leaf className="h-8 w-8 text-primary" />
                <span className="text-2xl font-bold text-foreground">AgriRoute</span>
              </div>
              <div className="hidden sm:block">
                <Badge className={getRoleColor(user.role)}>
                  {getRoleBadge(user.role, userProfile?.active_mode)}
                </Badge>
              </div>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-4">
              {/* Notifications */}
              <Button 
                variant="ghost" 
                size="sm" 
                className="relative"
                onClick={() => setShowNotifications(true)}
              >
                <Bell className="h-5 w-5" />
                {notifications > 0 && (
                  <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 bg-destructive text-destructive-foreground text-xs">
                    {notifications > 9 ? '9+' : notifications}
                  </Badge>
                )}
              </Button>

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="gradient-primary text-primary-foreground">
                        {getUserInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end">
                  <div className="flex items-center justify-start gap-2 p-2">
                    <div className="flex flex-col space-y-1 leading-none">
                      <p className="font-medium text-sm">{user.name}</p>
                      <p className="w-[200px] truncate text-xs text-muted-foreground">
                        {getRoleBadge(user.role, userProfile?.active_mode)}
                      </p>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  {isTransportCompany && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link to="/dashboard/company" className="flex items-center cursor-pointer">
                          <Building2 className="mr-2 h-4 w-4" />
                          Painel da Transportadora
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  {menuItems.map((item) => (
                    <DropdownMenuItem key={item.label} onClick={item.action}>
                      <item.icon className="mr-2 h-4 w-4" />
                      {item.label}
                    </DropdownMenuItem>
                  ))}
                  {user.role === 'MOTORISTA' && (
                    <>
                      <DropdownMenuSeparator />
                      <div className="px-2 py-1.5">
                        <CompanyModeToggle currentMode={userProfile?.active_mode} />
                      </div>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onLogout} className="text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Mobile Menu */}
            <div className="md:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Menu className="h-6 w-6" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[300px]">
                  <div className="flex flex-col space-y-6 py-6">
                    {/* User Info */}
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="gradient-primary text-primary-foreground">
                          {getUserInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{user.name}</p>
                        <Badge className={getRoleColor(user.role)}>
                          {getRoleBadge(user.role, userProfile?.active_mode)}
                        </Badge>
                      </div>
                    </div>

                    {/* Notifications */}
                    <Button 
                      variant="ghost" 
                      className="justify-start" 
                      size="sm"
                      onClick={() => setShowNotifications(true)}
                    >
                      <Bell className="mr-3 h-5 w-5" />
                      Notificações
                      {notifications > 0 && (
                        <Badge className="ml-auto bg-destructive text-destructive-foreground">
                          {notifications}
                        </Badge>
                      )}
                    </Button>

                    {/* Menu Items */}
                    {menuItems.map((item) => (
                      <Button
                        key={item.label}
                        variant="ghost"
                        className="justify-start"
                        size="sm"
                        onClick={item.action}
                      >
                        <item.icon className="mr-3 h-5 w-5" />
                        {item.label}
                      </Button>
                    ))}

                    {/* Logout */}
                    <Button
                      variant="ghost"
                      className="justify-start text-destructive hover:text-destructive"
                      size="sm"
                      onClick={onLogout}
                    >
                      <LogOut className="mr-3 h-5 w-5" />
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
          role: userProfile.role,
          full_name: userProfile.full_name,
          status: userProfile.status,
          profile_photo_url: userProfile.profile_photo_url
        } : null}
      />

      {userProfile && (
        <AddProfileModal
          isOpen={showAddProfile}
          onClose={() => setShowAddProfile(false)}
          currentRole={userProfile.role}
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
    </>
  );
};

export default Header;