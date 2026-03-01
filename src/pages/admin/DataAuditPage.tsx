import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Database, User, FileText, Search, RefreshCw, 
  AlertTriangle, CheckCircle, XCircle, Clock, Eye
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AuditData {
  profile: {
    id: string;
    user_id: string;
    full_name: string;
    role: string;
    active_mode: string;
    status: string;
  } | null;
  freightCounts: {
    total: number;
    byStatus: Record<string, number>;
  };
  serviceCounts: {
    total: number;
    byStatus: Record<string, number>;
  };
  recentFreights: any[];
  recentServices: any[];
}

const DataAuditPage: React.FC = () => {
  const { profile: currentProfile } = useAuth();
  const [searchProfileId, setSearchProfileId] = useState('');
  const [targetProfileId, setTargetProfileId] = useState<string | null>(null);

  // Fetch audit data
  const { data: auditData, isLoading, refetch } = useQuery({
    queryKey: ['data-audit', targetProfileId || currentProfile?.id],
    queryFn: async (): Promise<AuditData> => {
      const profileId = targetProfileId || currentProfile?.id;
      if (!profileId) throw new Error('No profile ID');

      // Get profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, status, active_mode')
        .eq('id', profileId)
        .maybeSingle();

      // Get freight counts by status
      const { data: freights } = await supabase
        .from('freights')
        .select('id, status')
        .or(`producer_id.eq.${profileId},driver_id.eq.${profileId}`);

      const freightCounts = {
        total: freights?.length || 0,
        byStatus: freights?.reduce((acc, f) => {
          acc[f.status] = (acc[f.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>) || {},
      };

      // Get service counts by status
      const { data: services } = await supabase
        .from('service_requests')
        .select('id, status')
        .or(`client_id.eq.${profileId},provider_id.eq.${profileId}`);

      const serviceCounts = {
        total: services?.length || 0,
        byStatus: services?.reduce((acc, s) => {
          acc[s.status] = (acc[s.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>) || {},
      };

      // Get recent freights
      const { data: recentFreights } = await supabase
        .from('freights')
        .select('id, status, created_at, origin_city, destination_city, price')
        .or(`producer_id.eq.${profileId},driver_id.eq.${profileId}`)
        .order('created_at', { ascending: false })
        .limit(10);

      // Get recent services
      const { data: recentServices } = await supabase
        .from('service_requests')
        .select('id, status, created_at, service_type, estimated_price')
        .or(`client_id.eq.${profileId},provider_id.eq.${profileId}`)
        .order('created_at', { ascending: false })
        .limit(10);

      return {
        profile: profile ? {
          ...profile,
          role: profile.active_mode || 'UNKNOWN',
        } : null,
        freightCounts,
        serviceCounts,
        recentFreights: recentFreights || [],
        recentServices: recentServices || [],
      };
    },
    enabled: !!(targetProfileId || currentProfile?.id),
  });

  const handleSearch = () => {
    if (searchProfileId.trim()) {
      setTargetProfileId(searchProfileId.trim());
    }
  };

  const handleReset = () => {
    setSearchProfileId('');
    setTargetProfileId(null);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="h-6 w-6 text-primary" />
            Auditoria de Dados de Relatórios
          </h1>
          <p className="text-muted-foreground">
            Diagnóstico rápido para depurar relatórios zerados
          </p>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="h-5 w-5" />
            Buscar Perfil
          </CardTitle>
          <CardDescription>
            Insira um profile_id para auditar ou use o perfil atual
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="profile_id (UUID)"
              value={searchProfileId}
              onChange={(e) => setSearchProfileId(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleSearch}>
              <Search className="h-4 w-4 mr-2" />
              Buscar
            </Button>
            <Button variant="outline" onClick={handleReset}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="mt-3 text-sm text-muted-foreground">
            <p>Perfil atual: <code className="bg-muted px-1 rounded">{currentProfile?.id || 'N/A'}</code></p>
            <p>p_profile_id usado: <code className="bg-muted px-1 rounded">{targetProfileId || currentProfile?.id || 'N/A'}</code></p>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : auditData ? (
        <>
          {/* Profile Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5" />
                Informações do Perfil
              </CardTitle>
            </CardHeader>
            <CardContent>
              {auditData.profile ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <InfoItem label="ID" value={auditData.profile.id} mono />
                  <InfoItem label="User ID" value={auditData.profile.user_id} mono />
                  <InfoItem label="Nome" value={auditData.profile.full_name} />
                  <InfoItem label="Role/Mode" value={auditData.profile.role || auditData.profile.active_mode} />
                  <InfoItem 
                    label="Status" 
                    value={auditData.profile.status}
                    badge
                    badgeVariant={auditData.profile.status === 'APPROVED' ? 'default' : 'destructive'}
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2 text-destructive">
                  <XCircle className="h-5 w-5" />
                  <span>Perfil não encontrado</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Counts by Status */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Contagem de Fretes
                  <Badge variant="outline" className="ml-auto">
                    Total: {auditData.freightCounts.total}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {Object.entries(auditData.freightCounts.byStatus).length > 0 ? (
                  <div className="space-y-2">
                    {Object.entries(auditData.freightCounts.byStatus).map(([status, count]) => (
                      <div key={status} className="flex justify-between items-center p-2 bg-muted rounded">
                        <span className="text-sm font-medium">{status}</span>
                        <Badge variant="secondary">{count as number}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-amber-600">
                    <AlertTriangle className="h-5 w-5" />
                    <span>Nenhum frete encontrado para este perfil</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Contagem de Serviços
                  <Badge variant="outline" className="ml-auto">
                    Total: {auditData.serviceCounts.total}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {Object.entries(auditData.serviceCounts.byStatus).length > 0 ? (
                  <div className="space-y-2">
                    {Object.entries(auditData.serviceCounts.byStatus).map(([status, count]) => (
                      <div key={status} className="flex justify-between items-center p-2 bg-muted rounded">
                        <span className="text-sm font-medium">{status}</span>
                        <Badge variant="secondary">{count as number}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-amber-600">
                    <AlertTriangle className="h-5 w-5" />
                    <span>Nenhum serviço encontrado para este perfil</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent Records */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Últimos Registros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="freights">
                <TabsList>
                  <TabsTrigger value="freights">
                    Fretes ({auditData.recentFreights.length})
                  </TabsTrigger>
                  <TabsTrigger value="services">
                    Serviços ({auditData.recentServices.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="freights">
                  <ScrollArea className="h-64">
                    {auditData.recentFreights.length > 0 ? (
                      <div className="space-y-2">
                        {auditData.recentFreights.map((freight: any) => (
                          <div key={freight.id} className="p-3 border rounded-lg text-sm">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-mono text-xs text-muted-foreground">{freight.id}</p>
                                <p className="font-medium">
                                  {freight.origin_city} → {freight.destination_city}
                                </p>
                              </div>
                              <Badge>{freight.status}</Badge>
                            </div>
                            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                              <span>{new Date(freight.created_at).toLocaleString('pt-BR')}</span>
                              <span>Preço (admin): R$ {freight.price?.toLocaleString('pt-BR') || '0'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">
                        Nenhum frete recente
                      </p>
                    )}
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="services">
                  <ScrollArea className="h-64">
                    {auditData.recentServices.length > 0 ? (
                      <div className="space-y-2">
                        {auditData.recentServices.map((service: any) => (
                          <div key={service.id} className="p-3 border rounded-lg text-sm">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-mono text-xs text-muted-foreground">{service.id}</p>
                                <p className="font-medium">{service.service_type}</p>
                              </div>
                              <Badge>{service.status}</Badge>
                            </div>
                            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                              <span>{new Date(service.created_at).toLocaleString('pt-BR')}</span>
                              <span>R$ {service.estimated_price?.toLocaleString('pt-BR') || '0'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">
                        Nenhum serviço recente
                      </p>
                    )}
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Diagnostic Summary */}
          <Card className={auditData.freightCounts.total === 0 && auditData.serviceCounts.total === 0 
            ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20' 
            : 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20'
          }>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Diagnóstico
              </CardTitle>
            </CardHeader>
            <CardContent>
              {auditData.freightCounts.total === 0 && auditData.serviceCounts.total === 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-amber-700">
                    <AlertTriangle className="h-5 w-5" />
                    <span className="font-medium">Relatórios zerados - Possíveis causas:</span>
                  </div>
                  <ul className="list-disc list-inside text-sm text-amber-600 space-y-1">
                    <li>O profile_id não está vinculado a nenhum frete ou serviço</li>
                    <li>O usuário não tem registros no período selecionado</li>
                    <li>O campo driver_id/provider_id não foi preenchido corretamente</li>
                    <li>O perfil está usando um ID diferente do esperado</li>
                  </ul>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircle className="h-5 w-5" />
                  <span>Dados encontrados! Se os relatórios estão zerados, verifique o período selecionado.</span>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
};

const InfoItem: React.FC<{
  label: string;
  value: string | null | undefined;
  mono?: boolean;
  badge?: boolean;
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
}> = ({ label, value, mono, badge, badgeVariant = 'default' }) => (
  <div>
    <p className="text-xs text-muted-foreground">{label}</p>
    {badge ? (
      <Badge variant={badgeVariant}>{value || 'N/A'}</Badge>
    ) : (
      <p className={`text-sm font-medium ${mono ? 'font-mono text-xs' : ''} truncate`}>
        {value || 'N/A'}
      </p>
    )}
  </div>
);

export default DataAuditPage;
