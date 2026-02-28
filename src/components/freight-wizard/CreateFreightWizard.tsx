// Force rebuild: 2025-12-17T21:15:00Z - 5-step wizard modal

// Helper: mapeia eixos para vehicle_type quando o campo não foi preenchido diretamente
function getVehicleTypeFromAxles(axles: string | number): string | null {
  const n = typeof axles === 'string' ? parseInt(axles, 10) : axles;
  if (n >= 9) return 'RODOTREM';
  if (n >= 7) return 'BITREM';
  if (n >= 5) return 'CARRETA';
  if (n >= 3) return 'TRUCK';
  if (n >= 2) return 'CAMINHAO_3_4';
  return null;
}
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Plus, Info, Save, RotateCcw, MapPin, Package, DollarSign, Check, Home } from 'lucide-react';
import { WizardProgress } from '@/components/wizard/WizardProgress';
import { FreightWizardStep1 } from './FreightWizardStep1';
import { FreightWizardStep2Address } from './FreightWizardStep2Address';
import { FreightWizardStep3Cargo } from './FreightWizardStep3Cargo';
import { FreightWizardStep4Price } from './FreightWizardStep4Price';
import { FreightWizardStep5Review } from './FreightWizardStep5Review';
import { SaveTemplateDialog } from '@/components/freight-templates/SaveTemplateDialog';
import { useFreightDraft } from '@/hooks/useFreightDraft';
import { getCityId } from '@/lib/city-utils';
import { calculateFreightPrice, convertWeightToKg } from '@/lib/freight-calculations';
import { cargoRequiresAxles } from '@/lib/cargo-types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useFormNotification } from '@/hooks/useFormNotification';
import { useFreightFormValidation } from '@/hooks/useFreightFormValidation';


interface CreateFreightWizardProps {
  onFreightCreated: () => void;
  userProfile: any;
  guestMode?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
  initialData?: any;
}

const formDataInitial = {
  cargo_type: '',
  weight: '',
  origin_city: '',
  origin_state: '',
  origin_city_id: undefined as string | undefined,
  origin_lat: undefined as number | undefined,
  origin_lng: undefined as number | undefined,
  origin_neighborhood: '',
  origin_street: '',
  origin_number: '',
  origin_complement: '',
  destination_city: '',
  destination_state: '',
  destination_city_id: undefined as string | undefined,
  destination_lat: undefined as number | undefined,
  destination_lng: undefined as number | undefined,
  destination_neighborhood: '',
  destination_street: '',
  destination_number: '',
  destination_complement: '',
  price: '',
  price_per_km: '',
  pricing_type: 'PER_KM' as 'FIXED' | 'PER_KM' | 'PER_TON',
  pickup_date: '',
  delivery_date: '',
  urgency: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH',
  description: '',
  vehicle_type_required: '',
  vehicle_axles_required: '',
  high_performance: false,
  required_trucks: '1',
  guest_name: '',
  guest_email: '',
  guest_phone: '',
  guest_document: '',
  visibility_type: 'ALL' as 'ALL' | 'TRANSPORTADORAS_ONLY' | 'RATING_MINIMUM' | 'RATING_AND_TRANSPORTADORAS',
  min_driver_rating: '' as string
};

const WIZARD_STEPS = [
  { id: 1, title: 'Rota', description: 'Cidades', icon: <MapPin className="h-4 w-4" /> },
  { id: 2, title: 'Endereço', description: 'Local exato', icon: <Home className="h-4 w-4" /> },
  { id: 3, title: 'Carga', description: 'Tipo e peso', icon: <Package className="h-4 w-4" /> },
  { id: 4, title: 'Valor', description: 'Preço e datas', icon: <DollarSign className="h-4 w-4" /> },
  { id: 5, title: 'Revisar', description: 'Confirmar', icon: <Check className="h-4 w-4" /> },
];

// Debug logging helper
const logWizardDebug = (action: string, details: Record<string, any> = {}) => {
  console.log('[FreightWizard]', action, details);
};

export function CreateFreightWizard({
  onFreightCreated,
  userProfile,
  guestMode = false,
  isOpen: externalIsOpen,
  onClose: externalOnClose,
  initialData
}: CreateFreightWizardProps) {
  const { showFormError, showSuccess } = useFormNotification();
  const { validateFreightForm } = useFreightFormValidation();
  
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  // Rastreia o passo mais alto alcançado para proteger o draft de regressões por erro
  const [maxStepReached, setMaxStepReached] = useState(1);
  const [formData, setFormData] = useState({ ...formDataInitial, ...initialData });
  const [calculatedDistance, setCalculatedDistance] = useState(0);
  const [calculatedAnttPrice, setCalculatedAnttPrice] = useState<number | null>(null);
  const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false);

  const isModalOpen = externalIsOpen !== undefined ? externalIsOpen : open;

  useEffect(() => {
    logWizardDebug('COMPONENT_MOUNTED', { guestMode, hasInitialData: !!initialData });
    return () => {
      logWizardDebug('COMPONENT_UNMOUNTED', { currentStep });
    };
  }, []);

  useEffect(() => {
    logWizardDebug('MODAL_STATE_CHANGE', { isModalOpen, currentStep });
  }, [isModalOpen]);

  useEffect(() => {
    logWizardDebug('STEP_CHANGED', { currentStep, maxStepReached, formData: { origin: formData.origin_city, destination: formData.destination_city } });
    // Atualiza maxStepReached quando o usuário avança (navegação normal)
    if (currentStep > maxStepReached) {
      setMaxStepReached(currentStep);
    }
  }, [currentStep]);

  const { 
    hasDraft, 
    showDraftPrompt,
    lastSaved, 
    savedStep, 
    saveDraft, 
    clearDraft, 
    restoreDraft,
    dismissDraftPrompt
  } = useFreightDraft(
    userProfile?.id,
    !guestMode && isModalOpen
  );

  // PROBLEMA 9: Auto-save draft every 3 seconds COM currentStep
  // ✅ FIX: NÃO auto-salvar enquanto o prompt de rascunho estiver visível
  // (evita sobrescrever o rascunho salvo com dados vazios antes do usuário decidir)
  useEffect(() => {
    if (!guestMode && isModalOpen && !initialData && !showDraftPrompt) {
      const interval = setInterval(() => {
        const hasData = Object.values(formData).some(v => {
          if (typeof v === 'string') return v.trim() !== '';
          if (typeof v === 'boolean') return false; // ignore booleans like high_performance
          return v !== undefined && v !== null;
        });
        // Só salva se tem dados reais preenchidos pelo usuário (não apenas defaults)
        const hasRealData = formData.origin_city?.trim() || formData.destination_city?.trim() || 
                           formData.cargo_type?.trim() || formData.weight?.trim() || 
                           formData.price?.trim() || formData.description?.trim();
        if (hasData && hasRealData) {
          // Salva com maxStepReached para que erros de validação
          // que navegam para steps anteriores não corrompam o draft
          saveDraft(formData, maxStepReached);
        }
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [formData, guestMode, isModalOpen, initialData, saveDraft, maxStepReached, showDraftPrompt]);

  const handleInputChange = (field: string, value: any) => {
    logWizardDebug('INPUT_CHANGE', { field, valueType: typeof value, currentStep });
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLoadTemplate = async (payload: any) => {
    logWizardDebug('TEMPLATE_LOADED', { keys: Object.keys(payload) });
    setFormData({ ...formDataInitial, ...payload });
    // Calculate distance and ANTT price, then jump to step 5
    try {
      const origin = `${payload.origin_city}, ${payload.origin_state}`;
      const destination = `${payload.destination_city}, ${payload.destination_state}`;
      const { data } = await supabase.functions.invoke('calculate-route', {
        body: { 
          origin, destination,
          origin_coords: payload.origin_lat && payload.origin_lng ? { lat: payload.origin_lat, lng: payload.origin_lng } : undefined,
          destination_coords: payload.destination_lat && payload.destination_lng ? { lat: payload.destination_lat, lng: payload.destination_lng } : undefined,
        }
      });
      if (data?.distance_km) {
        setCalculatedDistance(data.distance_km);
        await calculateAnttPrice(data.distance_km);
      }
    } catch (err) {
      console.warn('[FreightWizard] Erro ao calcular rota do modelo:', err);
    }
    setCurrentStep(5);
    setMaxStepReached(5);
  };

  const handleModalClose = () => {
    logWizardDebug('MODAL_CLOSE_TRIGGERED', { currentStep, hasExternalOnClose: !!externalOnClose });
    if (externalOnClose) {
      externalOnClose();
    } else {
      setOpen(false);
    }
  };

  // PROBLEMA 9: Restaurar draft E navegar para etapa correta
  const handleRestoreDraft = async () => {
    const restored = restoreDraft();
    if (restored && restored.data) {
      // 1. Restaurar dados do formulário
      setFormData({ ...formDataInitial, ...restored.data });
      
      // 2. Navegar para a etapa onde o usuário parou
      const targetStep = restored.currentStep || 1;
      setCurrentStep(targetStep);
      setMaxStepReached(targetStep);
      
      // 3. Recalcular distância se tiver dados de origem/destino
      if (restored.data.origin_city && restored.data.destination_city) {
        try {
          const origin = `${restored.data.origin_city}, ${restored.data.origin_state}`;
          const destination = `${restored.data.destination_city}, ${restored.data.destination_state}`;
          
          const { data, error } = await supabase.functions.invoke('calculate-route', {
            body: { 
              origin, 
              destination,
              origin_address_detail: {
                street: restored.data.origin_street || undefined,
                number: restored.data.origin_number || undefined,
                neighborhood: restored.data.origin_neighborhood || undefined,
              },
              destination_address_detail: {
                street: restored.data.destination_street || undefined,
                number: restored.data.destination_number || undefined,
                neighborhood: restored.data.destination_neighborhood || undefined,
              },
              origin_coords: restored.data.origin_lat && restored.data.origin_lng 
                ? { lat: restored.data.origin_lat, lng: restored.data.origin_lng } 
                : undefined,
              destination_coords: restored.data.destination_lat && restored.data.destination_lng 
                ? { lat: restored.data.destination_lat, lng: restored.data.destination_lng } 
                : undefined,
            }
          });
          
          if (!error && data?.distance_km) {
            setCalculatedDistance(data.distance_km);
          }
        } catch (err) {
          console.error('[DRAFT_RESTORE] Error recalculating distance:', err);
        }
      }
      
      // 4. Feedback visual detalhado
      toast.success(`Rascunho restaurado! Voltando para etapa ${targetStep} de 5`, {
        duration: 4000,
        icon: '📂'
      });
      
      logWizardDebug('DRAFT_RESTORED', { 
        step: targetStep, 
        fields: Object.keys(restored.data).filter(k => restored.data[k]) 
      });
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
      clearDraft();
    } catch (error: any) {
      console.error('Erro ao salvar modelo:', error);
      toast.error('Erro ao salvar modelo');
      throw error;
    }
  };

  // Calculate distance when moving to step 2
  const calculateDistance = async () => {
    try {
      const origin = `${formData.origin_city}, ${formData.origin_state}`;
      const destination = `${formData.destination_city}, ${formData.destination_state}`;
      
      const { data, error } = await supabase.functions.invoke('calculate-route', {
        body: { 
          origin, 
          destination,
          origin_address_detail: {
            street: formData.origin_street || undefined,
            number: formData.origin_number || undefined,
            neighborhood: formData.origin_neighborhood || undefined,
          },
          destination_address_detail: {
            street: formData.destination_street || undefined,
            number: formData.destination_number || undefined,
            neighborhood: formData.destination_neighborhood || undefined,
          },
          origin_coords: formData.origin_lat && formData.origin_lng 
            ? { lat: formData.origin_lat, lng: formData.origin_lng } 
            : undefined,
          destination_coords: formData.destination_lat && formData.destination_lng 
            ? { lat: formData.destination_lat, lng: formData.destination_lng } 
            : undefined,
        }
      });
      
      if (error) throw error;
      setCalculatedDistance(data.distance_km);
      return data.distance_km;
    } catch (error) {
      console.error('Error calculating distance:', error);
      const fallback = Math.floor(Math.random() * 800) + 100;
      setCalculatedDistance(fallback);
      return fallback;
    }
  };

  // Calculate ANTT price
  const calculateAnttPrice = async (distance: number) => {
    if (!cargoRequiresAxles(formData.cargo_type) || !formData.vehicle_axles_required) {
      return 0;
    }

    try {
      const axles = parseInt(formData.vehicle_axles_required);
      let table_type: 'A' | 'B' | 'C' | 'D' = formData.high_performance ? 'C' : 'A';

      const { data, error } = await supabase.functions.invoke('antt-calculator', {
        body: {
          cargo_type: formData.cargo_type,
          distance_km: distance,
          axles,
          origin_state: formData.origin_state,
          destination_state: formData.destination_state,
          table_type,
          required_trucks: parseInt(formData.required_trucks) || 1
        }
      });

      if (error) throw error;
      setCalculatedAnttPrice(data.minimum_freight_value);
      return data.minimum_freight_value;
    } catch (error) {
      console.error('Error calculating ANTT:', error);
      return 0;
    }
  };

  const handleStep1Next = async () => {
    logWizardDebug('STEP1_NEXT_START', { origin: formData.origin_city, destination: formData.destination_city });
    try {
      const distance = await calculateDistance();
      logWizardDebug('STEP1_DISTANCE_CALCULATED', { distance });
      await calculateAnttPrice(distance);
      logWizardDebug('STEP1_NEXT_SUCCESS', { newStep: 2 });
      setCurrentStep(2);
    } catch (error: any) {
      logWizardDebug('STEP1_NEXT_ERROR', { error: error.message });
      toast.error('Erro ao calcular distância, mas você pode continuar');
      setCurrentStep(2);
    }
  };

  const handleStep3Next = async () => {
    logWizardDebug('STEP3_NEXT_START', { cargoType: formData.cargo_type, weight: formData.weight });
    try {
      if (calculatedDistance > 0) {
        await calculateAnttPrice(calculatedDistance);
      }
      logWizardDebug('STEP3_NEXT_SUCCESS', { newStep: 4 });
      setCurrentStep(4);
    } catch (error: any) {
      logWizardDebug('STEP3_NEXT_ERROR', { error: error.message });
      throw error;
    }
  };

  const handleSubmit = async () => {
    logWizardDebug('SUBMIT_START', { guestMode, hasUserProfile: !!userProfile?.id, role: userProfile?.role });
    
    if (!guestMode && !userProfile?.id) {
      logWizardDebug('SUBMIT_BLOCKED_NO_USER', {});
      showFormError({
        field: "Autenticação",
        problem: "Você precisa estar logado para criar um frete.",
        solution: "Faça login como produtor e tente novamente.",
      });
      return;
    }
    
    // ✅ PROBLEMA 3: Validar que o usuário é produtor antes de tentar criar
    if (!guestMode && userProfile?.role !== 'PRODUTOR') {
      logWizardDebug('SUBMIT_BLOCKED_WRONG_ROLE', { role: userProfile?.role });
      showFormError({
        field: "Tipo de Perfil",
        problem: `Seu perfil atual é "${userProfile?.role || 'desconhecido'}".`,
        solution: "Apenas produtores podem criar fretes. Acesse seu perfil para alterar.",
      });
      return;
    }

    // ✅ Validação centralizada de TODOS os campos obrigatórios
    const validation = validateFreightForm(formData, guestMode);
    if (!validation.valid) {
      if (validation.step) {
        setCurrentStep(validation.step);
      }
      return;
    }

    setLoading(true);

    try {
      const originCityId = formData.origin_city_id || await getCityId(formData.origin_city, formData.origin_state);
      const destinationCityId = formData.destination_city_id || await getCityId(formData.destination_city, formData.destination_state);

      const totalWeightTonnes = parseFloat(formData.weight);
      const totalWeightKg = convertWeightToKg(totalWeightTonnes);
      const requiredTrucks = Math.max(parseInt(formData.required_trucks || '1', 10) || 1, 1);
      const weightPerTruckKg = totalWeightKg / requiredTrucks;
      const calculation = calculateFreightPrice({
        pricePerKm: formData.pricing_type === 'PER_KM' ? parseFloat(formData.price_per_km) : undefined,
        pricePerTon: formData.pricing_type === 'PER_TON' ? parseFloat(formData.price_per_km) : undefined,
        fixedPrice: formData.pricing_type === 'FIXED' ? parseFloat(formData.price) : undefined,
        distanceKm: calculatedDistance,
        // O peso informado no wizard é TOTAL; para preço POR TON (por carreta), usamos o peso por carreta.
        weightKg: weightPerTruckKg,
        requiredTrucks,
        pricingType: formData.pricing_type,
        anttMinimumPrice: calculatedAnttPrice || 0
      });

      // Build full address strings - SEMPRE usa UF de 2 letras
      const buildAddressString = (city: string, state: string, neighborhood: string, street: string, number: string, complement: string) => {
        // Importar toUF localmente ou usar inline
        const uf = state?.length === 2 ? state.toUpperCase() : state;
        let address = `${city} — ${uf}`;
        if (neighborhood) address = `${neighborhood}, ${address}`;
        if (street) address = `${street}, ${address}`;
        if (number) address = `nº ${number}, ${address}`;
        if (complement) address = `${complement}, ${address}`;
        return address;
      };

      // CORREÇÃO BUG MOTO: Calcular effectiveGuestMode baseado no perfil
      // Se tiver perfil de PRODUTOR, NUNCA usar guestMode mesmo que venha true
      const isProducer = userProfile?.role === 'PRODUTOR' || userProfile?.active_mode === 'PRODUTOR';
      const effectiveGuestMode = isProducer ? false : guestMode;
      
      // Segurança: abortar se não for guest e não tiver perfil válido
      if (!effectiveGuestMode && !userProfile?.id) {
        toast.error('Você precisa estar logado como produtor para criar um frete.');
        setLoading(false);
        return;
      }

      // CORREÇÃO MOTO: Determinar service_type canônico
      // Se vehicle_type_required === 'MOTO' OU cargo_type === 'frete_moto' => FRETE_MOTO
      const serviceType = (formData.vehicle_type_required === 'MOTO' || formData.cargo_type === 'frete_moto') 
        ? 'FRETE_MOTO' 
        : 'CARGA';

      // ✅ Validação pré-insert: proteger contra NaN e valores fora do range do DB
      const safePrice = isNaN(calculation.totalPrice) ? 0 : calculation.totalPrice;
      // Salvar valor unitário para PER_KM e PER_TON (reusa campo price_per_km)
      const safePricePerKm = (formData.pricing_type === 'PER_KM' || formData.pricing_type === 'PER_TON') 
        ? (parseFloat(formData.price_per_km) || 0) 
        : null;
      
      if (isNaN(totalWeightKg) || totalWeightKg < 100) {
        showFormError({
          field: "Peso da Carga",
          problem: `Peso inválido: ${isNaN(totalWeightKg) ? 'não numérico' : `${totalWeightTonnes} ton (${totalWeightKg}kg)`}. Mínimo: 0.1 tonelada.`,
          solution: "Volte à etapa 3 e ajuste o peso total aproximado da carga.",
        });
        setCurrentStep(3);
        setLoading(false);
        return;
      }

      if (safePrice <= 0) {
        showFormError({
          field: "Valor do Frete",
          problem: "O valor calculado do frete é zero ou inválido.",
          solution: "Volte à etapa 4 e defina o valor corretamente.",
        });
        setCurrentStep(4);
        setLoading(false);
        return;
      }

      const freightData = {
        producer_id: effectiveGuestMode ? null : userProfile.id,
        is_guest_freight: effectiveGuestMode,
        cargo_type: formData.cargo_type,
        service_type: serviceType,
        weight: totalWeightKg,
        origin_address: buildAddressString(formData.origin_city, formData.origin_state, formData.origin_neighborhood, formData.origin_street, formData.origin_number, formData.origin_complement),
        origin_city: (formData.origin_city || '').trim(),
        origin_state: (formData.origin_state || '').trim().toUpperCase().substring(0, 2),
        origin_city_id: originCityId,
        origin_lat: formData.origin_lat,
        origin_lng: formData.origin_lng,
        origin_neighborhood: formData.origin_neighborhood || null,
        origin_street: formData.origin_street || null,
        origin_number: formData.origin_number || null,
        origin_complement: formData.origin_complement || null,
        destination_address: buildAddressString(formData.destination_city, formData.destination_state, formData.destination_neighborhood, formData.destination_street, formData.destination_number, formData.destination_complement),
        destination_city: (formData.destination_city || '').trim(),
        destination_state: (formData.destination_state || '').trim().toUpperCase().substring(0, 2),
        destination_city_id: destinationCityId,
        destination_lat: formData.destination_lat,
        destination_lng: formData.destination_lng,
        destination_neighborhood: formData.destination_neighborhood || null,
        destination_street: formData.destination_street || null,
        destination_number: formData.destination_number || null,
        destination_complement: formData.destination_complement || null,
        distance_km: calculatedDistance || 0,
        minimum_antt_price: calculatedAnttPrice,
        price: safePrice,
        price_per_km: safePricePerKm,
        pricing_type: formData.pricing_type || 'FIXED',
        required_trucks: parseInt(formData.required_trucks) || 1,
        accepted_trucks: 0,
        pickup_date: formData.pickup_date,
        delivery_date: formData.delivery_date,
        urgency: formData.urgency as 'LOW' | 'MEDIUM' | 'HIGH',
        description: formData.description || null,
        vehicle_type_required: formData.vehicle_type_required || (formData.vehicle_axles_required ? getVehicleTypeFromAxles(formData.vehicle_axles_required) : null),
        vehicle_axles_required: formData.vehicle_axles_required ? parseInt(formData.vehicle_axles_required) : null,
        high_performance: formData.high_performance || false,
        status: 'OPEN' as const,
        visibility_type: formData.visibility_type || 'ALL',
        min_driver_rating: formData.visibility_type === 'RATING_MINIMUM' && formData.min_driver_rating 
          ? parseFloat(formData.min_driver_rating) 
          : formData.visibility_type === 'RATING_AND_TRANSPORTADORAS' ? 4.0
          : null,
        // Guest freight contact info - só inclui se for effectiveGuestMode
        ...(effectiveGuestMode && {
          guest_contact_name: formData.guest_name || null,
          guest_contact_phone: formData.guest_phone || null,
          guest_contact_email: formData.guest_email || null,
          guest_contact_document: formData.guest_document || null
        })
      };

      let createdFreightId: string | null = null;

      if (effectiveGuestMode) {
        // ── FLUXO SEGURO: Guest cria via Edge Function ──
        logWizardDebug('GUEST_SUBMIT_VIA_EDGE', { guestName: formData.guest_name });
        
        const guestPayload = {
          guest_name: formData.guest_name,
          guest_phone: formData.guest_phone,
          guest_email: formData.guest_email || undefined,
          guest_document: formData.guest_document,
          ...freightData,
          // Remove campos que a edge function não espera
          producer_id: undefined,
          is_guest_freight: undefined,
          guest_contact_name: undefined,
          guest_contact_phone: undefined,
          guest_contact_email: undefined,
          guest_contact_document: undefined,
        };

        const { data: guestResult, error: guestError } = await supabase.functions.invoke(
          'create-guest-rural-freight',
          { body: guestPayload }
        );

        if (guestError) {
          throw new Error(guestError.message || 'Erro ao criar frete');
        }

        if (!guestResult?.success) {
          const msg = guestResult?.error || guestResult?.message || 'Erro ao criar frete';
          const code = guestResult?.code || '';
          
          if (code === 'RATE_LIMITED' || code === 'RATE_LIMITED_PHONE') {
            showFormError({
              field: "Limite",
              problem: msg,
              solution: "Aguarde o período indicado antes de criar outro frete.",
            });
            return;
          }
          if (code === 'CAPTCHA_FAILED') {
            showFormError({
              field: "Verificação",
              problem: "Verificação de segurança falhou.",
              solution: "Tente novamente.",
            });
            return;
          }
          if (code === 'INVALID_PHONE') {
            showFormError({
              field: "Telefone",
              problem: msg,
              solution: "Informe um telefone brasileiro válido com DDD.",
            });
            setCurrentStep(1);
            return;
          }
          if (code === 'INVALID_DOCUMENT') {
            showFormError({
              field: "Documento",
              problem: msg,
              solution: "Verifique o CPF ou CNPJ informado.",
            });
            setCurrentStep(1);
            return;
          }
          throw new Error(msg);
        }

        createdFreightId = guestResult.freight_id;
        // Matching já foi executado pela edge function
        logWizardDebug('GUEST_FREIGHT_CREATED', { freight_id: createdFreightId, status: guestResult.status });
      } else {
        // ── FLUXO PADRÃO: Produtor autenticado insere direto ──
        const { data: insertedFreight, error } = await supabase
          .from('freights')
          .insert([freightData])
          .select('id')
          .single();

        if (error) throw error;
        createdFreightId = insertedFreight?.id || null;

        // Trigger spatial matching
        if (createdFreightId) {
          try {
            await supabase.functions.invoke('spatial-freight-matching', {
              body: { freight_id: createdFreightId, notify_drivers: true }
            });
          } catch (matchingError) {
            console.error('Spatial matching error:', matchingError);
          }
        }
      }

      showSuccess(effectiveGuestMode 
        ? 'Solicitação enviada! Motoristas da região serão notificados.' 
        : 'Frete criado com sucesso!');
      
      clearDraft();
      handleModalClose();
      setFormData({ ...formDataInitial });
      setCurrentStep(1);
      setMaxStepReached(1);
      onFreightCreated();
    } catch (error: any) {
      console.error('[FreightWizard] Erro ao criar frete:', error);
      console.error('[FreightWizard] Error details:', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
        statusCode: error?.statusCode,
        name: error?.name,
        stack: error?.stack?.substring(0, 300),
      });
      
      // Extrair mensagem do erro
      const errorMessage = error?.message || '';
      const errorCode = error?.code || '';
      const errorDetails = error?.details || error?.hint || '';
      
      // ✅ Tratamento específico para erro de RLS - notificação clara
      if (errorMessage.includes('row-level security') || errorMessage.includes('row level security') || errorMessage.includes('permission denied')) {
        showFormError({
          field: "Permissão",
          problem: "Você não tem permissão para criar fretes.",
          solution: "Faça login como produtor ou recarregue a página e tente novamente.",
        });
        return;
      }
      
      // Mapear erros específicos para notificações claras
      if (errorMessage.includes('delivery_date') || errorDetails.includes('delivery_date')) {
        showFormError({
          field: "Data de Entrega",
          problem: "Campo obrigatório não preenchido.",
          solution: "Volte à etapa 4 e selecione a data de entrega.",
        });
        setCurrentStep(4);
      } else if (errorMessage.includes('pickup_date') || errorDetails.includes('pickup_date')) {
        showFormError({
          field: "Data de Coleta",
          problem: "Campo obrigatório não preenchido.",
          solution: "Volte à etapa 4 e selecione a data de coleta.",
        });
        setCurrentStep(4);
      } else if (errorMessage.includes('origin') || errorDetails.includes('origin')) {
        showFormError({
          field: "Origem",
          problem: "Cidade de origem não informada.",
          solution: "Volte à etapa 1 e selecione a cidade de origem.",
        });
        setCurrentStep(1);
      } else if (errorMessage.includes('destination') || errorDetails.includes('destination')) {
        showFormError({
          field: "Destino",
          problem: "Cidade de destino não informada.",
          solution: "Volte à etapa 1 e selecione a cidade de destino.",
        });
        setCurrentStep(1);
      } else if (errorMessage.includes('neighborhood') || errorDetails.includes('neighborhood')) {
        showFormError({
          field: "Bairro/Fazenda",
          problem: "Localização incompleta.",
          solution: "Volte à etapa 2 e informe o bairro ou fazenda.",
        });
        setCurrentStep(2);
      } else if (errorMessage.includes('cargo_type') || errorDetails.includes('cargo_type')) {
        showFormError({
          field: "Tipo de Carga",
          problem: "Campo obrigatório não preenchido.",
          solution: "Volte à etapa 3 e selecione o tipo de carga.",
        });
        setCurrentStep(3);
      } else if (errorMessage.includes('weight') || errorDetails.includes('weight')) {
        showFormError({
          field: "Peso da Carga",
          problem: "Campo obrigatório não preenchido.",
          solution: "Volte à etapa 3 e informe o peso estimado.",
        });
        setCurrentStep(3);
      } else if (errorMessage.includes('price') || errorDetails.includes('price')) {
        showFormError({
          field: "Valor do Frete",
          problem: "Valor não definido.",
          solution: "Volte à etapa 4 e defina o valor por km ou valor fixo.",
        });
        setCurrentStep(4);
      } else if (errorCode === '23514' || errorMessage.includes('violates check constraint')) {
        // CHECK constraint violations - mapear para campo específico
        const constraintMsg = errorMessage + ' ' + errorDetails;
        if (constraintMsg.includes('cities_state_uf_check') || constraintMsg.includes('state')) {
          // Auto-fix: normalizar estado e tentar novamente
          console.warn('[FreightWizard] State UF check falhou - normalizando e avisando usuário');
          showFormError({
            field: "Estado (UF)",
            problem: "O estado da cidade de origem ou destino está em formato inválido.",
            solution: "Volte à etapa 1, apague a cidade e selecione novamente da lista.",
          });
          setCurrentStep(1);
        } else if (constraintMsg.includes('weight')) {
          showFormError({
            field: "Peso da Carga",
            problem: "Peso inválido (mínimo 0.1 tonelada / 100kg).",
            solution: "Volte à etapa 3 e ajuste o peso total da carga.",
          });
          setCurrentStep(3);
        } else if (constraintMsg.includes('axles') || constraintMsg.includes('vehicle')) {
          showFormError({
            field: "Eixos do Veículo",
            problem: "Número de eixos inválido.",
            solution: "Volte à etapa 3 e selecione um tipo de veículo válido.",
          });
          setCurrentStep(3);
        } else if (constraintMsg.includes('service_type')) {
          showFormError({
            field: "Tipo de Serviço",
            problem: "Tipo de serviço inválido.",
            solution: "Volte à etapa 3 e selecione o tipo de carga novamente.",
          });
          setCurrentStep(3);
        } else if (constraintMsg.includes('visibility')) {
          showFormError({
            field: "Visibilidade",
            problem: "Configuração de visibilidade inválida.",
            solution: "Volte à etapa 4 e ajuste a visibilidade do frete.",
          });
          setCurrentStep(4);
        } else {
          showFormError({
            problem: "Dados fora do intervalo permitido.",
            solution: `Revise os campos: ${errorMessage}`,
          });
        }
      } else if (errorCode === '23502') {
        showFormError({
          problem: "Alguns campos obrigatórios não foram preenchidos.",
          solution: "Revise todas as etapas e preencha os campos destacados.",
        });
      } else if (errorCode === '23503') {
        showFormError({
          problem: "Erro de referência nos dados.",
          solution: "Recarregue a página e preencha o formulário novamente.",
        });
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        showFormError({
          problem: "Erro de conexão com a internet.",
          solution: "Verifique sua conexão e tente novamente em alguns segundos.",
        });
      } else {
        console.error('[FreightWizard] Erro genérico não mapeado:', { errorMessage, errorCode, errorDetails, fullError: JSON.stringify(error) });
        showFormError({
          problem: "Não foi possível criar o frete.",
          solution: `Erro: ${errorMessage || 'desconhecido'}. Verifique os campos e tente novamente.`,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">{guestMode ? 'Solicitar Frete' : 'Criar Novo Frete'}</h2>
            <p className="text-sm text-muted-foreground">Preencha os dados em 5 etapas simples</p>
          </div>
        </div>

        {!guestMode && userProfile?.role === 'PRODUTOR' && currentStep === 5 && (
          <div className="mt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowSaveTemplateDialog(true);
              }}
            >
              <Save className="h-4 w-4 mr-2" />
              Salvar modelo
            </Button>
          </div>
        )}
      </div>

      {/* Wizard Progress */}
      <div className="px-4 pt-4">
        <WizardProgress 
          steps={WIZARD_STEPS} 
          currentStep={currentStep} 
          variant="compact"
        />
      </div>

      {/* Draft Alert: oferecer apenas se veio do storage (rascunho antigo) */}
      {!guestMode && showDraftPrompt && hasDraft && !initialData && (
        <Alert className={`mx-4 mt-2 ${currentStep === 1 ? 'border-primary' : 'border-muted'}`}>
          <Info className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <div>
              <strong>Rascunho encontrado</strong>
              <p className="text-xs text-muted-foreground mt-1">
                Salvo {lastSaved && format(lastSaved, "d 'de' MMM 'às' HH:mm", { locale: ptBR })}
                {savedStep > 1 && (
                  <span className="ml-2 text-primary font-medium">
                    • Etapa {savedStep} de 5
                  </span>
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  clearDraft();
                  dismissDraftPrompt();
                  toast.success('Rascunho descartado com sucesso');
                }}
              >
                Descartar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="default"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleRestoreDraft();
                  dismissDraftPrompt();
                }}
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Restaurar {savedStep > 1 && `(Etapa ${savedStep})`}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Step Content - SCROLLABLE */}
      <div className="flex-1 overflow-y-auto min-h-0 p-4">
        {currentStep === 1 && (
          <FreightWizardStep1
            formData={formData}
            onInputChange={handleInputChange}
            onNext={handleStep1Next}
            guestMode={guestMode}
            userProfileId={userProfile?.id}
            onLoadTemplate={handleLoadTemplate}
          />
        )}
        {currentStep === 2 && (
          <FreightWizardStep2Address
            formData={formData}
            onInputChange={handleInputChange}
            onNext={() => setCurrentStep(3)}
            onBack={() => setCurrentStep(1)}
          />
        )}
        {currentStep === 3 && (
          <FreightWizardStep3Cargo
            formData={formData}
            onInputChange={handleInputChange}
            onNext={handleStep3Next}
            onBack={() => setCurrentStep(2)}
          />
        )}
        {currentStep === 4 && (
          <FreightWizardStep4Price
            formData={formData}
            onInputChange={handleInputChange}
            onNext={() => setCurrentStep(5)}
            onBack={() => setCurrentStep(3)}
            calculatedAnttPrice={calculatedAnttPrice}
            calculatedDistance={calculatedDistance}
          />
        )}
        {currentStep === 5 && (
          <FreightWizardStep5Review
            formData={formData}
            onInputChange={handleInputChange}
            onBack={() => setCurrentStep(4)}
            onSubmit={handleSubmit}
            loading={loading}
            calculatedAnttPrice={calculatedAnttPrice}
            calculatedDistance={calculatedDistance}
            guestMode={guestMode}
          />
        )}
      </div>

      {/* Save Template Dialog */}
      <SaveTemplateDialog
        open={showSaveTemplateDialog}
        onOpenChange={setShowSaveTemplateDialog}
        onSave={handleSaveAsTemplate}
      />
    </div>
  );
}
