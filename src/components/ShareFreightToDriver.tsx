import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { showErrorToast } from '@/lib/error-handler';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { formatKm } from '@/lib/formatters';
import { getCanonicalFreightPrice, type FreightPricingInput } from '@/lib/freightPriceContract';
import { resolveDriverUnitPrice } from '@/hooks/useFreightCalculator';

interface ShareFreightToDriverProps {
  freight: {
    id: string;
    cargo_type: string;
    origin_city?: string;
    origin_state?: string;
    destination_city?: string;
    destination_state?: string;
    price: number;
    required_trucks?: number;
    distance_km?: number;
    minimum_antt_price?: number;
    service_type?: string;
    pricing_type?: string | null;
    price_per_ton?: number | null;
    price_per_km?: number | null;
    weight?: number | null;
  };
  companyId: string;
  onSuccess?: () => void;
}

interface AffiliatedDriver {
  id: string;
  driver_profile_id: string;
  driver: {
    id: string;
    full_name: string;
    contact_phone?: string;
  };
}

export const ShareFreightToDriver: React.FC<ShareFreightToDriverProps> = ({
  freight,
  companyId,
  onSuccess
}) => {
  const requiredTrucks = Math.max((freight.required_trucks ?? 1) || 1, 1);
  
  // ✅ Contrato canônico para exibição
  const pricingInput: FreightPricingInput = {
    pricing_type: freight.pricing_type,
    price_per_ton: freight.price_per_ton,
    price_per_km: freight.price_per_km,
    price: freight.price,
    required_trucks: requiredTrucks,
    weight: freight.weight,
    distance_km: freight.distance_km,
  };
  const priceDisplay = getCanonicalFreightPrice(pricingInput);

  // Valor unitário legado para operações de banco e campo de input
  const unitOriginalPrice = resolveDriverUnitPrice(0, freight.price || 0, requiredTrucks);
  const minAnttPerTruck = typeof freight.minimum_antt_price === 'number'
    ? resolveDriverUnitPrice(0, freight.minimum_antt_price || 0, requiredTrucks)
    : null;

  const [showDialog, setShowDialog] = useState(false);
  const [drivers, setDrivers] = useState<AffiliatedDriver[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  // ✅ Transportadora trabalha por unidade (/carreta) em multi-carreta
  const [agreedPrice, setAgreedPrice] = useState<string>(unitOriginalPrice.toString());
  const [pricePerKm, setPricePerKm] = useState<string>('');
  const [pricingType, setPricingType] = useState<'FIXED' | 'PER_KM'>('FIXED');
  const [loading, setLoading] = useState(false);
  const [fetchingDrivers, setFetchingDrivers] = useState(false);
  const [assignedDriverIds, setAssignedDriverIds] = useState<Set<string>>(new Set());

  const activeAssignmentStatuses = ['ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT', 'DELIVERED_PENDING_CONFIRMATION'] as const;

  useEffect(() => {
    if (showDialog) {
      fetchDrivers();
    }
  }, [showDialog]);

  const fetchDrivers = async () => {
    setFetchingDrivers(true);
    try {
      // Fetch active drivers
      const { data, error } = await supabase
        .from('company_drivers')
        .select(`
          id,
          driver_profile_id,
          driver:profiles_secure!company_drivers_driver_profile_id_fkey(
            id,
            full_name,
            contact_phone
          )
        `)
        .eq('company_id', companyId)
        .eq('status', 'ACTIVE');

      if (error) throw error;
      setDrivers(data || []);

      // Fetch existing assignments for this freight
      const { data: assignments } = await supabase
        .from('freight_assignments')
        .select('driver_id')
        .eq('freight_id', freight.id);

      if (assignments) {
        setAssignedDriverIds(new Set(assignments.map(a => a.driver_id)));
      }
    } catch (error: any) {
      console.error('Erro ao buscar motoristas:', error);
      showErrorToast(toast, 'Erro ao carregar motoristas', error);
    } finally {
      setFetchingDrivers(false);
    }
  };

  const handleShare = async () => {
    if (!selectedDriverId) {
      toast.error('Selecione um motorista');
      return;
    }

    const finalPrice = parseFloat(agreedPrice);
    if (isNaN(finalPrice) || finalPrice <= 0) {
      toast.error('Digite um valor válido');
      return;
    }

    if (pricingType === 'PER_KM' && (!pricePerKm || parseFloat(pricePerKm) <= 0)) {
      toast.error('Digite o valor por KM');
      return;
    }

    setLoading(true);
    
    try {
      // =====================================================
      // Preflight (CRÍTICO): impedir oversubscription
      // =====================================================
      // Para fretes de 1 carreta, deve existir no máximo 1 motorista ativo.
      // Em multi-carreta, o limite é required_trucks. Usamos a contagem REAL
      // de assignments ativos (não apenas accepted_trucks) para evitar drift.
      const { data: freightFresh, error: freightFreshError } = await supabase
        .from('freights')
        .select('id, status, required_trucks, accepted_trucks')
        .eq('id', freight.id)
        .single();

      if (freightFreshError || !freightFresh) {
        throw freightFreshError || new Error('Frete não encontrado');
      }

      if (freightFresh.status !== 'OPEN') {
        toast.error('Este frete não está mais disponível');
        setShowDialog(false);
        return;
      }

      const required = Math.max((freightFresh.required_trucks ?? 1) || 1, 1);

      const { count: realAcceptedCount, error: realAcceptedError } = await supabase
        .from('freight_assignments')
        .select('id', { count: 'exact', head: true })
        .eq('freight_id', freight.id)
        .in('status', [...activeAssignmentStatuses]);

      if (realAcceptedError) throw realAcceptedError;

      const realAccepted = realAcceptedCount ?? 0;
      const slotsRemaining = required - realAccepted;

      if (slotsRemaining <= 0) {
        toast.error(required === 1
          ? 'Este frete já está atribuído a um motorista'
          : 'Este frete já está com todas as vagas preenchidas'
        );
        setShowDialog(false);
        return;
      }

      // Check if assignment already exists
      const { data: existing } = await supabase
        .from('freight_assignments')
        .select('id')
        .eq('freight_id', freight.id)
        .eq('driver_id', selectedDriverId)
        .maybeSingle();

      if (existing) {
        toast.info('Este motorista já está atribuído a este frete.');
        setShowDialog(false);
        return;
      }

      // Criar assignment usando upsert para segurança
      const { error: assignmentError } = await supabase
        .from('freight_assignments')
        .upsert({
          freight_id: freight.id,
          driver_id: selectedDriverId,
          company_id: companyId,
          status: 'ACCEPTED',
          agreed_price: finalPrice,
          pricing_type: pricingType,
          price_per_km: pricingType === 'PER_KM' ? parseFloat(pricePerKm) : null,
          minimum_antt_price: freight.minimum_antt_price || null,
        }, {
          onConflict: 'freight_id,driver_id',
          ignoreDuplicates: true
        });

      if (assignmentError) {
        // Handle duplicate key constraint specifically
        if (assignmentError.code === '23505') {
          toast.info('Este motorista já está atribuído a este frete.');
          setShowDialog(false);
          return;
        }
        throw assignmentError;
      }

      const selectedDriver = drivers.find(d => d.driver_profile_id === selectedDriverId);
      
      toast.success(
        `Frete atribuído a ${selectedDriver?.driver?.full_name || 'motorista'}!`,
        {
          description: 'O motorista foi notificado e pode começar a atualizar o status do frete.'
        }
      );
      
      setShowDialog(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Erro ao compartilhar frete:', error?.message || error);
      
      // Tratamento específico para duplicata
      if (error?.code === '23505' || error?.message?.includes('duplicate') || error?.message?.includes('already exists')) {
        toast.error('Este motorista já está atribuído a este frete.');
      } else {
        showErrorToast(toast, 'Erro ao atribuir frete', error);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setShowDialog(true)}
        variant="default"
        size="sm"
        className="gap-2"
      >
        <UserPlus className="h-4 w-4" />
        Compartilhar com Motorista
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Atribuir Frete ao Motorista</DialogTitle>
            <DialogDescription>
              Selecione um motorista afiliado para realizar este frete
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Informações do Frete */}
            <div className="p-3 bg-muted rounded-lg space-y-1 text-sm">
              <p><strong>Carga:</strong> {freight.cargo_type}</p>
              <p><strong>Origem:</strong> {freight.origin_city}, {freight.origin_state}</p>
              <p><strong>Destino:</strong> {freight.destination_city}, {freight.destination_state}</p>
              {freight.distance_km && <p><strong>Distância:</strong> {formatKm(freight.distance_km)}</p>}
              <p>
                <strong>Valor:</strong> {priceDisplay.primaryLabel}
              </p>
            </div>

            {/* Seleção de Motorista */}
            <div className="space-y-2">
              <Label htmlFor="driver">Motorista *</Label>
              <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
                <SelectTrigger id="driver">
                  <SelectValue placeholder={fetchingDrivers ? "Carregando..." : "Selecione o motorista"} />
                </SelectTrigger>
                <SelectContent>
                  {drivers.map((driver) => {
                    const isAssigned = assignedDriverIds.has(driver.driver_profile_id);
                    return (
                      <SelectItem 
                        key={driver.driver_profile_id} 
                        value={driver.driver_profile_id}
                        disabled={isAssigned}
                      >
                        {driver.driver.full_name}
                        {driver.driver.contact_phone && ` - ${driver.driver.contact_phone}`}
                        {isAssigned && ' (Já atribuído)'}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Tipo de Precificação */}
            <div className="space-y-2">
              <Label htmlFor="pricing-type">Tipo de Pagamento *</Label>
              <Select value={pricingType} onValueChange={(v) => setPricingType(v as 'FIXED' | 'PER_KM')}>
                <SelectTrigger id="pricing-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FIXED">Valor Fixo</SelectItem>
                  <SelectItem value="PER_KM">Por Quilômetro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Valor Acordado */}
            <div className="space-y-2">
              <Label htmlFor="agreed-price">Valor Acordado (R$) *</Label>
              <Input
                id="agreed-price"
                type="number"
                step="0.01"
                min="0"
                value={agreedPrice}
                onChange={(e) => setAgreedPrice(e.target.value)}
                placeholder="Ex: 5000.00"
              />
            </div>

            {/* Valor por KM (se aplicável) */}
            {pricingType === 'PER_KM' && (
              <div className="space-y-2">
                <Label htmlFor="price-per-km">Valor por KM (R$) *</Label>
                <Input
                  id="price-per-km"
                  type="number"
                  step="0.01"
                  min="0"
                  value={pricePerKm}
                  onChange={(e) => setPricePerKm(e.target.value)}
                  placeholder="Ex: 3.50"
                />
              </div>
            )}

            {/* Aviso ANTT */}
            {minAnttPerTruck !== null && parseFloat(agreedPrice) < minAnttPerTruck && (
              <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 rounded-lg text-xs text-yellow-800 dark:text-yellow-300">
                ⚠️ Valor abaixo do mínimo ANTT (R$ {minAnttPerTruck.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}{requiredTrucks > 1 ? ' /carreta' : ''})
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={handleShare} disabled={loading || !selectedDriverId}>
              {loading ? 'Atribuindo...' : 'Atribuir Frete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
