import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import DocumentUpload from '@/components/DocumentUpload';
import LocationPermission from '@/components/LocationPermission';

const Auth = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'PRODUTOR' | 'MOTORISTA'>('PRODUTOR');
  const [phone, setPhone] = useState('');
  const [document, setDocument] = useState('');
  const [documentUrls, setDocumentUrls] = useState({
    selfie: '',
    document_photo: '',
    cnh: '',
    truck_documents: '',
    truck_photo: '',
    license_plate: '',
    address_proof: ''
  });
  const [locationEnabled, setLocationEnabled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          // Redirect based on user role after login
          handleRedirectAfterAuth(session.user.id);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        handleRedirectAfterAuth(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleRedirectAfterAuth = async (userId: string) => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, status')
        .eq('user_id', userId)
        .single();

      if (profile) {
        if (profile.status !== 'APPROVED') {
          toast.info('Sua conta está pendente de aprovação');
          return;
        }

        switch (profile.role) {
          case 'ADMIN':
            navigate('/admin');
            break;
          case 'MOTORISTA':
            navigate('/dashboard/driver');
            break;
          case 'PRODUTOR':
            navigate('/dashboard/producer');
            break;
          default:
            navigate('/');
        }
      }
    } catch (error) {
      console.error('Error checking profile:', error);
      navigate('/');
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation for required fields
    if (role === 'MOTORISTA' && !locationEnabled) {
      toast.error('Motoristas devem ativar a localização para usar o app');
      return;
    }
    
    if (!documentUrls.selfie) {
      toast.error('Selfie é obrigatória para todos os usuários');
      return;
    }
    
    if (!documentUrls.document_photo) {
      toast.error('Foto do documento é obrigatória');
      return;
    }
    
    if (role === 'MOTORISTA') {
      const requiredDocs = ['cnh', 'truck_documents', 'truck_photo', 'license_plate', 'address_proof'];
      const missingDocs = requiredDocs.filter(doc => !documentUrls[doc as keyof typeof documentUrls]);
      if (missingDocs.length > 0) {
        toast.error('Motoristas devem enviar todos os documentos obrigatórios');
        return;
      }
    }

    setLoading(true);

    try {
      const { data: authData, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: fullName,
            role,
            phone,
            document,
            ...documentUrls,
            location_enabled: locationEnabled
          }
        }
      });

      if (error) {
        if (error.message.includes('already registered')) {
          toast.error('Email já cadastrado. Tente fazer login.');
        } else {
          toast.error(error.message);
        }
      } else if (authData.user) {
        // Update profile with document URLs
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            selfie_url: documentUrls.selfie,
            document_photo_url: documentUrls.document_photo,
            cnh_photo_url: documentUrls.cnh,
            truck_documents_url: documentUrls.truck_documents,
            truck_photo_url: documentUrls.truck_photo,
            license_plate_photo_url: documentUrls.license_plate,
            address_proof_url: documentUrls.address_proof,
            contact_phone: phone,
            location_enabled: locationEnabled
          })
          .eq('user_id', authData.user.id);
          
        if (profileError) {
          console.error('Error updating profile:', profileError);
        }
        
        toast.success('Cadastro realizado! Verifique seu email e aguarde aprovação.');
      }
    } catch (error) {
      toast.error('Erro no cadastro');
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.error('Email ou senha incorretos');
        } else {
          toast.error(error.message);
        }
      }
    } catch (error) {
      toast.error('Erro no login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>AgriRoute Connect</CardTitle>
          <CardDescription>
            Conectando produtores e transportadores
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Cadastro</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Entrar
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="register">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nome Completo</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(11) 99999-9999"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="document">CPF/CNPJ</Label>
                  <Input
                    id="document"
                    value={document}
                    onChange={(e) => setDocument(e.target.value)}
                    placeholder="000.000.000-00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Tipo de Usuário</Label>
                  <Select value={role} onValueChange={(value: 'PRODUTOR' | 'MOTORISTA') => setRole(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PRODUTOR">Produtor</SelectItem>
                      <SelectItem value="MOTORISTA">Motorista</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Document Uploads - Universal */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Documentos Obrigatórios</h3>
                  
                  <DocumentUpload
                    label="Selfie"
                    fileType="selfie"
                    bucketName="profile-photos"
                    onUploadComplete={(url) => setDocumentUrls(prev => ({ ...prev, selfie: url }))}
                    required
                  />
                  
                  <DocumentUpload
                    label="Foto do Documento (RG/CNH)"
                    fileType="document"
                    bucketName="profile-photos"
                    onUploadComplete={(url) => setDocumentUrls(prev => ({ ...prev, document_photo: url }))}
                    required
                  />
                </div>

                {/* Motorista-specific documents */}
                {role === 'MOTORISTA' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Documentos Adicionais - Motorista</h3>
                    
                    <DocumentUpload
                      label="CNH (Carteira Nacional de Habilitação)"
                      fileType="cnh"
                      bucketName="driver-documents"
                      onUploadComplete={(url) => setDocumentUrls(prev => ({ ...prev, cnh: url }))}
                      required
                    />
                    
                    <DocumentUpload
                      label="Documentos da Carreta"
                      fileType="truck_docs"
                      bucketName="driver-documents"
                      onUploadComplete={(url) => setDocumentUrls(prev => ({ ...prev, truck_documents: url }))}
                      required
                    />
                    
                    <DocumentUpload
                      label="Foto da Carreta"
                      fileType="truck_photo"
                      bucketName="driver-documents"
                      onUploadComplete={(url) => setDocumentUrls(prev => ({ ...prev, truck_photo: url }))}
                      required
                    />
                    
                    <DocumentUpload
                      label="Foto das Placas"
                      fileType="plates"
                      bucketName="driver-documents"
                      onUploadComplete={(url) => setDocumentUrls(prev => ({ ...prev, license_plate: url }))}
                      required
                    />
                    
                    <DocumentUpload
                      label="Comprovante de Endereço"
                      fileType="address"
                      bucketName="driver-documents"
                      onUploadComplete={(url) => setDocumentUrls(prev => ({ ...prev, address_proof: url }))}
                      required
                      accept="image/*,application/pdf"
                    />

                    <LocationPermission
                      onPermissionChange={setLocationEnabled}
                      required
                    />
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Cadastrar
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;