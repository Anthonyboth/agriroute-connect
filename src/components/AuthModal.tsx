import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Package, Truck, Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'login' | 'signup';
}

export const AuthModal = ({ isOpen, onClose, initialTab = 'login' }: AuthModalProps) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [userType, setUserType] = useState<'PRODUTOR' | 'MOTORISTA'>('PRODUTOR');
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const [loginForm, setLoginForm] = useState({
    email: '',
    password: ''
  });

  const [signupForm, setSignupForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    cpfCnpj: ''
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Mock authentication - redirect based on email
    if (loginForm.email.includes('producer') || loginForm.email.includes('produtor')) {
      navigate('/dashboard/producer');
    } else {
      navigate('/dashboard/driver');
    }
    onClose();
  };

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Mock signup - redirect based on user type
    if (userType === 'PRODUTOR') {
      navigate('/dashboard/producer');
    } else {
      navigate('/dashboard/driver');
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center">
                <span className="text-white font-bold text-sm">A</span>
              </div>
              <span>AgriRoute</span>
            </div>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'login' | 'signup')}>
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
                  onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Sua senha"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <Button type="submit" variant="hero" className="w-full">
                Entrar
              </Button>
              
              <div className="text-center">
                <Button variant="link" size="sm">
                  Esqueceu sua senha?
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="signup" className="space-y-4">
            <div className="grid grid-cols-2 gap-2 mb-4">
              <Card 
                className={`cursor-pointer transition-all ${userType === 'PRODUTOR' ? 'ring-2 ring-primary' : ''}`}
                onClick={() => setUserType('PRODUTOR')}
              >
                <CardContent className="p-4 text-center">
                  <Package className="h-6 w-6 mx-auto mb-2 text-primary" />
                  <div className="text-sm font-medium">Produtor</div>
                </CardContent>
              </Card>
              
              <Card 
                className={`cursor-pointer transition-all ${userType === 'MOTORISTA' ? 'ring-2 ring-primary' : ''}`}
                onClick={() => setUserType('MOTORISTA')}
              >
                <CardContent className="p-4 text-center">
                  <Truck className="h-6 w-6 mx-auto mb-2 text-primary" />
                  <div className="text-sm font-medium">Motorista</div>
                </CardContent>
              </Card>
            </div>

            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome Completo</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Seu nome completo"
                  value={signupForm.name}
                  onChange={(e) => setSignupForm({ ...signupForm, name: e.target.value })}
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
                  onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="(11) 99999-9999"
                  value={signupForm.phone}
                  onChange={(e) => setSignupForm({ ...signupForm, phone: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cpf-cnpj">CPF/CNPJ</Label>
                <Input
                  id="cpf-cnpj"
                  type="text"
                  placeholder={userType === 'PRODUTOR' ? "CNPJ da propriedade" : "CPF do motorista"}
                  value={signupForm.cpfCnpj}
                  onChange={(e) => setSignupForm({ ...signupForm, cpfCnpj: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-password">Senha</Label>
                <div className="relative">
                  <Input
                    id="signup-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Mínimo 6 caracteres"
                    value={signupForm.password}
                    onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
                    required
                    minLength={6}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <Button type="submit" variant="hero" className="w-full">
                Criar Conta como {userType === 'PRODUTOR' ? 'Produtor' : 'Motorista'}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <div className="text-xs text-center text-muted-foreground">
          Ao continuar, você concorda com nossos{' '}
          <Button variant="link" className="h-auto p-0 text-xs">
            Termos de Uso
          </Button>{' '}
          e{' '}
          <Button variant="link" className="h-auto p-0 text-xs">
            Política de Privacidade
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};