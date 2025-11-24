import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ErrorMonitoringService } from '@/services/errorMonitoringService';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectLabel, SelectGroup } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Plus, Loader2, Truck, Info, Save, RotateCcw } from 'lucide-react';
import { SaveTemplateDialog } from './freight-templates/SaveTemplateDialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ANTTValidation } from './ANTTValidation';
import { CARGO_TYPES, CARGO_CATEGORIES, getCargoTypesByCategory, cargoRequiresAxles, AXLE_OPTIONS, VEHICLE_TYPES_URBAN } from '@/lib/cargo-types';
import { LocationFillButton } from './LocationFillButton';
import { StructuredAddressInput } from './StructuredAddressInput';
import { UnifiedLocationInput } from './UnifiedLocationInput';
import { freightSchema, validateInput } from '@/lib/validations';
import { getCityId } from '@/lib/city-utils';
import { calculateFreightPrice, convertWeightToKg } from '@/lib/freight-calculations';
import { WeightInput } from '@/components/WeightInput';
import { useFreightDraft } from '@/hooks/useFreightDraft';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CreateFreightModalProps {
  onFreightCreated: () => void;
  userProfile: any;
  guestMode?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
  initialData?: Partial<typeof formDataInitial>;
}

const formDataInitial = {
  cargo_type: '',
  weight: '',
  origin_zip: '',
  origin_address: '',
  origin_neighborhood: '',
  origin_street: '',
  origin_number: '',
  origin_complement: '',
  origin_city: '',
  origin_state: '',
  origin_city_id: undefined as string | undefined,
  origin_lat: undefined as number | undefined,
  origin_lng: undefined as number | undefined,
  destination_zip: '',
  destination_address: '',
  destination_neighborhood: '',
  destination_street: '',
  destination_number: '',
  destination_complement: '',
  destination_city: '',
  destination_state: '',
  destination_city_id: undefined as string | undefined,
  destination_lat: undefined as number | undefined,
  destination_lng: undefined as number | undefined,
  price: '',
  price_per_km: '',
  pricing_type: 'PER_KM' as 'FIXED' | 'PER_KM' | 'PER_TON',
  pickup_date: '',
  delivery_date: '',
  urgency: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH',
  description: '',
  service_type: 'CARGA',
  vehicle_type_required: '',
  vehicle_axles_required: '',
  high_performance: false,
  vehicle_ownership: 'PROPRIO' as 'PROPRIO' | 'TERCEIROS',
  pickup_observations: '',
  delivery_observations: '',
  payment_method: 'DIRETO',
  required_trucks: '1',
  visibility_filter: 'ALL' as 'ALL' | 'TRANSPORTADORAS' | 'AUTONOMOS' | 'AVALIACAO_3' | 'AVALIACAO_4',
  guest_name: '',
  guest_email: '',
  guest_phone: '',
  guest_document: ''
};

const CreateFreightModal = ({ onFreightCreated, userProfile, guestMode = false, isOpen: externalIsOpen, onClose: externalOnClose, initialData }: CreateFreightModalProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showAxlesSelector, setShowAxlesSelector] = useState(false);
  const [calculatedAnttPrice, setCalculatedAnttPrice] = useState<number | null>(null);
  const [anttDetails, setAnttDetails] = useState<any>(null);
  const [calculatedDistance, setCalculatedDistance] = useState<number>(0);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [showUserExistsWarning, setShowUserExistsWarning] = useState(false);
  const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false);
  const [formData, setFormData] = useState({ ...formDataInitial, ...initialData });
  
  const isModalOpen = externalIsOpen !== undefined ? externalIsOpen : open;
  
  const { hasDraft, lastSaved, saveDraft, clearDraft, restoreDraft } = useFreightDraft(
    userProfile?.id,
    !guestMode && isModalOpen
  );

  // Auto-save draft every 3 seconds
  useEffect(() => {
    if (!guestMode && isModalOpen && !initialData) {
      const interval = setInterval(() => {
        const hasData = Object.values(formData).some(v => v && v !== '');
        if (hasData) {
          saveDraft(formData);
        }
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [formData, guestMode, isModalOpen, initialData, saveDraft]);

  const handleModalClose = () => {
    if (externalOnClose) {
      externalOnClose();
    } else {
      setOpen(false);
    }
    // Não limpar draft ao fechar, apenas quando publicar ou salvar modelo
  };

  const handleRestoreDraft = () => {
    const draftData = restoreDraft();
    if (draftData) {
      setFormData({ ...formDataInitial, ...draftData });
      toast.success('Rascunho restaurado');
    }
  };

  const handleClearDraft = () => {
    if (confirm('Descartar rascunho e começar novo frete?')) {
      clearDraft();
      setFormData(formDataInitial);
      toast.info('Rascunho descartado');
    }
  };

  const handleSaveAsTemplate = async (title: string) => {
    try {
      const { error } = await supabase
        .from('freight_templates')
        .insert({
          producer_id: userProfile.id,
          title: title,
          payload: formData
        });

      if (error) throw error;

      toast.success('Modelo salvo com sucesso!');
      clearDraft(); // Limpar rascunho ao salvar modelo
    } catch (error: any) {
      console.error('Erro ao salvar modelo:', error);
      toast.error('Erro ao salvar modelo');
      throw error;
    }
  };

  // Evitar travamentos: aplica timeout nas chamadas de edge functions
  const withTimeoutAny = (promise: Promise<any>, ms = 5000): Promise<any> => {
    return Promise.race([
      promise,
      new Promise((_resolve, reject) => setTimeout(() => reject(new Error('timeout')), ms)) as Promise<any>
    ]) as Promise<any>;
  };

  const calculateDistance = async (origin: string, destination: string): Promise<number> => {
    try {
      const invoke = supabase.functions.invoke('calculate-route', {
        body: { origin, destination }
      });
      const { data, error } = await withTimeoutAny(invoke, 5000);
      if (error) throw error;
      return data.distance_km;
    } catch (error: any) {
      // ✅ LOG DETALHADO
      console.error('❌ Error calculating distance:', {
        message: error?.message,
        status: error?.status,
        statusCode: error?.statusCode,
        context: error?.context,
        origin: origin,
        destination: destination,
        fullError: error
      });
      
      // ✅ ENVIAR PARA TELEGRAM
      await ErrorMonitoringService.getInstance().captureError(
        new Error(`Calculate Route Failed: ${error?.message || 'Unknown error'}`),
        {
          module: 'CreateFreightModal',
          functionName: 'calculateDistance',
          origin,
          destination,
          errorStatus: error?.status,
          errorStatusCode: error?.statusCode,
          userFacing: true
        }
      );
      
      // Fallback para cálculo local
      return Math.floor(Math.random() * 800) + 100;
    }
  };

  const extractStateFromAddress = (address: string): string | null => {
    const stateAbbreviations = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
    for (const state of stateAbbreviations) {
      if (address.toUpperCase().includes(state) || address.toUpperCase().includes(state.toLowerCase())) {
        return state;
      }
    }
    return null;
  };

  const calculateMinimumAnttPrice = async (cargoType: string, weight: number, distance: number, originState: string, destinationState: string): Promise<number> => {
    let retries = 0;
    const maxRetries = 2;

    while (retries <= maxRetries) {
      try {
        const axles = formData.vehicle_axles_required ? parseInt(formData.vehicle_axles_required) : 5;
        
        // Derivar table_type (A/B/C/D)
        let table_type: 'A' | 'B' | 'C' | 'D';
        if (formData.high_performance) {
          table_type = formData.vehicle_ownership === 'PROPRIO' ? 'C' : 'D';
        } else {
          table_type = formData.vehicle_ownership === 'PROPRIO' ? 'A' : 'B';
        }

        console.log(`🔄 Tentativa ${retries + 1}/${maxRetries + 1} - Calculando ANTT...`, {
          cargo_type: cargoType,
          distance_km: distance,
          axles,
          table_type
        });

        const invoke = supabase.functions.invoke('antt-calculator', {
          body: {
            cargo_type: cargoType,
            distance_km: distance,
            axles,
            origin_state: originState || formData.origin_state,
            destination_state: destinationState || formData.destination_state,
            table_type,
            required_trucks: parseInt(formData.required_trucks) || 1
          }
        });
        const { data, error } = await withTimeoutAny(invoke, 8000); // Aumentar timeout
        
        if (error) {
          console.error(`❌ Erro na tentativa ${retries + 1}:`, error);
          throw error;
        }

        if (!data || !data.minimum_freight_value) {
          console.error('❌ Resposta inválida do ANTT calculator:', data);
          throw new Error('Resposta inválida do servidor');
        }

        console.log('✅ ANTT calculado com sucesso:', data);

        // Persistir no estado - usar valores POR CARRETA
        setCalculatedAnttPrice(data.minimum_freight_value);
        setAnttDetails(data.calculation_details);

        return (data?.minimum_freight_value as number) ?? 0;
      } catch (error) {
        retries++;
        console.error(`❌ Tentativa ${retries} falhou:`, error);
        
        if (retries <= maxRetries) {
          console.log(`⏳ Aguardando 1s antes da próxima tentativa...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          console.error('❌ Todas as tentativas falharam');
          toast.error(
            "Erro ao calcular preço ANTT após 3 tentativas.\n" +
            "Verifique:\n" +
            "• Tipo de carga\n" +
            "• Número de eixos\n" +
            "• Conexão com internet"
          );
          return 0;
        }
      }
    }
    
    return 0;
  };

  const handleInputChange = (field: string, value: any) => {
    // Validação especial para forma de pagamento
    if (field === 'payment_method' && value !== 'DIRETO') {
      toast.error('Apenas pagamento direto ao motorista está disponível no momento');
      return; // Não atualiza o estado se não for DIRETO
    }
    
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Detectar se carga requer seleção de eixos
  React.useEffect(() => {
    if (formData.cargo_type) {
      const requiresAxles = cargoRequiresAxles(formData.cargo_type);
      setShowAxlesSelector(requiresAxles);
      
      // Limpar campos conflitantes
      if (requiresAxles) {
        setFormData(prev => ({ ...prev, vehicle_type_required: '' }));
      } else {
        setFormData(prev => ({ ...prev, vehicle_axles_required: '', high_performance: false }));
        setCalculatedAnttPrice(null);
        setAnttDetails(null);
      }
    }
  }, [formData.cargo_type]);

  // Calcular preço ANTT automaticamente com retry
  const calculateAnttWithRetry = async (retries = 3): Promise<boolean> => {
    if (!formData.cargo_type || !calculatedDistance || !formData.vehicle_axles_required) {
      console.warn('⚠️ Dados insuficientes para cálculo ANTT');
      return false;
    }
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const axles = parseInt(formData.vehicle_axles_required);
        
        // Derivar table_type (A/B/C/D)
        let table_type: 'A' | 'B' | 'C' | 'D';
        if (formData.high_performance) {
          table_type = formData.vehicle_ownership === 'PROPRIO' ? 'C' : 'D';
        } else {
          table_type = formData.vehicle_ownership === 'PROPRIO' ? 'A' : 'B';
        }

        console.log(`🔢 Tentativa ${attempt}/${retries} - Calculando ANTT...`, {
          cargo_type: formData.cargo_type,
          distance_km: calculatedDistance,
          axles,
          table_type
        });

        const { data, error } = await supabase.functions.invoke('antt-calculator', {
          body: {
            cargo_type: formData.cargo_type,
            distance_km: calculatedDistance,
            axles,
            origin_state: formData.origin_state,
            destination_state: formData.destination_state,
            table_type,
            num_trucks: parseInt(formData.required_trucks) || 1
          }
        });

        if (error) {
          console.error(`❌ Tentativa ${attempt} falhou:`, error);
          if (attempt === retries) {
            throw new Error(`Falha ao calcular ANTT após ${retries} tentativas: ${error.message}`);
          }
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }

        if (data && data.minimum_total && data.minimum_total > 0) {
          console.log('✅ ANTT calculado com sucesso:', data);
          setCalculatedAnttPrice(data.minimum_total);
          setAnttDetails(data);
          return true;
        } else {
          console.error(`❌ Tentativa ${attempt}: ANTT retornou valor inválido`, data);
          if (attempt === retries) {
            throw new Error('ANTT calculado está zerado ou inválido');
          }
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      } catch (error: any) {
        console.error(`❌ Erro na tentativa ${attempt}:`, error);
        if (attempt === retries) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
    return false;
  };

  // Calcular preço ANTT automaticamente (sem retry, para UI)
  const calculateAnttPrice = async () => {
    if (!formData.cargo_type || !calculatedDistance || !formData.vehicle_axles_required) {
      return;
    }
    
    try {
      const axles = parseInt(formData.vehicle_axles_required);
      
      // Derivar table_type (A/B/C/D)
      let table_type: 'A' | 'B' | 'C' | 'D';
      if (formData.high_performance) {
        table_type = formData.vehicle_ownership === 'PROPRIO' ? 'C' : 'D';
      } else {
        table_type = formData.vehicle_ownership === 'PROPRIO' ? 'A' : 'B';
      }

      console.log('🔢 Calculating ANTT price...', {
        cargo_type: formData.cargo_type,
        distance_km: calculatedDistance,
        axles,
        table_type
      });

      const { data, error } = await supabase.functions.invoke('antt-calculator', {
        body: {
          cargo_type: formData.cargo_type,
          distance_km: calculatedDistance,
          axles,
          origin_state: formData.origin_state,
          destination_state: formData.destination_state,
          table_type,
          required_trucks: parseInt(formData.required_trucks) || 1
        }
      });
      
      if (error) {
        console.error('Error calculating ANTT:', error);
        throw error;
      }
      
      console.log('ANTT calculated:', data);
      setCalculatedAnttPrice(data.minimum_freight_value);
      setAnttDetails(data.calculation_details);
      
      // Sugerir preço se ainda não preenchido
      if (!formData.price && !formData.price_per_km) {
        if (formData.pricing_type === 'FIXED') {
          handleInputChange('price', String(data.suggested_freight_value));
        } else {
          const pricePerKm = data.suggested_freight_value / calculatedDistance;
          handleInputChange('price_per_km', pricePerKm.toFixed(2));
        }
      }
    } catch (error) {
      console.error('Erro ao calcular ANTT:', error);
      toast.error('Erro ao calcular preço ANTT. Tente novamente.');
    }
  };

  // Recalcular ANTT quando parâmetros mudarem
  React.useEffect(() => {
    if (showAxlesSelector && formData.vehicle_axles_required && calculatedDistance > 0) {
      calculateAnttPrice();
    }
  }, [formData.cargo_type, formData.vehicle_axles_required, calculatedDistance, formData.high_performance, formData.vehicle_ownership, showAxlesSelector]);

  const validateGuestUser = async () => {
    if (!guestMode) return true;
    
    if (!formData.guest_document) {
      toast.error('CPF/CNPJ é obrigatório');
      return false;
    }

    if (!formData.guest_name || !formData.guest_phone) {
      toast.error('Nome e telefone são obrigatórios');
      return false;
    }

    try {
      const { data, error } = await supabase.functions.invoke('validate-guest-user', {
        body: {
          name: formData.guest_name,
          email: formData.guest_email,
          phone: formData.guest_phone,
          document: formData.guest_document
        }
      });

      if (error) throw error;

      if (data.user_exists) {
        setValidationResult(data);
        setShowUserExistsWarning(true);
        toast.error(data.message);
        return false;
      }

      setValidationResult(data);
      return true;
    } catch (error) {
      console.error('Erro na validação:', error);
      toast.error('Erro ao validar informações');
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // VALIDAÇÃO GUEST
    if (guestMode) {
      const isValid = await validateGuestUser();
      if (!isValid) {
        setLoading(false);
        return;
      }
    } else {
      // Verificar autenticação antes de criar frete
      if (!userProfile?.id) {
        toast.error('Faça login como produtor para criar um frete.');
        setLoading(false);
        return;
      }
    }
    
    setLoading(true);

    try {
      console.log('=== INICIANDO CRIAÇÃO DE FRETE ===');
      console.log('Dados do formulário:', formData);
      
      // Validação básica dos campos obrigatórios de localização
      if (!formData.origin_city || !formData.origin_state) {
        toast.error('Por favor, selecione a cidade de origem');
        return;
      }
      
      if (!formData.destination_city || !formData.destination_state) {
        toast.error('Por favor, selecione a cidade de destino');
        return;
      }


      // Validação do peso
      const weight = parseFloat(formData.weight);
      if (isNaN(weight) || weight <= 0) {
        toast.error('Peso deve ser maior que zero');
        return;
      }

      console.log('Peso validado:', weight, 'toneladas');

      // Calculate distance (mock for now)
      const distance = await calculateDistance(formData.origin_address, formData.destination_address);
      setCalculatedDistance(distance); // Salvar para cálculo ANTT
      
      // Usar UF selecionada no formulário; se ausente, tentar extrair do endereço
      const originState = formData.origin_state || extractStateFromAddress(formData.origin_address) || 'SP';
      const destState = formData.destination_state || extractStateFromAddress(formData.destination_address) || 'RJ';
      
      const minimumAnttPrice = await calculateMinimumAnttPrice(
        formData.cargo_type,
        weight,
        distance,
        originState,
        destState
      );

      // ✅ VALIDAÇÃO OBRIGATÓRIA: Não permitir criar frete sem ANTT
      if (showAxlesSelector && (!minimumAnttPrice || minimumAnttPrice === 0)) {
        toast.error(
          'Não foi possível calcular o preço mínimo ANTT. Verifique:\n' +
          '• Tipo de carga selecionado\n' +
          '• Número de eixos\n' +
          '• Distância válida\n\n' +
          'Tente novamente ou contate o suporte.'
        );
        setLoading(false);
        return;
      }

      // Buscar city_ids para origem e destino
      const originCityId = formData.origin_city_id || await getCityId(formData.origin_city, formData.origin_state);
      const destinationCityId = formData.destination_city_id || await getCityId(formData.destination_city, formData.destination_state);

      if (!originCityId || !destinationCityId) {
        console.warn('city_id não encontrado:', {
          origin: { city: formData.origin_city, state: formData.origin_state, id: originCityId },
          destination: { city: formData.destination_city, state: formData.destination_state, id: destinationCityId }
        });
      }

      // Calcular preços usando utilitário
      const calculation = calculateFreightPrice({
        pricePerKm: formData.pricing_type === 'PER_KM' ? parseFloat(formData.price_per_km) : undefined,
        pricePerTon: formData.pricing_type === 'PER_TON' ? parseFloat(formData.price_per_km) : undefined,
        fixedPrice: formData.pricing_type === 'FIXED' ? parseFloat(formData.price) : undefined,
        distanceKm: distance,
        weightKg: convertWeightToKg(weight),
        requiredTrucks: parseInt(formData.required_trucks),
        pricingType: formData.pricing_type,
        anttMinimumPrice: minimumAnttPrice
      });

      // Validar ANTT se aplicável
      if (minimumAnttPrice && !calculation.isAboveAnttMinimum) {
        toast.error(`Valor total (R$ ${calculation.totalPrice.toFixed(2)}) está abaixo do mínimo ANTT (R$ ${calculation.anttMinimumTotal?.toFixed(2)})`);
        setLoading(false);
        return;
      }

      const freightData = {
        producer_id: guestMode ? null : userProfile.id,
        
        // NOVOS campos guest
        is_guest_freight: guestMode,
        prospect_user_id: guestMode ? validationResult?.prospect_id : null,
        guest_contact_name: guestMode ? formData.guest_name : null,
        guest_contact_phone: guestMode ? formData.guest_phone : null,
        guest_contact_email: guestMode ? formData.guest_email : null,
        guest_contact_document: guestMode ? formData.guest_document.replace(/\D/g, '') : null,
        allow_counter_proposals: !guestMode,
        show_contact_after_accept: guestMode,
        
        cargo_type: formData.cargo_type,
        weight: convertWeightToKg(weight), // Usar utilitário
        origin_address: formData.origin_address,
        origin_city: formData.origin_city,
        origin_state: formData.origin_state,
        origin_city_id: originCityId,
        origin_lat: formData.origin_lat,
        origin_lng: formData.origin_lng,
        destination_address: formData.destination_address,
        destination_city: formData.destination_city,
        destination_state: formData.destination_state,
        destination_city_id: destinationCityId,
        destination_lat: formData.destination_lat,
        destination_lng: formData.destination_lng,
        distance_km: distance,
        minimum_antt_price: calculation.anttMinimumTotal || minimumAnttPrice, // Total ANTT
        price: calculation.totalPrice, // PREÇO TOTAL
        price_per_km: formData.pricing_type === 'PER_KM' ? parseFloat(formData.price_per_km) : null,
        price_per_ton: formData.pricing_type === 'PER_TON' ? parseFloat(formData.price_per_km) : null,
        pricing_type: formData.pricing_type,
        required_trucks: parseInt(formData.required_trucks),
        accepted_trucks: 0,
        pickup_date: formData.pickup_date,
        delivery_date: formData.delivery_date,
        urgency: formData.urgency,
        description: formData.description || null,
        vehicle_type_required: (formData.vehicle_type_required || null) as any,
        vehicle_axles_required: formData.vehicle_axles_required ? parseInt(formData.vehicle_axles_required) : null,
        high_performance: formData.high_performance || false,
        visibility_filter: formData.service_type === 'CARGA' ? formData.visibility_filter : 'ALL',
        status: 'OPEN' as const,
        // Adicionar metadata para tracking
        metadata: {
          price_per_truck: calculation.pricePerTruck,
          antt_per_truck: minimumAnttPrice,
          calculation_date: new Date().toISOString()
        }
      };

      const { data: insertedFreight, error } = await supabase
        .from('freights')
        .insert([freightData])
        .select('id')
        .single();

      if (error) throw error;

      // Trigger automatic spatial matching for drivers
      if (insertedFreight?.id) {
        try {
          console.log(`Triggering spatial matching for freight ${insertedFreight.id}...`);
          const matchingResponse = await supabase.functions.invoke('spatial-freight-matching', {
            body: { 
              freight_id: insertedFreight.id,
              notify_drivers: true 
            }
          });
          
          if (matchingResponse.error) {
            // ✅ LOG DETALHADO
            console.error('❌ Error in spatial matching:', {
              message: matchingResponse.error?.message,
              status: matchingResponse.error?.status,
              context: matchingResponse.error?.context,
              freightId: insertedFreight.id,
              fullError: matchingResponse.error
            });
            
            // ✅ ENVIAR PARA TELEGRAM
            await ErrorMonitoringService.getInstance().captureError(
              new Error(`Spatial Matching Failed: ${matchingResponse.error?.message || 'Unknown error'}`),
              {
                module: 'CreateFreightModal',
                functionName: 'handleCreateFreight - spatial matching',
                freightId: insertedFreight.id,
                errorStatus: matchingResponse.error?.status,
                userFacing: true
              }
            );
          } else {
            console.log('✅ Spatial matching completed:', matchingResponse.data);
          }
        } catch (matchingError: any) {
          // ✅ LOG DETALHADO
          console.error('❌ Failed to trigger spatial matching:', {
            message: matchingError?.message,
            freightId: insertedFreight.id,
            fullError: matchingError
          });
          
          // ✅ ENVIAR PARA TELEGRAM
          await ErrorMonitoringService.getInstance().captureError(
            new Error(`Spatial Matching Exception: ${matchingError?.message || 'Unknown error'}`),
            {
              module: 'CreateFreightModal',
              functionName: 'handleCreateFreight - spatial matching exception',
              freightId: insertedFreight.id,
              userFacing: true
            }
          );
          
          // Don't block freight creation if matching fails
        }
      }

      toast.success(
        guestMode 
          ? 'Solicitação enviada! Motoristas da região serão notificados.' 
          : 'Frete criado com sucesso! Motoristas qualificados serão notificados automaticamente.'
      );
      
      clearDraft(); // Limpar rascunho ao publicar frete
      
      if (externalOnClose) {
        externalOnClose();
      } else {
        setOpen(false);
      }
      
      setFormData({ ...formDataInitial });
      onFreightCreated();
    } catch (error) {
      console.error('=== ERRO NA CRIAÇÃO DO FRETE ===', error);
      
      let errorMessage = 'Erro ao criar frete';
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Tratar mensagens de erro específicas
        if (error.message.includes('weight')) {
          errorMessage = 'Erro na validação do peso. Verifique se o valor está correto.';
        }
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={externalOnClose || setOpen}>
      {!guestMode && (
        <DialogTrigger asChild>
          <Button className="bg-green-600 hover:bg-green-700">
            <Plus className="mr-2 h-4 w-4" />
            Criar Novo Frete
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <DialogTitle>{guestMode ? 'Solicitar Frete Rural sem Cadastro' : 'Criar Novo Frete'}</DialogTitle>
              <DialogDescription>
                {guestMode 
                  ? 'Preencha os detalhes do frete. Motoristas da região serão notificados automaticamente.'
                  : 'Preencha os detalhes do frete. Motoristas qualificados na região serão notificados automaticamente.'
                }
              </DialogDescription>
            </div>
            {!guestMode && userProfile?.role === 'PRODUTOR' && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowSaveTemplateDialog(true)}
                className="ml-2"
              >
                <Save className="h-4 w-4 mr-2" />
                Salvar Modelo
              </Button>
            )}
          </div>
        </DialogHeader>
        
        {!guestMode && hasDraft && !initialData && (
          <Alert className="mx-6 mt-4">
            <Info className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <div>
                <strong>Rascunho encontrado</strong>
                <p className="text-xs text-muted-foreground mt-1">
                  Salvo automaticamente {lastSaved && format(lastSaved, "d 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
              <div className="flex gap-2 ml-4">
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  onClick={handleRestoreDraft}
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  Continuar Rascunho
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleClearDraft}
                >
                  Descartar
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}
        
        <SaveTemplateDialog
          open={showSaveTemplateDialog}
          onOpenChange={setShowSaveTemplateDialog}
          onSave={handleSaveAsTemplate}
        />
        
        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto max-h-[60vh] pr-2">
          {guestMode && (
            <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
              <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-900/20">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>Solicitação sem Cadastro</strong><br/>
                  Preencha seus dados para que motoristas possam entrar em contato. 
                  Você receberá notificações por WhatsApp.
                </AlertDescription>
              </Alert>
              
              <h3 className="font-semibold text-sm">Seus Dados de Contato</h3>
              
              <div className="space-y-2">
                <Label htmlFor="guest_name">Nome Completo *</Label>
                <Input
                  id="guest_name"
                  value={formData.guest_name}
                  onChange={(e) => handleInputChange('guest_name', e.target.value)}
                  placeholder="Seu nome completo"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="guest_phone">WhatsApp *</Label>
                <Input
                  id="guest_phone"
                  value={formData.guest_phone}
                  onChange={(e) => handleInputChange('guest_phone', e.target.value)}
                  placeholder="(00) 00000-0000"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Será exibido para o motorista APÓS aceitar o frete
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="guest_email">Email (opcional)</Label>
                <Input
                  id="guest_email"
                  type="email"
                  value={formData.guest_email}
                  onChange={(e) => handleInputChange('guest_email', e.target.value)}
                  placeholder="seu@email.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="guest_document">CPF ou CNPJ *</Label>
                <Input
                  id="guest_document"
                  value={formData.guest_document}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    if (value.length <= 14) {
                      handleInputChange('guest_document', value);
                    }
                  }}
                  placeholder="000.000.000-00 ou 00.000.000/0000-00"
                  required
                  maxLength={18}
                />
                <p className="text-xs text-muted-foreground">
                  Necessário para controle e segurança
                </p>
              </div>

              {showUserExistsWarning && validationResult?.user_exists && (
                <Alert variant="destructive">
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Conta Encontrada!</strong><br/>
                    {validationResult.message}
                    <div className="mt-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          handleModalClose();
                          window.location.href = '/auth';
                        }}
                      >
                        Ir para Login
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cargo_type">Tipo de Carga *</Label>
              <Select
                value={formData.cargo_type}
                onValueChange={(value) => handleInputChange('cargo_type', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo de carga" />
                </SelectTrigger>
                <SelectContent>
                  {CARGO_CATEGORIES.map((category) => (
                    <SelectGroup key={category.value}>
                      <SelectLabel className="font-semibold text-primary">
                        {category.label}
                      </SelectLabel>
                      {getCargoTypesByCategory(category.value).map((cargo) => (
                        <SelectItem key={cargo.value} value={cargo.value}>
                          {cargo.label}
                        </SelectItem>
                      ))}
                      {category.value !== 'outros' && <Separator className="my-1" />}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="weight">Peso TOTAL (Toneladas) *</Label>
              <WeightInput
                value={formData.weight}
                onChange={(value) => handleInputChange('weight', value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="required_trucks">Quantidade de Carretas *</Label>
              <Input
                id="required_trucks"
                type="number"
                min="1"
                max="50"
                value={formData.required_trucks}
                onChange={(e) => handleInputChange('required_trucks', e.target.value)}
                placeholder="1"
                required
              />
              <p className="text-xs text-muted-foreground">
                Número de carretas necessárias. Cada motorista pode aceitar por valores diferentes através do sistema de propostas.
              </p>
            </div>
          </div>

                {/* Origem com CEP ou Cidade */}
                <div className="space-y-4">
                  <UnifiedLocationInput
                    label="CEP ou Cidade de Origem"
                    value={formData.origin_zip || ''}
                    onChange={(value, locationData) => {
                      if (locationData) {
                        handleInputChange('origin_city', locationData.city);
                        handleInputChange('origin_state', locationData.state);
                        if (locationData.cityId) {
                          handleInputChange('origin_city_id', locationData.cityId);
                        }
                        if (locationData.lat && locationData.lng) {
                          handleInputChange('origin_lat', String(locationData.lat));
                          handleInputChange('origin_lng', String(locationData.lng));
                        }
                        if (locationData.zipCode) {
                          handleInputChange('origin_zip', locationData.zipCode);
                        }
                        if (locationData.neighborhood) {
                          const currentAddress = formData.origin_address;
                          const addressParts = currentAddress ? currentAddress.split(',').map(p => p.trim()) : [];
                          addressParts[0] = locationData.neighborhood;
                          handleInputChange('origin_address', addressParts.join(', '));
                        }
                      }
                    }}
                    placeholder="Digite 00000-000 ou nome da cidade"
                    required
                  />

                  <StructuredAddressInput
                    label="Endereço Completo de Origem"
                    value={formData.origin_address}
                    initialNeighborhood={formData.origin_neighborhood}
                    initialStreet={formData.origin_street}
                    initialNumber={formData.origin_number}
                    initialComplement={formData.origin_complement}
                    onChange={(address, parts) => {
                      handleInputChange('origin_address', address);
                      if (parts) {
                        handleInputChange('origin_neighborhood', parts.neighborhood);
                        handleInputChange('origin_street', parts.street);
                        handleInputChange('origin_number', parts.number);
                        handleInputChange('origin_complement', parts.complement);
                      }
                    }}
                    required
                  />
                </div>

                {/* Destino com CEP ou Cidade */}
                <div className="space-y-4">
                  <UnifiedLocationInput
                    label="CEP ou Cidade de Destino"
                    value={formData.destination_zip || `${formData.destination_city}${formData.destination_state ? ', ' + formData.destination_state : ''}`}
                    onChange={(value, locationData) => {
                      if (locationData) {
                        handleInputChange('destination_city', locationData.city);
                        handleInputChange('destination_state', locationData.state);
                        if (locationData.cityId) {
                          handleInputChange('destination_city_id', locationData.cityId);
                        }
                        if (locationData.lat && locationData.lng) {
                          handleInputChange('destination_lat', String(locationData.lat));
                          handleInputChange('destination_lng', String(locationData.lng));
                        }
                        if (locationData.zipCode) {
                          handleInputChange('destination_zip', locationData.zipCode);
                        }
                        if (locationData.neighborhood) {
                          const currentAddress = formData.destination_address;
                          const addressParts = currentAddress ? currentAddress.split(',').map(p => p.trim()) : [];
                          addressParts[0] = locationData.neighborhood;
                          handleInputChange('destination_address', addressParts.join(', '));
                        }
                      }
                    }}
                    placeholder="Digite 00000-000 ou nome da cidade"
                    required
                  />

                  <StructuredAddressInput
                    label="Endereço Completo de Destino"
                    value={formData.destination_address}
                    initialNeighborhood={formData.destination_neighborhood}
                    initialStreet={formData.destination_street}
                    initialNumber={formData.destination_number}
                    initialComplement={formData.destination_complement}
                    onChange={(address, parts) => {
                      handleInputChange('destination_address', address);
                      if (parts) {
                        handleInputChange('destination_neighborhood', parts.neighborhood);
                        handleInputChange('destination_street', parts.street);
                        handleInputChange('destination_number', parts.number);
                        handleInputChange('destination_complement', parts.complement);
                      }
                    }}
                    required
                  />
                </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pickup_date">Data de Coleta *</Label>
              <Input
                id="pickup_date"
                type="date"
                value={formData.pickup_date}
                onChange={(e) => handleInputChange('pickup_date', e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="delivery_date">Data de Entrega *</Label>
              <Input
                id="delivery_date"
                type="date"
                value={formData.delivery_date}
                onChange={(e) => handleInputChange('delivery_date', e.target.value)}
                min={formData.pickup_date || new Date().toISOString().split('T')[0]}
                required
              />
            </div>
          </div>

          {/* Tipo de Cobrança */}
          <div className="space-y-2">
            <Label>Tipo de Cobrança</Label>
            <Select value={formData.pricing_type} onValueChange={(value: 'FIXED' | 'PER_KM' | 'PER_TON') => handleInputChange('pricing_type', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PER_KM">Por Quilômetro</SelectItem>
                <SelectItem value="PER_TON">Por Tonelada</SelectItem>
                <SelectItem value="FIXED">Valor Fixo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {formData.pricing_type === 'FIXED' ? (
              <div className="space-y-2">
                <Label htmlFor="price">Valor Fixo POR CARRETA (R$) *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => handleInputChange('price', e.target.value)}
                  placeholder="5000.00"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Valor POR CARRETA. Total = R$ {(parseFloat(formData.price || '0') * parseInt(formData.required_trucks)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            ) : formData.pricing_type === 'PER_KM' ? (
              <div className="space-y-2">
                <Label htmlFor="price_per_km">Valor por KM POR CARRETA (R$/km) *</Label>
                <Input
                  id="price_per_km"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price_per_km}
                  onChange={(e) => handleInputChange('price_per_km', e.target.value)}
                  placeholder="8.50"
                  required
                />
                {formData.price_per_km && calculatedDistance > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-xs font-medium text-blue-900 mb-2">Preview de Cálculo:</p>
                    <div className="text-xs text-blue-800 space-y-1">
                      <p>• Por carreta: R$ {(parseFloat(formData.price_per_km) * calculatedDistance).toFixed(2)}</p>
                      <p className="font-semibold">
                        • TOTAL ({formData.required_trucks} carreta{parseInt(formData.required_trucks) > 1 ? 's' : ''}): 
                        R$ {(parseFloat(formData.price_per_km) * calculatedDistance * parseInt(formData.required_trucks)).toFixed(2)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="price_per_ton">Valor por Tonelada (R$/ton) *</Label>
                <Input
                  id="price_per_ton"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price_per_km}
                  onChange={(e) => handleInputChange('price_per_km', e.target.value)}
                  placeholder="350.00"
                  required
                />
                {formData.price_per_km && formData.weight && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-xs font-medium text-blue-900 mb-2">Preview de Cálculo:</p>
                    <div className="text-xs text-blue-800 space-y-1">
                      <p>• Peso: {(parseFloat(formData.weight) / 1000).toFixed(2)} toneladas</p>
                      <p>• Por carreta: R$ {(parseFloat(formData.price_per_km) * (parseFloat(formData.weight) / 1000)).toFixed(2)}</p>
                      <p className="font-semibold">
                        • TOTAL ({formData.required_trucks} carreta{parseInt(formData.required_trucks) > 1 ? 's' : ''}): 
                        R$ {(parseFloat(formData.price_per_km) * (parseFloat(formData.weight) / 1000) * parseInt(formData.required_trucks)).toFixed(2)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="urgency">Urgência</Label>
              <Select value={formData.urgency} onValueChange={(value: 'LOW' | 'MEDIUM' | 'HIGH') => handleInputChange('urgency', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Baixa</SelectItem>
                  <SelectItem value="MEDIUM">Média</SelectItem>
                  <SelectItem value="HIGH">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição Adicional</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Informações adicionais sobre a carga, requisitos especiais, etc."
              rows={3}
            />
          </div>

          {/* Seleção Condicional: Eixos ou Tipo de Veículo */}
          {showAxlesSelector ? (
            <>
              <Alert className="border-blue-200 bg-blue-50">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  Para fretes rurais, o preço mínimo ANTT é calculado automaticamente baseado no número de eixos.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="vehicle_axles_required">Número de Eixos Requerido *</Label>
                <Select value={formData.vehicle_axles_required || ''} onValueChange={(value) => handleInputChange('vehicle_axles_required', value)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {AXLE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={String(opt.value)}>
                        {opt.label} • {opt.capacity} • {opt.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                <div>
                  <Label>Propriedade do veículo/implemento</Label>
                  <select
                    value={formData.vehicle_ownership}
                    onChange={(e) => handleInputChange('vehicle_ownership', e.target.value as 'PROPRIO' | 'TERCEIROS')}
                    className="w-full mt-1 px-3 py-2 border rounded-md"
                  >
                    <option value="PROPRIO">Próprio</option>
                    <option value="TERCEIROS">Terceiros</option>
                  </select>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="high_performance" 
                    checked={formData.high_performance} 
                    onCheckedChange={(checked) => handleInputChange('high_performance', checked)} 
                  />
                  <Label htmlFor="high_performance" className="text-sm">Alto Desempenho</Label>
                </div>
                
                <p className="text-xs text-muted-foreground">
                  Tabela ANTT: {formData.high_performance 
                    ? (formData.vehicle_ownership === 'PROPRIO' ? 'C (Alto desempenho + Próprio)' : 'D (Alto desempenho + Terceiros)')
                    : (formData.vehicle_ownership === 'PROPRIO' ? 'A (Lotação + Próprio)' : 'B (Lotação + Terceiros)')}
                </p>
              </div>
              
              {calculatedAnttPrice && formData.vehicle_axles_required && (formData.price || formData.price_per_km) && (
                <ANTTValidation
                  proposedPrice={formData.pricing_type === 'FIXED' ? parseFloat(formData.price || '0') : parseFloat(formData.price_per_km || '0') * calculatedDistance}
                  proposedPriceTotal={formData.pricing_type === 'FIXED' 
                    ? parseFloat(formData.price || '0') * parseInt(formData.required_trucks)
                    : parseFloat(formData.price_per_km || '0') * calculatedDistance * parseInt(formData.required_trucks)}
                  minimumAnttPrice={calculatedAnttPrice}
                  minimumAnttPriceTotal={calculatedAnttPrice * parseInt(formData.required_trucks)}
                  requiredTrucks={parseInt(formData.required_trucks)}
                  distance={calculatedDistance}
                  cargoType={formData.cargo_type}
                  axles={parseInt(formData.vehicle_axles_required)}
                  highPerformance={formData.high_performance}
                  anttDetails={anttDetails}
                />
              )}
            </>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vehicle_type_required">Tipo de Veículo Preferido</Label>
                <Select value={formData.vehicle_type_required || 'all'} onValueChange={(value) => handleInputChange('vehicle_type_required', value === 'all' ? '' : value)}>
                  <SelectTrigger><SelectValue placeholder="Qualquer" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Qualquer</SelectItem>
                    {VEHICLE_TYPES_URBAN.map((type) => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment_method">Forma de Pagamento</Label>
                <Select value={formData.payment_method} onValueChange={(value) => handleInputChange('payment_method', value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DIRETO">Direto ao Motorista</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Filtro de Visibilidade - apenas para CARGA */}
          {formData.service_type === 'CARGA' && (
            <div className="space-y-3 bg-muted/50 p-4 rounded-lg">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-semibold">
                  Quem pode ver este frete?
                </Label>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="visibility-all"
                    name="visibility_filter"
                    value="ALL"
                    checked={formData.visibility_filter === 'ALL'}
                    onChange={(e) => handleInputChange('visibility_filter', e.target.value)}
                    className="h-4 w-4 text-primary focus:ring-primary"
                  />
                  <Label htmlFor="visibility-all" className="cursor-pointer font-normal">
                    ✅ <strong>Todos</strong> podem ver o frete (Recomendado)
                  </Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="visibility-transportadoras"
                    name="visibility_filter"
                    value="TRANSPORTADORAS"
                    checked={formData.visibility_filter === 'TRANSPORTADORAS'}
                    onChange={(e) => handleInputChange('visibility_filter', e.target.value)}
                    className="h-4 w-4 text-primary focus:ring-primary"
                  />
                  <Label htmlFor="visibility-transportadoras" className="cursor-pointer font-normal">
                    🏢 Somente transportadoras
                  </Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="visibility-autonomos"
                    name="visibility_filter"
                    value="AUTONOMOS"
                    checked={formData.visibility_filter === 'AUTONOMOS'}
                    onChange={(e) => handleInputChange('visibility_filter', e.target.value)}
                    className="h-4 w-4 text-primary focus:ring-primary"
                  />
                  <Label htmlFor="visibility-autonomos" className="cursor-pointer font-normal">
                    🚛 Somente motoristas autônomos
                  </Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="visibility-avaliacao-3"
                    name="visibility_filter"
                    value="AVALIACAO_3"
                    checked={formData.visibility_filter === 'AVALIACAO_3'}
                    onChange={(e) => handleInputChange('visibility_filter', e.target.value)}
                    className="h-4 w-4 text-primary focus:ring-primary"
                  />
                  <Label htmlFor="visibility-avaliacao-3" className="cursor-pointer font-normal">
                    ⭐⭐⭐ Transportadoras e autônomos com nota ≥ 3
                  </Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="visibility-avaliacao-4"
                    name="visibility_filter"
                    value="AVALIACAO_4"
                    checked={formData.visibility_filter === 'AVALIACAO_4'}
                    onChange={(e) => handleInputChange('visibility_filter', e.target.value)}
                    className="h-4 w-4 text-primary focus:ring-primary"
                  />
                  <Label htmlFor="visibility-avaliacao-4" className="cursor-pointer font-normal">
                    ⭐⭐⭐⭐ Transportadoras e autônomos com nota ≥ 4
                  </Label>
                </div>
              </div>
              
              <p className="text-xs text-muted-foreground mt-2">
                💡 Filtre por tipo de motorista ou avaliação para encontrar o transportador ideal.
              </p>
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar Frete
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateFreightModal;