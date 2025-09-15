import React, { useState } from 'react';
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
import { Bell, Settings, LogOut, User, Menu, Leaf, Star, ArrowLeftRight } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { NotificationCenter } from '@/components/NotificationCenter';
import { UserProfileModal } from '@/components/UserProfileModal';
import { SettingsModal } from '@/components/SettingsModal';
import { AccountSwitcher } from '@/components/AccountSwitcher';
import { AddProfileModal } from '@/components/AddProfileModal';

interface User {
  name: string;
  role: 'PRODUTOR' | 'MOTORISTA';
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

  const getRoleBadge = (role: string) => {
    return role === 'PRODUTOR' ? 'Produtor' : 'Motorista';
  };

  const getRoleColor = (role: string) => {
    return role === 'PRODUTOR' ? 'bg-primary/10 text-primary' : 'bg-accent/10 text-accent';
  };

  const [showProfile, setShowProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);
  const [showAddProfile, setShowAddProfile] = useState(false);

  const menuItems = [
    { icon: User, label: 'Perfil', action: () => setShowProfile(true) },
    { icon: ArrowLeftRight, label: 'Alternar Conta', action: () => setShowAccountSwitcher(true) },
    { icon: Settings, label: 'Configurações', action: () => setShowSettings(true) },
    { 
      icon: Star, 
      label: 'Planos & Assinatura', 
      action: () => window.location.href = '/plans' 
    },
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
                  {getRoleBadge(user.role)}
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
                        {getRoleBadge(user.role)}
                      </p>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  {menuItems.map((item, index) => (
                    <DropdownMenuItem key={index} onClick={item.action}>
                      <item.icon className="mr-2 h-4 w-4" />
                      {item.label}
                    </DropdownMenuItem>
                  ))}
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
                          {getRoleBadge(user.role)}
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
                    {menuItems.map((item, index) => (
                      <Button
                        key={index}
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
            // Recarregar dados do usuário
            window.location.reload();
          }}
        />
      )}
    </>
  );
};

export default Header;