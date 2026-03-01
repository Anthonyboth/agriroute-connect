import React, { useState } from 'react';
import { devLog } from '@/lib/devLogger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTransportCompany } from '@/hooks/useTransportCompany';
import { CompanyInviteModal } from './CompanyInviteModal';
import { DriverDetailsModal } from './driver-details/DriverDetailsModal';
import { AffiliationSettingsModal } from './AffiliationSettingsModal';
import { DriverAvatar } from './ui/driver-avatar';
import { PendingDriverCard } from './company/PendingDriverCard';
import { Users, UserPlus, Star, Truck as TruckIcon, Phone, Mail, Search, Filter, Eye, Trash2, Pencil, IdCard, MapPin, FileText, Calendar, Clock, UserCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDocument } from '@/utils/document';
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
  const [activeTab, setActiveTab] = useState<string>(
    // Default to pending tab if there are pending drivers
    'active'
  );
  const [affiliationSettings, setAffiliationSettings] = useState<{
    isOpen: boolean;
    requestId: string | null;
    driver: any | null;
  }>({ isOpen: false, requestId: null, driver: null });
  const queryClient = useQueryClient();

  // Auto-switch to pending tab when pending drivers appear
  React.useEffect(() => {
    if (pendingDrivers && pendingDrivers.length > 0 && activeTab === 'active' && (!drivers || drivers.length === 0)) {
      setActiveTab('pending');
    }
  }, [pendingDrivers, drivers, activeTab]);

  const filteredDrivers = (drivers || []).filter((cd: any) => {
    const term = searchTerm.trim().toLowerCase();
    const name = cd.driver?.full_name?.toLowerCase() || '';
    const email = cd.driver?.email?.toLowerCase() || '';
    const phone = (cd.driver?.phone || cd.driver?.contact_phone || '').toLowerCase();
    
    const matchesSearch = term === '' || name.includes(term) || email.includes(term) || phone.includes(term);
    const matchesStatus = statusFilter === 'all' || cd.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const pendingCount = pendingDrivers?.length || 0;
  const activeCount = drivers?.length || 0;

  return (
    <div className="space-y-4">
      {/* Cabeçalho com ações */}
      {!inModal && (
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Motoristas Afiliados
            </h3>
            <p className="text-sm text-muted-foreground">
              Gerencie os motoristas da sua transportadora
            </p>
          </div>
          
          <Button onClick={() => setShowInviteModal(true)} className="bg-primary hover:bg-primary/90">
            <UserPlus className="h-4 w-4 mr-2" />
            Convidar Motorista
          </Button>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full grid grid-cols-2 h-12 bg-muted/50">
          <TabsTrigger 
            value="active" 
            className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm text-sm font-medium"
          >
            <UserCheck className="h-4 w-4" />
            <span>Ativos</span>
            {activeCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] px-1.5 text-xs">
                {activeCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger 
            value="pending" 
            className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm text-sm font-medium relative"
          >
            <Clock className="h-4 w-4" />
            <span>Pendentes</span>
            {pendingCount > 0 && (
              <Badge className="ml-1 h-5 min-w-[20px] px-1.5 text-xs bg-amber-500 text-white hover:bg-amber-500 border-0 animate-pulse">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* === TAB: MOTORISTAS ATIVOS === */}
        <TabsContent value="active" className="mt-4 space-y-4">
          {/* Filtros */}
          <Card className="border-border/60">
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-col sm:flex-row gap-3">
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

          {/* Contador */}
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
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredDrivers.map((cd: any) => {
                const driver = cd.driver;
                const formatAddress = () => {
                  const parts = [];
                  if (driver?.address_city && driver?.address_state) {
                    parts.push(`${driver.address_city} - ${driver.address_state}`);
                  }
                  return parts.length > 0 ? parts.join(', ') : null;
                };
                
                return (
                <Card key={cd.id} className="hover:shadow-lg transition-shadow h-full flex flex-col border-border/60">
                  <CardContent className="p-4 flex flex-col flex-1">
                    {/* Avatar e Info Principal */}
                    <div className="flex flex-col items-center text-center mb-4">
                      <DriverAvatar
                        profilePhotoUrl={driver?.profile_photo_url}
                        selfieUrl={driver?.selfie_url}
                        fullName={driver?.full_name}
                        className="h-16 w-16 border-2 border-muted mb-3"
                        fallbackClassName="text-lg"
                      />
                      
                      <h4 className="font-semibold text-base truncate max-w-full">{driver?.full_name}</h4>
                      
                      <div className="flex items-center gap-2 mt-1 flex-wrap justify-center">
                        <Badge variant={cd.status === 'ACTIVE' ? 'default' : 'secondary'} className="text-xs">
                          {cd.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                        </Badge>
                        {driver?.rating > 0 && (
                          <div className="flex items-center gap-1 text-sm">
                            <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                            <span className="font-medium">{driver.rating.toFixed(1)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Documento/CPF */}
                    {(driver?.cpf_cnpj || driver?.document) && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2 justify-center">
                        <IdCard className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
                        <span className="font-medium">{formatDocument(driver.cpf_cnpj || driver.document)}</span>
                      </div>
                    )}
                    
                    {/* Contato */}
                    <div className="space-y-1.5 text-sm text-muted-foreground mb-3">
                      {driver?.email && (
                        <span className="flex items-center gap-2 truncate">
                          <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                          <span className="truncate">{driver.email}</span>
                        </span>
                      )}
                      {(driver?.phone || driver?.contact_phone) && (
                        <span className="flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                          {driver?.phone || driver?.contact_phone}
                        </span>
                      )}
                      {formatAddress() && (
                        <span className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                          <span className="truncate">{formatAddress()}</span>
                        </span>
                      )}
                    </div>

                    {/* CNH */}
                    {(driver?.cnh_category || driver?.cnh_expiry_date) && (
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3 justify-center">
                        {driver?.cnh_category && (
                          <span className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            CNH: {driver.cnh_category}
                          </span>
                        )}
                        {driver?.cnh_expiry_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Val: {new Date(driver.cnh_expiry_date).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Permissões */}
                    <div className="flex flex-wrap gap-1.5 mb-4 justify-center">
                      {cd.can_accept_freights && (
                        <Badge variant="outline" className="text-xs bg-green-50 border-green-300 text-green-700">
                          <TruckIcon className="h-3 w-3 mr-1" />
                          Aceita fretes
                        </Badge>
                      )}
                      {cd.can_manage_vehicles && (
                        <Badge variant="outline" className="text-xs bg-blue-50 border-blue-300 text-blue-700">
                          <TruckIcon className="h-3 w-3 mr-1" />
                          Gerencia veículos
                        </Badge>
                      )}
                    </div>

                    {/* Ações */}
                    <div className="flex items-center justify-center gap-2 mt-auto pt-3 border-t border-border/50">
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
                        className="h-9 w-9 text-primary hover:text-primary hover:bg-primary/10"
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
                );
              })}
            </div>
          ) : (
            <Card className="border-dashed border-border/60">
              <CardContent className="pt-8 pb-8 text-center space-y-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
                  <Users className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <div>
                  <p className="text-muted-foreground mb-1 font-medium">
                    {searchTerm || statusFilter !== 'all' 
                      ? 'Nenhum motorista encontrado com os filtros aplicados' 
                      : 'Nenhum motorista ativo ainda'}
                  </p>
                  <p className="text-sm text-muted-foreground/70">
                    {!searchTerm && statusFilter === 'all' && pendingCount > 0
                      ? 'Você tem solicitações pendentes na aba "Pendentes"'
                      : 'Convide motoristas para sua transportadora'}
                  </p>
                  {!searchTerm && statusFilter === 'all' && pendingCount === 0 && (
                    <Button onClick={() => setShowInviteModal(true)} variant="outline" className="mt-4">
                      <UserPlus className="h-4 w-4 mr-2" />
                      Convidar Primeiro Motorista
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* === TAB: MOTORISTAS PENDENTES === */}
        <TabsContent value="pending" className="mt-4 space-y-4">
          {isLoadingPending ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-muted-foreground">Carregando solicitações...</p>
              </CardContent>
            </Card>
          ) : pendingCount > 0 ? (
            <>
              {/* Info banner */}
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <Clock className="h-5 w-5 text-amber-600 flex-shrink-0" />
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  <strong>{pendingCount}</strong> motorista{pendingCount > 1 ? 's' : ''} aguardando sua aprovação.
                  Revise os dados e aprove ou rejeite cada solicitação.
                </p>
              </div>

              {/* Lista de pendentes */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {pendingDrivers!.map((driver: any) => (
                  <PendingDriverCard
                    key={driver.id}
                    driver={driver}
                    onApprove={() => {
                      devLog('🚀 Configurando permissões para:', driver.driver?.full_name);
                      setAffiliationSettings({
                        isOpen: true,
                        requestId: driver.id,
                        driver: driver.driver
                      });
                    }}
                    onReject={() => rejectDriver.mutate(driver.driver_profile_id)}
                    isApproving={approveDriver.isPending}
                    isRejecting={rejectDriver.isPending}
                  />
                ))}
              </div>
            </>
          ) : (
            <Card className="border-dashed border-border/60">
              <CardContent className="pt-8 pb-8 text-center space-y-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-green-50 dark:bg-green-500/10 flex items-center justify-center">
                  <UserCheck className="h-8 w-8 text-green-500" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Nenhuma solicitação pendente</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Quando um motorista solicitar afiliação, a solicitação aparecerá aqui.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

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
