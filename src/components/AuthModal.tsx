import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { Eye, EyeOff, Truck, Users, Leaf, Building2, Wrench, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'login' | 'signup';
  /**
   * Modo de renderização.
   * - 'dialog' (default): usa Radix Dialog/Portal
   * - 'inline': renderiza direto no DOM (sem Portal) — mais resiliente em produção
   */
  renderMode?: 'dialog' | 'inline';
}

type UserRole = 'PRODUTOR' | 'MOTORISTA' | 'TRANSPORTADORA' | 'PRESTADOR_SERVICOS';

const userRoles: { value: UserRole; label: string; icon: React.ReactNode; description: string }[] = [
  { 
    value: 'PRODUTOR', 
    label: 'Produtor/Contratante', 
    icon: <Users className="h-6 w-6" />,
    description: 'Contrate fretes para suas cargas'
  },
  { 
    value: 'MOTORISTA', 
    label: 'Motorista', 
    icon: <Truck className="h-6 w-6" />,
    description: 'Encontre e aceite fretes'
  },
  { 
    value: 'TRANSPORTADORA', 
    label: 'Transportadora', 
    icon: <Building2 className="h-6 w-6" />,
    description: 'Gerencie sua frota e motoristas'
  },
  { 
    value: 'PRESTADOR_SERVICOS', 
    label: 'Prestador de Serviços', 
    icon: <Wrench className="h-6 w-6" />,
    description: 'Ofereça serviços auxiliares'
  },
];

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, initialTab = 'login', renderMode = 'dialog' }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState(initialTab);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  
  const [loginForm, setLoginForm] = useState({
    email: '',
    password: ''
  });

  useEffect(() => {
    setActiveTab(initialTab);
    setSelectedRole(null);
  }, [initialTab, isOpen]);

  // Inline mode: prevent body scroll when open (Radix would do this automatically)
  useEffect(() => {
    if (renderMode !== 'inline') return;
    if (!isOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, renderMode]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!loginForm.email || !loginForm.password) {
      toast({
        title: "Erro no login",
        description: "Preencha todos os campos.",
        variant: "destructive"
      });
      return;
    }
    
    // Redirecionar para a página de auth com parâmetros - usando mode em vez de tab
    onClose();
    navigate('/auth?mode=login');
  };

  const handleSignupRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
  };

  const handleProceedToSignup = () => {
    if (!selectedRole) {
      toast({
        title: "Selecione o tipo de conta",
        description: "Por favor, escolha o tipo de conta que deseja criar.",
        variant: "destructive"
      });
      return;
    }
    
    // Store role in sessionStorage for persistence across page loads
    sessionStorage.setItem('pending_signup_role', selectedRole);
    
    onClose();
    // ✅ CRITICAL: Use mode=signup instead of tab=signup
    navigate(`/auth?mode=signup&role=${selectedRole}`);
  };

  const modalInner = (
    <>
      <DialogHeader>
        <div className="flex items-center justify-center space-x-2 mb-2">
          <Leaf className="h-8 w-8 text-primary" />
          <DialogTitle className="text-2xl font-bold">AgriRoute</DialogTitle>
        </div>
        <DialogDescription className="text-center">Plataforma de fretes agrícolas</DialogDescription>
      </DialogHeader>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as 'login' | 'signup')}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login">Entrar</TabsTrigger>
          <TabsTrigger value="signup">Cadastrar</TabsTrigger>
        </TabsList>

        <TabsContent value="login" className="space-y-4">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={loginForm.email}
                onChange={(e) => setLoginForm((prev) => ({ ...prev, email: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm((prev) => ({ ...prev, password: e.target.value }))}
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <Button type="submit" className="w-full gradient-primary text-primary-foreground">
              Entrar
            </Button>
          </form>

          <div className="text-center">
            <Button
              variant="link"
              className="text-sm text-muted-foreground"
              onClick={() => navigate('/auth?mode=login')}
            >
              Esqueceu sua senha?
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="signup" className="space-y-4">
          <div className="space-y-3">
            <Label className="text-base font-semibold">Escolha o tipo de conta</Label>
            <p className="text-sm text-muted-foreground">Selecione o perfil que melhor se encaixa com você</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {userRoles.map((role) => (
                <Card
                  key={role.value}
                  className={`cursor-pointer transition-all duration-200 ${
                    selectedRole === role.value
                      ? 'ring-2 ring-primary bg-primary/5 shadow-md'
                      : 'hover:bg-muted/50 hover:shadow-sm'
                  }`}
                  onClick={() => handleSignupRoleSelect(role.value)}
                >
                  <CardContent className="flex flex-col items-center justify-center p-4 text-center">
                    <div
                      className={`mb-2 ${selectedRole === role.value ? 'text-primary' : 'text-muted-foreground'}`}
                    >
                      {role.icon}
                    </div>
                    <span className="text-sm font-medium">{role.label}</span>
                    <span className="text-xs text-muted-foreground mt-1">{role.description}</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <Separator />

          <Button
            onClick={handleProceedToSignup}
            disabled={!selectedRole}
            className="w-full gradient-primary text-primary-foreground"
          >
            Continuar Cadastro
          </Button>

          <div className="text-xs text-muted-foreground text-center">
            Ao criar uma conta, você aceita nossos{' '}
            <Button variant="link" className="p-0 h-auto text-xs">
              Termos de Uso
            </Button>{' '}
            e{' '}
            <Button variant="link" className="p-0 h-auto text-xs">
              Política de Privacidade
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );

  if (renderMode === 'inline') {
    if (!isOpen) return null;

    return (
      <div
        data-inline-fallback-modal
        className="fixed inset-0 flex items-center justify-center p-4 bg-black/80"
        style={{ zIndex: 99999 }}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto border bg-background p-6 shadow-lg duration-200 animate-in fade-in-0 zoom-in-95 sm:rounded-lg"
          data-auth-modal-content
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Close (same visual style as DialogContent close button) */}
          <button
            type="button"
            onClick={onClose}
            className="absolute right-2 top-2 rounded-lg opacity-90 ring-offset-background transition-all hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none bg-background border-2 border-red-500 hover:border-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 flex items-center justify-center w-10 h-10 shadow-lg hover:scale-110"
            aria-label="Fechar"
          >
            <X className="h-7 w-7 text-red-500 hover:text-red-600 font-bold stroke-[2.5]" />
          </button>

          {modalInner}
        </div>
      </div>
    );
  }

  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={(open) => {
        // ✅ P0 FIX: só fecha quando open virar false, não fecha imediatamente ao abrir
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" data-auth-modal-content>
        {modalInner}
      </DialogContent>
    </Dialog>
  );
};

export default AuthModal;