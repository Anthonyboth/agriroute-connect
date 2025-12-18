// Force rebuild: 2025-12-17T21:15:00Z - 5-step wizard modal
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
  visibility_type: 'ALL' as 'ALL' | 'TRANSPORTADORAS_ONLY' | 'RATING_MINIMUM',
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
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
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
    logWizardDebug('STEP_CHANGED', { currentStep, formData: { origin: formData.origin_city, destination: formData.destination_city } });
  }, [currentStep]);

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

  const handleInputChange = (field: string, value: any) => {
    logWizardDebug('INPUT_CHANGE', { field, valueType: typeof value, currentStep });
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleModalClose = () => {
    logWizardDebug('MODAL_CLOSE_TRIGGERED', { currentStep, hasExternalOnClose: !!externalOnClose });
    if (externalOnClose) {
      externalOnClose();
    } else {
      setOpen(false);
    }
  };

  const handleRestoreDraft = () => {
    const draftData = restoreDraft();
    if (draftData) {
      setFormData({ ...formDataInitial, ...draftData });
      toast.success('Rascunho restaurado');
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
        body: { origin, destination }
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
    logWizardDebug('SUBMIT_START', { guestMode, hasUserProfile: !!userProfile?.id });
    
    if (!guestMode && !userProfile?.id) {
      logWizardDebug('SUBMIT_BLOCKED_NO_USER', {});
      toast.error('Faça login como produtor para criar um frete.');
      return;
    }

    // Validação de campos obrigatórios
    if (!formData.pickup_date) {
      toast.error('Data de coleta é obrigatória');
      setCurrentStep(4);
      return;
    }

    if (!formData.delivery_date) {
      toast.error('Data de entrega é obrigatória');
      setCurrentStep(4);
      return;
    }

    if (!formData.origin_city || !formData.destination_city) {
      toast.error('Origem e destino são obrigatórios');
      setCurrentStep(1);
      return;
    }

    if (!formData.origin_neighborhood) {
      toast.error('Bairro/Fazenda de origem é obrigatório');
      setCurrentStep(2);
      return;
    }

    if (!formData.destination_neighborhood) {
      toast.error('Bairro/Fazenda de destino é obrigatório');
      setCurrentStep(2);
      return;
    }

    setLoading(true);

    try {
      const originCityId = formData.origin_city_id || await getCityId(formData.origin_city, formData.origin_state);
      const destinationCityId = formData.destination_city_id || await getCityId(formData.destination_city, formData.destination_state);

      const weight = parseFloat(formData.weight);
      const calculation = calculateFreightPrice({
        pricePerKm: formData.pricing_type === 'PER_KM' ? parseFloat(formData.price_per_km) : undefined,
        pricePerTon: formData.pricing_type === 'PER_TON' ? parseFloat(formData.price_per_km) : undefined,
        fixedPrice: formData.pricing_type === 'FIXED' ? parseFloat(formData.price) : undefined,
        distanceKm: calculatedDistance,
        weightKg: convertWeightToKg(weight),
        requiredTrucks: parseInt(formData.required_trucks),
        pricingType: formData.pricing_type,
        anttMinimumPrice: calculatedAnttPrice || 0
      });

      // Build full address strings
      const buildAddressString = (city: string, state: string, neighborhood: string, street: string, number: string, complement: string) => {
        let address = `${city}, ${state}`;
        if (neighborhood) address = `${neighborhood}, ${address}`;
        if (street) address = `${street}, ${address}`;
        if (number) address = `nº ${number}, ${address}`;
        if (complement) address = `${complement}, ${address}`;
        return address;
      };

      const freightData = {
        producer_id: guestMode ? null : userProfile.id,
        is_guest_freight: guestMode,
        cargo_type: formData.cargo_type,
        weight: convertWeightToKg(weight),
        origin_address: buildAddressString(formData.origin_city, formData.origin_state, formData.origin_neighborhood, formData.origin_street, formData.origin_number, formData.origin_complement),
        origin_city: formData.origin_city,
        origin_state: formData.origin_state,
        origin_city_id: originCityId,
        origin_lat: formData.origin_lat,
        origin_lng: formData.origin_lng,
        origin_neighborhood: formData.origin_neighborhood || null,
        origin_street: formData.origin_street || null,
        origin_number: formData.origin_number || null,
        origin_complement: formData.origin_complement || null,
        destination_address: buildAddressString(formData.destination_city, formData.destination_state, formData.destination_neighborhood, formData.destination_street, formData.destination_number, formData.destination_complement),
        destination_city: formData.destination_city,
        destination_state: formData.destination_state,
        destination_city_id: destinationCityId,
        destination_lat: formData.destination_lat,
        destination_lng: formData.destination_lng,
        destination_neighborhood: formData.destination_neighborhood || null,
        destination_street: formData.destination_street || null,
        destination_number: formData.destination_number || null,
        destination_complement: formData.destination_complement || null,
        distance_km: calculatedDistance,
        minimum_antt_price: calculatedAnttPrice,
        price: calculation.totalPrice,
        price_per_km: formData.pricing_type === 'PER_KM' ? parseFloat(formData.price_per_km) : null,
        required_trucks: parseInt(formData.required_trucks),
        accepted_trucks: 0,
        pickup_date: formData.pickup_date,
        delivery_date: formData.delivery_date,
        urgency: formData.urgency as 'LOW' | 'MEDIUM' | 'HIGH',
        description: formData.description || null,
        vehicle_type_required: formData.vehicle_type_required || null,
        vehicle_axles_required: formData.vehicle_axles_required ? parseInt(formData.vehicle_axles_required) : null,
        high_performance: formData.high_performance || false,
        status: 'OPEN' as const,
        visibility_type: formData.visibility_type || 'ALL',
        min_driver_rating: formData.visibility_type === 'RATING_MINIMUM' && formData.min_driver_rating 
          ? parseFloat(formData.min_driver_rating) 
          : null,
        // Guest freight contact info
        ...(guestMode && {
          guest_contact_name: formData.guest_name || null,
          guest_contact_phone: formData.guest_phone || null,
          guest_contact_email: formData.guest_email || null,
          guest_contact_document: formData.guest_document || null
        })
      };

      const { data: insertedFreight, error } = await supabase
        .from('freights')
        .insert([freightData])
        .select('id')
        .single();

      if (error) throw error;

      // Trigger spatial matching
      if (insertedFreight?.id) {
        try {
          await supabase.functions.invoke('spatial-freight-matching', {
            body: { freight_id: insertedFreight.id, notify_drivers: true }
          });
        } catch (matchingError) {
          console.error('Spatial matching error:', matchingError);
        }
      }

      toast.success(guestMode 
        ? 'Solicitação enviada! Motoristas da região serão notificados.' 
        : 'Frete criado com sucesso!');
      
      clearDraft();
      handleModalClose();
      setFormData({ ...formDataInitial });
      setCurrentStep(1);
      onFreightCreated();
    } catch (error: any) {
      console.error('Error creating freight:', error);
      
      if (error?.message?.includes('delivery_date')) {
        toast.error('Data de entrega é obrigatória');
        setCurrentStep(4);
      } else if (error?.message?.includes('pickup_date')) {
        toast.error('Data de coleta é obrigatória');
        setCurrentStep(4);
      } else if (error?.code === '23502') {
        toast.error('Preencha todos os campos obrigatórios');
        setCurrentStep(4);
      } else {
        toast.error('Erro ao criar frete. Verifique os dados e tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[85vh]">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">{guestMode ? 'Solicitar Frete' : 'Criar Novo Frete'}</h2>
            <p className="text-sm text-muted-foreground">Preencha os dados em 5 etapas simples</p>
          </div>
        </div>

        {!guestMode && userProfile?.role === 'PRODUTOR' && (
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

      {/* Draft Alert */}
      {!guestMode && hasDraft && !initialData && currentStep === 1 && (
        <Alert className="mx-4 mt-2">
          <Info className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <div>
              <strong>Rascunho encontrado</strong>
              <p className="text-xs text-muted-foreground mt-1">
                Salvo {lastSaved && format(lastSaved, "d 'de' MMM 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
            <Button type="button" size="sm" variant="default" onClick={handleRestoreDraft}>
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Restaurar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Step Content */}
      <div className="overflow-y-auto flex-1 p-4">
        {currentStep === 1 && (
          <FreightWizardStep1
            formData={formData}
            onInputChange={handleInputChange}
            onNext={handleStep1Next}
            guestMode={guestMode}
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
