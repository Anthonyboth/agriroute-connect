import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useTransportCompany } from '@/hooks/useTransportCompany';
import { useAffiliationValidation } from '@/hooks/useAffiliationValidation';
import { CompanyInviteModal } from './CompanyInviteModal';
import { DriverDetailsModal } from './driver-details/DriverDetailsModal';
import { AffiliationSettingsModal } from './AffiliationSettingsModal';
import { DriverAvatar } from './ui/driver-avatar';
import { Users, UserPlus, Star, Truck, Phone, Mail, Search, Filter, Eye, Check, AlertCircle, Trash2, Pencil } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface CompanyDriverManagerProps {
  inModal?: boolean;
}

export const CompanyDriverManager: React.FC<CompanyDriverManagerProps> = ({ inModal = false }) => {
  const { 
    drivers, 
    isLoadingDrivers, 
    pendingDrivers, 
    isLoadingPending,
    removeDriver,
    approveDriver,
    rejectDriver,
    company 
  } = useTransportCompany();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedDriver, setSelectedDriver] = useState<any | null>(null);
  const [removingDriverId, setRemovingDriverId] = useState<string | null>(null);
  const [affiliationSettings, setAffiliationSettings] = useState<{
    isOpen: boolean;
    requestId: string | null;
    driver: any | null;
  }>({ isOpen: false, requestId: null, driver: null });
  const queryClient = useQueryClient();

  // Filtrar motoristas

  const filteredDrivers = (drivers || []).filter((cd: any) => {
    const term = searchTerm.trim().toLowerCase();
    const name = cd.driver?.full_name?.toLowerCase() || '';
    const email = cd.driver?.email?.toLowerCase() || '';
    const phone = (cd.driver?.phone || cd.driver?.contact_phone || '').toLowerCase();
    
    const matchesSearch = term === '' || name.includes(term) || email.includes(term) || phone.includes(term);
    const matchesStatus = statusFilter === 'all' || cd.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-4">
      {/* Solicitações Pendentes */}
      {pendingDrivers && pendingDrivers.length > 0 && (
        <Card className="border-yellow-500/50 bg-yellow-50/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-700">
              <Users className="h-5 w-5" />
              Solicitações Pendentes ({pendingDrivers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingDrivers.map((driver: any) => {
                const validation = useAffiliationValidation(driver.driver);
                
                return (
                  <div 
                    key={driver.id} 
                    className="relative p-4 border-2 border-green-500 rounded-lg bg-background shadow-lg animate-pulse-border"
                  >
                    {/* Badge "NOVO" */}
                    <div className="absolute -top-2 -right-2 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold animate-bounce z-10">
                      NOVO
                    </div>

                    <div className="flex flex-col gap-4">
                      {/* Header com foto e info */}
                      <div className="flex items-center gap-4">
                        <DriverAvatar
                          profilePhotoUrl={driver.driver?.profile_photo_url}
                          selfieUrl={driver.driver?.selfie_url}
                          fullName={driver.driver?.full_name}
                          className="h-16 w-16 border-2 border-green-500"
                          fallbackClassName="bg-green-100 text-green-700 text-xl"
                        />
                        
                        <div className="flex-1">
                          <p className="font-semibold text-lg">{driver.driver?.full_name}</p>
                          <p className="text-sm text-muted-foreground">{driver.driver?.email}</p>
                          <p className="text-sm text-muted-foreground">{driver.driver?.contact_phone}</p>
                          
                          {driver.driver?.rating > 0 && (
                            <div className="flex items-center gap-1 mt-1">
                              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                              <span className="text-sm">{driver.driver.rating.toFixed(1)}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Badges de validação */}
                      <div className="flex flex-wrap gap-2">
                        {driver.driver?.cnh_validation_status === 'APPROVED' && (
                          <Badge variant="outline" className="text-xs bg-green-50 border-green-500 text-green-700">
                            <Check className="h-3 w-3 mr-1" /> CNH Válida
                          </Badge>
                        )}
                        {driver.driver?.document_validation_status === 'APPROVED' && (
                          <Badge variant="outline" className="text-xs bg-green-50 border-green-500 text-green-700">
                            <Check className="h-3 w-3 mr-1" /> Documentos OK
                          </Badge>
                        )}
                        {validation.hasAllDocuments ? (
                          <Badge variant="outline" className="text-xs bg-green-50 border-green-500 text-green-700">
                            <Check className="h-3 w-3 mr-1" /> Perfil Completo
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs bg-blue-50 border-blue-500 text-blue-700">
                            Documentos pendentes ({validation.optionalFields.length})
                          </Badge>
                        )}
                      </div>

                      {/* Barra de completude do perfil */}
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Completude do Perfil</span>
                          <span className="font-bold text-foreground">{validation.completionPercentage}%</span>
                        </div>
                        <Progress value={validation.completionPercentage} className="h-2" />
                      </div>

                      {/* Avisos de documentos opcionais */}
                      {validation.optionalFields.length > 0 && (
                        <Alert className="py-2 border-blue-500/50 bg-blue-50/10">
                          <AlertCircle className="h-4 w-4 text-blue-600" />
                          <AlertDescription className="text-xs text-blue-700">
                            <strong>Documentos opcionais:</strong> {validation.optionalFields.join(', ')}
                            <p className="mt-1 text-muted-foreground">
                              Você pode aprovar agora e solicitar depois.
                            </p>
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Avisos de dados obrigatórios faltando (apenas CPF/CNPJ) */}
                      {validation.missingFields.length > 0 && (
                        <Alert variant="destructive" className="py-2">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription className="text-xs">
                            <strong>Dados obrigatórios faltando:</strong> {validation.missingFields.join(', ')}
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Botões de ação */}
                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          className="flex-1 bg-green-600 hover:bg-green-700"
                          onClick={() => {
                            console.log('🚀 Configurando permissões para:', driver.driver?.full_name);
                            setAffiliationSettings({
                              isOpen: true,
                              requestId: driver.id,
                              driver: driver.driver
                            });
                          }}
                          disabled={approveDriver.isPending}
                          title="Configurar permissões e aprovar"
                        >
                          {approveDriver.isPending ? (
                            <>
                              <Check className="h-4 w-4 mr-2 animate-spin" />
                              Aprovando...
                            </>
                          ) : (
                            <>
                              <Check className="h-4 w-4 mr-2" />
                              Aprovar
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => rejectDriver.mutate(driver.driver_profile_id)}
                          disabled={rejectDriver.isPending}
                        >
                          {rejectDriver.isPending ? 'Rejeitando...' : 'Rejeitar'}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cabeçalho com ações */}
      {!inModal && (
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Users className="h-5 w-5" />
              Motoristas Afiliados
            </h3>
            <p className="text-sm text-muted-foreground">
              Gerencie os motoristas da sua transportadora
            </p>
          </div>
          
          <Button onClick={() => setShowInviteModal(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Convidar Motorista
          </Button>
        </div>
      )}

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou email..."
                  defaultValue={searchTerm}
                  onChange={(e) => {
                    const value = e.target.value;
                    clearTimeout((window as any).__searchTimeout);
                    (window as any).__searchTimeout = setTimeout(() => {
                      setSearchTerm(value);
                    }, 300);
                  }}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="ACTIVE">Ativos</SelectItem>
                <SelectItem value="INACTIVE">Inativos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Contador de resultados */}
      {!isLoadingDrivers && drivers && drivers.length > 0 && (
        <div className="text-sm text-muted-foreground px-1">
          Exibindo {filteredDrivers.length} de {drivers.length} motoristas
        </div>
      )}

      {/* Lista de motoristas */}
      {isLoadingDrivers ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Carregando motoristas...</p>
          </CardContent>
        </Card>
      ) : filteredDrivers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDrivers.map((cd: any) => (
            <Card key={cd.id} className="hover:shadow-lg transition-shadow h-full flex flex-col">
              <CardContent className="p-4 flex flex-col flex-1">
                {/* Avatar e Info Principal */}
                <div className="flex flex-col items-center text-center mb-4">
                  <DriverAvatar
                    profilePhotoUrl={cd.driver?.profile_photo_url}
                    selfieUrl={cd.driver?.selfie_url}
                    fullName={cd.driver?.full_name}
                    className="h-16 w-16 border-2 border-muted mb-3"
                    fallbackClassName="text-lg"
                  />
                  
                  <h4 className="font-semibold text-base truncate max-w-full">{cd.driver?.full_name}</h4>
                  
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={cd.status === 'ACTIVE' ? 'default' : 'secondary'} className="text-xs">
                      {cd.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                    </Badge>
                    {cd.driver?.rating > 0 && (
                      <div className="flex items-center gap-1 text-sm">
                        <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                        <span className="font-medium">{cd.driver.rating.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Contato */}
                <div className="space-y-2 text-sm text-muted-foreground mb-4">
                  {cd.driver?.email && (
                    <span className="flex items-center gap-2 truncate">
                      <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate">{cd.driver.email}</span>
                    </span>
                  )}
                  {(cd.driver?.phone || cd.driver?.contact_phone) && (
                    <span className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                      {cd.driver?.phone || cd.driver?.contact_phone}
                    </span>
                  )}
                </div>

                {/* Permissões */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {cd.can_accept_freights && (
                    <Badge variant="outline" className="text-xs bg-green-50 border-green-300 text-green-700">
                      <Truck className="h-3 w-3 mr-1" />
                      Aceita fretes
                    </Badge>
                  )}
                  {cd.can_manage_vehicles && (
                    <Badge variant="outline" className="text-xs bg-blue-50 border-blue-300 text-blue-700">
                      <Truck className="h-3 w-3 mr-1" />
                      Gerencia veículos
                    </Badge>
                  )}
                </div>

                {/* Ações - sempre no rodapé */}
                <div className="flex items-center justify-center gap-2 mt-auto pt-3 border-t">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => setSelectedDriver(cd)}
                    title="Ver detalhes"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    onClick={() => {
                      setAffiliationSettings({
                        isOpen: true,
                        requestId: cd.id,
                        driver: cd.driver
                      });
                    }}
                    title="Editar permissões"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                        title="Excluir motorista"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remover motorista?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Tem certeza que deseja remover <strong>{cd.driver?.full_name}</strong> da transportadora?
                          <br /><br />
                          O motorista será desvinculado e perderá acesso aos fretes da empresa.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={async () => {
                            setRemovingDriverId(cd.driver_profile_id);
                            try {
                              await removeDriver(cd.driver_profile_id);
                            } finally {
                              setRemovingDriverId(null);
                            }
                          }}
                          disabled={removingDriverId === cd.driver_profile_id}
                        >
                          {removingDriverId === cd.driver_profile_id ? 'Removendo...' : 'Sim, Remover'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6 text-center space-y-4">
            <Users className="h-12 w-12 mx-auto opacity-50" />
            <div>
              <p className="text-muted-foreground mb-1">
                {searchTerm || statusFilter !== 'all' 
                  ? 'Nenhum motorista encontrado com os filtros aplicados' 
                  : 'Nenhum motorista afiliado ainda'}
              </p>
              {!searchTerm && statusFilter === 'all' && (
                <Button onClick={() => setShowInviteModal(true)} variant="outline" className="mt-4">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Convidar Primeiro Motorista
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modals */}
      <CompanyInviteModal open={showInviteModal} onOpenChange={setShowInviteModal} />

      {company && (
        <DriverDetailsModal
          driver={selectedDriver}
          companyId={company.id}
          open={!!selectedDriver}
          onOpenChange={(open) => !open && setSelectedDriver(null)}
        />
      )}

      <AffiliationSettingsModal
        isOpen={affiliationSettings.isOpen}
        onClose={() => setAffiliationSettings({ isOpen: false, requestId: null, driver: null })}
        driver={affiliationSettings.driver}
        onSave={async (settings) => {
          if (!affiliationSettings.requestId) return;

          const { error } = await supabase
            .from('company_drivers')
            .update({
              status: 'ACTIVE',
              can_accept_freights: settings.can_accept_freights,
              can_manage_vehicles: settings.can_manage_vehicles,
              accepted_at: new Date().toISOString()
            })
            .eq('id', affiliationSettings.requestId);

          if (error) {
            toast.error('Erro ao aprovar solicitação');
            throw error;
          }

          // Notificar motorista
          const driver = pendingDrivers?.find((d: any) => d.id === affiliationSettings.requestId);
          if (driver) {
            await supabase.from('notifications').insert({
              user_id: driver.driver_profile_id,
              title: 'Afiliação Aprovada!',
              message: `Sua solicitação de afiliação à ${company?.company_name} foi aprovada!`,
              type: 'affiliation_approved'
            });
          }

          toast.success('Motorista afiliado com sucesso!');
          queryClient.invalidateQueries({ queryKey: ['pending-drivers'] });
          queryClient.invalidateQueries({ queryKey: ['company-drivers'] });
        }}
      />
    </div>
  );
};