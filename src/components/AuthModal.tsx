import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { Eye, EyeOff, Truck, Users, Leaf } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'login' | 'signup';
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, initialTab = 'login' }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState(initialTab);
  const [userType, setUserType] = useState<'PRODUTOR' | 'MOTORISTA'>('PRODUTOR');
  const [showPassword, setShowPassword] = useState(false);
  
  const [loginForm, setLoginForm] = useState({
    email: '',
    password: ''
  });
  
  const [signupForm, setSignupForm] = useState({
    name: '',
    email: '',
    phone: '',
    document: '', // CPF ou CNPJ
    password: ''
  });

  React.useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Mock authentication
    if (loginForm.email && loginForm.password) {
      toast({
        title: "Login realizado com sucesso!",
        description: "Redirecionando para o dashboard...",
      });
      
      // Simulate login with mock user type
      const mockUserType = loginForm.email.includes('producer') ? 'PRODUTOR' : 'MOTORISTA';
      const dashboardPath = mockUserType === 'PRODUTOR' ? '/dashboard/producer' : '/dashboard/driver';
      
      setTimeout(() => {
        navigate(dashboardPath);
        onClose();
      }, 1000);
    } else {
      toast({
        title: "Erro no login",
        description: "Preencha todos os campos.",
        variant: "destructive"
      });
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (signupForm.name && signupForm.email && signupForm.password) {
      toast({
        title: "Cadastro realizado com sucesso!",
        description: "Redirecionando para o dashboard...",
      });
      
      const dashboardPath = userType === 'PRODUTOR' ? '/dashboard/producer' : '/dashboard/driver';
      
      setTimeout(() => {
        navigate(dashboardPath);
        onClose();
      }, 1000);
    } else {
      toast({
        title: "Erro no cadastro",
        description: "Preencha todos os campos obrigatórios.",
        variant: "destructive"
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Leaf className="h-8 w-8 text-primary" />
            <DialogTitle className="text-2xl font-bold">AgriRoute</DialogTitle>
          </div>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'login' | 'signup')} className="w-full">
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
                  onChange={(e) => setLoginForm(prev => ({ ...prev, email: e.target.value }))}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
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
              <Button variant="link" className="text-sm text-muted-foreground">
                Esqueceu sua senha?
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="signup" className="space-y-4">
            {/* User Type Selection */}
            <div className="space-y-3">
              <Label>Tipo de usuário</Label>
              <div className="grid grid-cols-2 gap-3">
                <Card 
                  className={`cursor-pointer transition-smooth ${
                    userType === 'PRODUTOR' 
                      ? 'ring-2 ring-primary bg-primary/5' 
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => setUserType('PRODUTOR')}
                >
                  <CardContent className="flex flex-col items-center justify-center p-4">
                    <Users className="h-8 w-8 text-primary mb-2" />
                    <span className="text-sm font-medium">Produtor</span>
                  </CardContent>
                </Card>
                
                <Card 
                  className={`cursor-pointer transition-smooth ${
                    userType === 'MOTORISTA' 
                      ? 'ring-2 ring-accent bg-accent/5' 
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => setUserType('MOTORISTA')}
                >
                  <CardContent className="flex flex-col items-center justify-center p-4">
                    <Truck className="h-8 w-8 text-accent mb-2" />
                    <span className="text-sm font-medium">Motorista</span>
                  </CardContent>
                </Card>
              </div>
            </div>
            
            <Separator />
            
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome completo</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Seu nome completo"
                  value={signupForm.name}
                  onChange={(e) => setSignupForm(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="seu@email.com"
                  value={signupForm.email}
                  onChange={(e) => setSignupForm(prev => ({ ...prev, email: e.target.value }))}
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="(11) 99999-9999"
                    value={signupForm.phone}
                    onChange={(e) => setSignupForm(prev => ({ ...prev, phone: e.target.value }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="document">
                    {userType === 'PRODUTOR' ? 'CPF/CNPJ' : 'CPF'}
                  </Label>
                  <Input
                    id="document"
                    type="text"
                    placeholder={userType === 'PRODUTOR' ? '000.000.000-00' : '000.000.000-00'}
                    value={signupForm.document}
                    onChange={(e) => setSignupForm(prev => ({ ...prev, document: e.target.value }))}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="signup-password">Senha</Label>
                <div className="relative">
                  <Input
                    id="signup-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Crie uma senha forte"
                    value={signupForm.password}
                    onChange={(e) => setSignupForm(prev => ({ ...prev, password: e.target.value }))}
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
              
              <Button 
                type="submit" 
                className={`w-full ${
                  userType === 'PRODUTOR' 
                    ? 'gradient-primary text-primary-foreground' 
                    : 'bg-accent text-accent-foreground'
                }`}
              >
                Criar Conta
              </Button>
            </form>
            
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
      </DialogContent>
    </Dialog>
  );
};

export default AuthModal;