import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Menu, User, LogOut, Truck, Package } from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import agriRouteLogo from "@/assets/agriroute-logo.png";

interface HeaderProps {
  user: {
    name: string;
    role: 'PRODUTOR' | 'MOTORISTA';
  };
  onMenuClick: () => void;
  onLogout: () => void;
}

export const Header = ({ user, onMenuClick, onLogout }: HeaderProps) => {
  const [notifications] = useState(3); // Mock notification count

  const getRoleIcon = () => {
    return user.role === 'PRODUTOR' ? 
      <Package className="h-4 w-4" /> : 
      <Truck className="h-4 w-4" />;
  };

  const getRoleLabel = () => {
    return user.role === 'PRODUTOR' ? 'Produtor' : 'Motorista';
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={onMenuClick}
          >
            <Menu className="h-5 w-5" />
          </Button>
          
          <div className="flex items-center gap-3">
            <img 
              src={agriRouteLogo} 
              alt="AgriRoute" 
              className="h-8 w-8"
            />
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold gradient-primary bg-clip-text text-transparent">
                AgriRoute
              </h1>
              <p className="text-xs text-muted-foreground">
                Logística Agrícola
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {notifications > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center text-xs p-0"
              >
                {notifications}
              </Badge>
            )}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  {getRoleIcon()}
                  <div className="hidden sm:flex flex-col items-start">
                    <span className="text-sm font-medium">{user.name}</span>
                    <span className="text-xs text-muted-foreground">{getRoleLabel()}</span>
                  </div>
                </div>
                <User className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                Perfil
              </DropdownMenuItem>
              {user.role === 'MOTORISTA' && (
                <DropdownMenuItem>
                  <Truck className="mr-2 h-4 w-4" />
                  Meus Veículos
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onLogout} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};