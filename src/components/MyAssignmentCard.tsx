import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, TrendingUp, Truck, DollarSign, AlertCircle, CheckCircle2, Navigation, Clock, Calendar, AlertTriangle } from 'lucide-react';
import { ANTTValidation } from './ANTTValidation';
import { ShareFreightToDriver } from './ShareFreightToDriver';
import { driverUpdateFreightStatus, FINAL_STATUSES } from '@/lib/freight-status-helpers';
import { useAuth } from '@/hooks/useAuth';
import { useTransportCompany } from '@/hooks/useTransportCompany';
import { formatTons, formatKm, formatBRL, formatDate } from '@/lib/formatters';
import { LABELS } from '@/lib/labels';
import { getPickupDateBadge } from '@/utils/freightDateHelpers';

interface MyAssignmentCardProps {
  assignment: any;
  onAction: () => void;
}

export const MyAssignmentCard: React.FC<MyAssignmentCardProps> = ({ assignment, onAction }) => {
  // 🔥 DEBUG FLAG: Confirmar versão nova do código está carregada
  console.log('🔥 [DEBUG] MyAssignmentCard VERSÃO NOVA carregada - SEM RELOAD');
  console.log('🔥 [DEBUG] Build timestamp:', new Date().toISOString());
  
  // 🔥 Verificar se há listeners de reload instalados
  React.useEffect(() => {
    console.log('🔥 [DEBUG] Verificando listeners de window...');
    console.log('🔥 [DEBUG] beforeunload listeners:', window.onbeforeunload ? 'SIM' : 'NÃO');
    console.log('🔥 [DEBUG] unload listeners:', window.onunload ? 'SIM' : 'NÃO');
    
    // Interceptar qualquer tentativa de reload
    const preventReload = (e: BeforeUnloadEvent) => {
      console.error('🔥 [DEBUG] ⚠️ TENTATIVA DE RELOAD DETECTADA E BLOQUEADA!');
      e.preventDefault();
      e.returnValue = '';
      return '';
    };
    
    // Não adicionar listener de fato, apenas logar se existir
    return () => {
      console.log('🔥 [DEBUG] MyAssignmentCard desmontado');
    };
  }, []);
  
  const { profile: currentUserProfile } = useAuth();
  const { company } = useTransportCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // 🛡️ Proteção contra null/undefined
  const freight = assignment?.freight ?? null;
  const status = assignment?.status ?? 'N/A';
  const agreedPrice = typeof assignment?.agreed_price === 'number' ? assignment.agreed_price : null;
  const pricePerKm = typeof assignment?.price_per_km === 'number' ? assignment.price_per_km : null;
  const minimumAnttPrice = typeof assignment?.minimum_antt_price === 'number' ? assignment.minimum_antt_price : null;

  // 🛡️ Se faltar assignment ou freight, retornar null (não renderizar nada)
  if (!assignment || !freight) {
    return null;
  }

  const isTransportCompany = currentUserProfile?.role === 'TRANSPORTADORA';

  const getStatusBadge = (s?: string) => {
    switch (s) {
      case 'ACCEPTED':
        return <Badge variant="outline">Aceito</Badge>;
      case 'LOADING':
        return <Badge variant="secondary">A Caminho</Badge>;
      case 'IN_TRANSIT':
        return <Badge variant="secondary">Em Trânsito</Badge>;
      case 'DELIVERED_PENDING_CONFIRMATION':
        return <Badge className="bg-orange-500">Aguardando Confirmação</Badge>;
      case 'DELIVERED':
        return <Badge variant="default">Entregue</Badge>;
      default:
        return <Badge variant="outline">{s || 'N/A'}</Badge>;
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    console.log('🔥 [DEBUG] handleStatusChange INICIADO:', { newStatus, freightId: freight?.id });
    
    try {
      // 🛡️ Validações iniciais
      if (!currentUserProfile || isUpdatingStatus || !freight?.id) {
        console.log('🔥 [DEBUG] Validação inicial falhou:', {
          hasProfile: !!currentUserProfile,
          isUpdating: isUpdatingStatus,
          hasFreightId: !!freight?.id
        });
        return;
      }
      
      // ✅ Check if freight is in final status using central constant
      if (freight?.status && FINAL_STATUSES.includes(freight.status as any)) {
        console.log('🔥 [DEBUG] Frete em status final, bloqueado:', freight.status);
        return; // Silently prevent action (helper will show toast if somehow reached)
      }
      
      console.log('🔥 [DEBUG] Iniciando atualização - setIsUpdatingStatus(true)');
      setIsUpdatingStatus(true);
      
      console.log('🔥 [DEBUG] Chamando driverUpdateFreightStatus...');
      const success = await driverUpdateFreightStatus({
        freightId: freight.id,
        newStatus,
        currentUserProfile,
        assignmentId: assignment.id
      });
      
      console.log('🔥 [DEBUG] driverUpdateFreightStatus retornou:', success);
      console.log('🔥 [DEBUG] setIsUpdatingStatus(false)');
      setIsUpdatingStatus(false);
      
      if (success) {
        console.log('🔥 [DEBUG] Sucesso! Invalidando queries...');
        
        await queryClient.invalidateQueries({ queryKey: ['assignments'] });
        console.log('🔥 [DEBUG] Query "assignments" invalidada');
        
        await queryClient.invalidateQueries({ queryKey: ['freights'] });
        console.log('🔥 [DEBUG] Query "freights" invalidada');
        
        await queryClient.invalidateQueries({ queryKey: ['active-freight'] });
        console.log('🔥 [DEBUG] Query "active-freight" invalidada');
        
        console.log('🔥 [DEBUG] Chamando onAction()...');
        onAction();
        console.log('🔥 [DEBUG] onAction() executado');
        
        console.log('🔥 [DEBUG] Mostrando toast de sucesso...');
        toast({
          title: "Status atualizado",
          description: "O frete foi marcado como 'A Caminho'",
        });
        
        console.log('🔥 [DEBUG] handleStatusChange CONCLUÍDO COM SUCESSO - SEM RELOAD');
      } else {
        console.log('🔥 [DEBUG] Falha na atualização, success=false');
      }
      
    } catch (error: any) {
      console.error('🔥 [DEBUG] ERRO CAPTURADO em handleStatusChange:', error);
      console.error('🔥 [DEBUG] Stack:', error.stack);
      console.error('🔥 [DEBUG] Mensagem:', error.message);
      
      setIsUpdatingStatus(false);
      
      toast({
        title: "Erro capturado",
        description: `Erro: ${error.message}`,
        variant: "destructive"
      });
      
      // 🚨 PREVENIR RELOAD ACIDENTAL
      if (error.message?.includes('reload') || error.message?.includes('refresh')) {
        console.error('🔥 [DEBUG] TENTATIVA DE RELOAD BLOQUEADA!');
        return;
      }
    }
  };

  // ✅ Check if freight is in final status using central constant
  const isFreightFinal = freight?.status ? FINAL_STATUSES.includes(freight.status as any) : false;

  // 🛡️ Proteção de dados para renderização
  const originCity = freight?.origin_city || '—';
  const originState = freight?.origin_state || '—';
  const destinationCity = freight?.destination_city || '—';
  const destinationState = freight?.destination_state || '—';
  const distanceKm = typeof freight?.distance_km === 'number' ? freight.distance_km : null;
  const requiredTrucks = typeof freight?.required_trucks === 'number' ? freight.required_trucks : 0;
  const acceptedTrucks = typeof freight?.accepted_trucks === 'number' ? freight.accepted_trucks : 0;
  const cargoType = freight?.cargo_type || freight?.service_type || '—';
  
  return (
    <Card className="border-l-4 border-l-green-600 overflow-hidden">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold truncate flex-1">{cargoType}</h3>
          <div className="flex items-center gap-2">
            {getStatusBadge(status)}
            {/* Badge de data de coleta */}
            {(() => {
              const badgeInfo = getPickupDateBadge(freight?.pickup_date);
              if (!badgeInfo) return null;
              
              const iconMap = { AlertTriangle, Clock, Calendar };
              const IconComponent = iconMap[badgeInfo.icon];
              
              return (
                <Badge variant={badgeInfo.variant} className="flex items-center gap-1 text-xs">
                  <IconComponent className="h-3 w-3" />
                  {badgeInfo.text}
                </Badge>
              );
            })()}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3 overflow-hidden">
        {/* Valor APENAS deste motorista */}
        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200">
          <p className="text-sm text-muted-foreground">Seu valor acordado:</p>
          <p className="text-2xl font-bold text-green-600">
            {formatBRL(agreedPrice, true)}
          </p>
          {assignment?.pricing_type === 'PER_KM' && pricePerKm !== null && (
            <p className="text-xs text-muted-foreground">
              {formatBRL(pricePerKm)}/km
            </p>
          )}
        </div>

        {/* Validação ANTT */}
        {minimumAnttPrice !== null && typeof distanceKm === 'number' && (
          <ANTTValidation
            proposedPrice={agreedPrice ?? 0}
            minimumAnttPrice={minimumAnttPrice}
            distance={distanceKm}
          />
        )}

        {/* Informações da rota */}
        <div className="space-y-1 text-sm">
          <p className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-green-600" />
            <span className="font-medium">Origem:</span> {originCity}, {originState}
          </p>
          <p className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-red-600" />
            <span className="font-medium">Destino:</span> {destinationCity}, {destinationState}
          </p>
          <p className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            <span>{formatKm(distanceKm)}</span>
          </p>
        </div>

        {/* Informação de múltiplas carretas */}
        {requiredTrucks > 1 && (
          <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200">
            <p className="text-xs text-blue-800 dark:text-blue-300 flex items-center gap-2">
              <Truck className="h-3 w-3" />
              Este frete tem {requiredTrucks} carretas. 
              Você é uma delas ({acceptedTrucks}/{requiredTrucks} contratadas).
            </p>
          </div>
        )}

        {/* Ações Rápidas de Atualização de Status */}
        {!isFreightFinal && (
          <div className="flex flex-col gap-2 pt-2">
            {status === 'ACCEPTED' && (
              <Button 
                variant="default" 
                size="sm"
                onClick={() => handleStatusChange('LOADING')}
                disabled={isUpdatingStatus}
                className="w-full whitespace-nowrap overflow-hidden text-ellipsis"
              >
                <Truck className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="truncate">Marcar como "A caminho"</span>
              </Button>
            )}
            {status === 'LOADING' && (
              <Button 
                variant="default" 
                size="sm"
                onClick={() => handleStatusChange('IN_TRANSIT')}
                disabled={isUpdatingStatus}
                className="w-full whitespace-nowrap overflow-hidden text-ellipsis"
              >
                <Navigation className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="truncate">Iniciar Trânsito</span>
              </Button>
            )}
            {status === 'IN_TRANSIT' && (
              <Button 
                variant="default" 
                size="sm"
                onClick={() => handleStatusChange('DELIVERED_PENDING_CONFIRMATION')}
                disabled={isUpdatingStatus}
                className="w-full whitespace-nowrap overflow-hidden text-ellipsis"
              >
                <CheckCircle2 className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="truncate">Encerrar Frete</span>
              </Button>
            )}
          </div>
        )}

        {/* Show final status message if applicable */}
        {isFreightFinal && (
          <div className="p-2 bg-muted rounded-lg">
            <p className="text-xs text-muted-foreground text-center">
              {freight?.status === 'DELIVERED_PENDING_CONFIRMATION' && 'Aguardando confirmação de entrega'}
              {freight?.status === 'DELIVERED' && 'Frete entregue'}
              {freight?.status === 'COMPLETED' && 'Frete concluído'}
              {freight?.status === 'CANCELLED' && 'Frete cancelado'}
            </p>
          </div>
        )}

        {/* Ações */}
        <div className="flex gap-2 pt-2">
          {/* Botão de compartilhamento para transportadoras */}
          {isTransportCompany && company?.id && status === 'ACCEPTED' && (
            <ShareFreightToDriver
              freight={freight}
              companyId={company.id}
              onSuccess={onAction}
            />
          )}
          
          <Button className="flex-1" onClick={onAction}>
            Ver Detalhes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};