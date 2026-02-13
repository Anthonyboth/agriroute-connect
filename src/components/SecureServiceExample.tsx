import React, { useState, useEffect } from 'react';
import { devLog } from '@/lib/devLogger';
import { CenteredSpinner } from '@/components/ui/AppSpinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, Eye, EyeOff, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface SecureRequestData {
  id: string;
  service_type: string;
  problem_description: string;
  status: string;
  created_at: string;
  contact_phone_safe: string;
  location_address_safe: string;
  is_emergency: boolean;
}

/**
 * Componente que demonstra o uso seguro das novas funções de criptografia
 * e políticas RLS para proteger dados sensíveis de clientes
 */
export const SecureServiceExample: React.FC = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [requests, setRequests] = useState<SecureRequestData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSensitiveData, setShowSensitiveData] = useState(false);

  useEffect(() => {
    if (user) {
      fetchSecureRequests();
    }
  }, [user]);

  const fetchSecureRequests = async () => {
    if (!user) return;

    try {
      // Buscar o profile do usuário
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!profile) return;

      // Usar a nova função segura que mascara dados sensíveis automaticamente
      const { data: secureRequests, error } = await supabase
        .rpc('get_provider_service_requests', {
          provider_profile_id: profile.id
        });

      if (error) throw error;

      setRequests(secureRequests || []);
    } catch (error) {
      console.error('Erro ao buscar solicitações seguras:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar solicitações de serviços.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const testSecurityFunction = async (requestId: string) => {
    try {
      // Testar a função de dados seguros com autorização
      const { data: secureData, error } = await supabase
        .rpc('get_secure_service_request_details', {
          request_id: requestId
        });

      if (error) throw error;

      devLog('Dados seguros obtidos:', secureData);
      
      // Log de auditoria
      await supabase.rpc('log_sensitive_data_access', {
        request_id: requestId,
        access_type: 'VIEW_CONTACT_INFO'
      });

      toast({
        title: "Dados acessados com segurança",
        description: "Os dados sensíveis foram acessados e registrados no log de auditoria.",
      });
    } catch (error) {
      console.error('Erro ao acessar dados seguros:', error);
      toast({
        title: "Acesso negado",
        description: "Você não tem permissão para acessar esses dados sensíveis.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <CenteredSpinner className="py-12" />;
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-green-500" />
          Solicitações Seguras - Dados Criptografados
        </CardTitle>
        <CardDescription>
          Demonstração de como os dados sensíveis são protegidos por criptografia e RLS
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <Badge variant="outline" className="flex items-center gap-1">
            <Lock className="h-3 w-3" />
            Dados criptografados no banco
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSensitiveData(!showSensitiveData)}
          >
            {showSensitiveData ? (
              <>
                <EyeOff className="h-4 w-4 mr-2" />
                Ocultar detalhes
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-2" />
                Mostrar detalhes de segurança
              </>
            )}
          </Button>
        </div>

        {showSensitiveData && (
          <Card className="bg-muted/50 border-yellow-200">
            <CardContent className="p-4">
              <h4 className="font-medium mb-2 text-yellow-800">Recursos de Segurança Implementados:</h4>
              <ul className="text-sm space-y-1 text-yellow-700">
                <li>• <strong>Criptografia AES:</strong> Telefones e endereços criptografados no banco</li>
                <li>• <strong>RLS Policies:</strong> Acesso restrito baseado em função do usuário</li>
                <li>• <strong>Mascaramento automático:</strong> Dados sensíveis ocultos para não autorizados</li>
                <li>• <strong>Log de auditoria:</strong> Todos os acessos a dados sensíveis são registrados</li>
                <li>• <strong>Funções seguras:</strong> Validação de autorização antes do acesso</li>
              </ul>
            </CardContent>
          </Card>
        )}

        {requests.length === 0 ? (
          <div className="text-center py-8">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium text-muted-foreground">
              Nenhuma solicitação encontrada
            </p>
            <p className="text-sm text-muted-foreground">
              Ou você não tem permissão para ver essas solicitações
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <Card key={request.id} className="border-l-4 border-l-green-500">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-medium">{request.service_type}</h4>
                      <p className="text-sm text-muted-foreground">
                        {new Date(request.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={request.status === 'PENDING' ? 'secondary' : 'default'}>
                        {request.status}
                      </Badge>
                      {request.is_emergency && (
                        <Badge variant="destructive" className="text-xs">
                          Emergência
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Telefone (Protegido):</p>
                      <p className="text-sm font-mono bg-muted p-2 rounded">
                        {request.contact_phone_safe}
                      </p>
                      {request.contact_phone_safe.includes('***') && (
                        <p className="text-xs text-yellow-600 mt-1">
                          📱 Dados mascarados - Aceite a solicitação para ver
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Endereço (Protegido):</p>
                      <p className="text-sm font-mono bg-muted p-2 rounded">
                        {request.location_address_safe}
                      </p>
                      {request.location_address_safe.includes('restrito') && (
                        <p className="text-xs text-yellow-600 mt-1">
                          📍 Dados mascarados - Aceite a solicitação para ver
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mb-4">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Descrição:</p>
                    <p className="text-sm">{request.problem_description}</p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => testSecurityFunction(request.id)}
                    >
                      <Shield className="h-4 w-4 mr-2" />
                      Testar Acesso Seguro
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};