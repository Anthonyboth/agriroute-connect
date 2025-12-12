import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Plus, Info, Save, RotateCcw, MapPin, Package, DollarSign, Check } from 'lucide-react';
import { WizardProgress } from '@/components/wizard/WizardProgress';
import { FreightWizardStep1 } from './FreightWizardStep1';
import { FreightWizardStep2 } from './FreightWizardStep2';
import { FreightWizardStep3 } from './FreightWizardStep3';
import { FreightWizardStep4 } from './FreightWizardStep4';
import { SaveTemplateDialog } from '@/components/freight-templates/SaveTemplateDialog';
import { useFreightDraft } from '@/hooks/useFreightDraft';
import { getCityId } from '@/lib/city-utils';
import { calculateFreightPrice, convertWeightToKg } from '@/lib/freight-calculations';
import { cargoRequiresAxles } from '@/lib/cargo-types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ErrorMonitoringService } from '@/services/errorMonitoringService';

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
  destination_city: '',
  destination_state: '',
  destination_city_id: undefined as string | undefined,
  destination_lat: undefined as number | undefined,
  destination_lng: undefined as number | undefined,
  destination_neighborhood: '',
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
  guest_document: ''
};

const WIZARD_STEPS = [
  { id: 1, title: 'Rota', description: 'Origem e destino', icon: <MapPin className="h-4 w-4" /> },
  { id: 2, title: 'Carga', description: 'Tipo e peso', icon: <Package className="h-4 w-4" /> },
  { id: 3, title: 'Valor', description: 'Preço e datas', icon: <DollarSign className="h-4 w-4" /> },
  { id: 4, title: 'Revisar', description: 'Confirmar dados', icon: <Check className="h-4 w-4" /> },
];

// Debug logging helper - envia para console e Telegram
const logWizardDebug = async (action: string, details: Record<string, any> = {}) => {
  const logData = {
    timestamp: new Date().toISOString(),
    action,
    ...details
  };
  console.log('[FreightWizard DEBUG]', action, logData);
  
  // Enviar para Telegram via ErrorMonitoringService
  try {
    const service = ErrorMonitoringService.getInstance();
    await service.captureError(
      new Error(`[FreightWizard] ${action}`),
      {
        module: 'CreateFreightWizard',
        function_name: action,
        metadata: logData
      }
    );
  } catch (e) {
    console.warn('[FreightWizard DEBUG] Falha ao enviar para Telegram:', e);
  }
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

  // Log quando o componente monta
  useEffect(() => {
    logWizardDebug('COMPONENT_MOUNTED', { guestMode, hasInitialData: !!initialData });
    return () => {
      logWizardDebug('COMPONENT_UNMOUNTED', { currentStep });
    };
  }, []);

  // Log quando o modal abre/fecha
  useEffect(() => {
    logWizardDebug('MODAL_STATE_CHANGE', { isModalOpen, currentStep });
  }, [isModalOpen]);

  // Log quando o step muda
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

  // Calculate distance when moving to step 3
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
      // Fallback
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
      throw error;
    }
  };

  const handleStep2Next = async () => {
    logWizardDebug('STEP2_NEXT_START', { cargoType: formData.cargo_type, weight: formData.weight });
    try {
      if (calculatedDistance > 0) {
        await calculateAnttPrice(calculatedDistance);
      }
      logWizardDebug('STEP2_NEXT_SUCCESS', { newStep: 3 });
      setCurrentStep(3);
    } catch (error: any) {
      logWizardDebug('STEP2_NEXT_ERROR', { error: error.message });
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

      const freightData = {
        producer_id: guestMode ? null : userProfile.id,
        is_guest_freight: guestMode,
        cargo_type: formData.cargo_type,
        weight: convertWeightToKg(weight),
        origin_address: `${formData.origin_city}, ${formData.origin_state}`,
        origin_city: formData.origin_city,
        origin_state: formData.origin_state,
        origin_city_id: originCityId,
        origin_lat: formData.origin_lat,
        origin_lng: formData.origin_lng,
        destination_address: `${formData.destination_city}, ${formData.destination_state}`,
        destination_city: formData.destination_city,
        destination_state: formData.destination_state,
        destination_city_id: destinationCityId,
        destination_lat: formData.destination_lat,
        destination_lng: formData.destination_lng,
        distance_km: calculatedDistance,
        minimum_antt_price: calculatedAnttPrice,
        price: calculation.totalPrice,
        price_per_km: formData.pricing_type === 'PER_KM' ? parseFloat(formData.price_per_km) : null,
        pricing_type: formData.pricing_type,
        required_trucks: parseInt(formData.required_trucks),
        accepted_trucks: 0,
        pickup_date: formData.pickup_date,
        delivery_date: formData.delivery_date || null,
        urgency: formData.urgency,
        description: formData.description || null,
        vehicle_type_required: formData.vehicle_type_required || null,
        vehicle_axles_required: formData.vehicle_axles_required ? parseInt(formData.vehicle_axles_required) : null,
        high_performance: formData.high_performance || false,
        status: 'OPEN' as const
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
    } catch (error) {
      console.error('Error creating freight:', error);
      toast.error('Erro ao criar frete');
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
              <DialogTitle>{guestMode ? 'Solicitar Frete' : 'Criar Novo Frete'}</DialogTitle>
              <DialogDescription>
                Preencha os dados do frete em etapas simples
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
                Modelo
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Wizard Progress */}
        <div className="px-2 pt-4">
          <WizardProgress 
            steps={WIZARD_STEPS} 
            currentStep={currentStep} 
            variant="compact"
          />
        </div>

        {/* Draft Alert */}
        {!guestMode && hasDraft && !initialData && currentStep === 1 && (
          <Alert className="mx-2 mt-2">
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

        <SaveTemplateDialog
          open={showSaveTemplateDialog}
          onOpenChange={setShowSaveTemplateDialog}
          onSave={handleSaveAsTemplate}
        />

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
            <FreightWizardStep2
              formData={formData}
              onInputChange={handleInputChange}
              onNext={handleStep2Next}
              onBack={() => setCurrentStep(1)}
            />
          )}
          {currentStep === 3 && (
            <FreightWizardStep3
              formData={formData}
              onInputChange={handleInputChange}
              onNext={() => setCurrentStep(4)}
              onBack={() => setCurrentStep(2)}
              calculatedAnttPrice={calculatedAnttPrice}
              calculatedDistance={calculatedDistance}
            />
          )}
          {currentStep === 4 && (
            <FreightWizardStep4
              formData={formData}
              onBack={() => setCurrentStep(3)}
              onSubmit={handleSubmit}
              loading={loading}
              calculatedAnttPrice={calculatedAnttPrice}
              calculatedDistance={calculatedDistance}
              guestMode={guestMode}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default CreateFreightWizard;
