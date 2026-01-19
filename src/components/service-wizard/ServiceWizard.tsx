import React, { useState, useCallback, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { WizardProgress } from "@/components/wizard/WizardProgress";
import { toast } from "sonner";
import { Step1ServiceType } from "./steps/Step1ServiceType";
import { Step2PersonalData } from "./steps/Step2PersonalData";
import { Step3Location } from "./steps/Step3Location";
import { Step4Details } from "./steps/Step4Details";
import { Step5Review } from "./steps/Step5Review";
import { ServiceFormData, ServiceType } from "./types";
import { getServiceConfig } from "./config";
import { supabase } from "@/integrations/supabase/client";
import { showErrorToast } from "@/lib/error-handler";
import { useAuth } from "@/hooks/useAuth";

interface ServiceWizardProps {
  serviceType: ServiceType;
  onClose: () => void;
  onSuccess?: () => void;
  // Para serviços do catálogo (agrícola/técnico)
  catalogServiceId?: string;
  catalogServiceLabel?: string;
  catalogServiceDescription?: string;
}

const createInitialFormData = (serviceType: ServiceType): ServiceFormData => ({
  serviceType,
  subServiceType: "",
  problemDescription: "",
  personal: {
    name: "",
    phone: "",
    email: "",
    document: "",
    profession: "",
  },
  origin: {
    cep: "",
    city: "",
    city_id: "",
    state: "",
    street: "",
    neighborhood: "",
    number: "",
    complement: "",
    reference: "",
    lat: undefined,
    lng: undefined,
    floor: "",
    hasElevator: false,
  },
  destination: {
    cep: "",
    city: "",
    city_id: "",
    state: "",
    street: "",
    neighborhood: "",
    number: "",
    complement: "",
    reference: "",
    lat: undefined,
    lng: undefined,
    floor: "",
    hasElevator: false,
  },
  urgency: "MEDIUM",
  preferredTime: "",
  cargo: {
    type: "",
    weight: "",
    weightUnit: "kg",
    dimensions: { length: "", width: "", height: "" },
    needsPackaging: false,
    needsHelper: false,
  },
  vehicle: {
    type: "",
    plate: "",
    situation: "",
  },
  mudanca: {
    type: "RESIDENCIAL",
    rooms: "",
    volume: "",
    additionalServices: [],
    specialItems: "",
    pickupDate: "",
    deliveryDate: "",
    preferredTime: "",
  },
  agricultural: {
    farmName: "",
    area: "",
    culture: "",
    accessInstructions: "",
  },
  technical: {
    equipmentType: "",
    brand: "",
    model: "",
    year: "",
    lastMaintenance: "",
  },
  additionalInfo: "",
});

export const ServiceWizard: React.FC<ServiceWizardProps> = ({
  serviceType,
  onClose,
  onSuccess,
  catalogServiceId,
  catalogServiceLabel,
  catalogServiceDescription,
}) => {
  const { profile } = useAuth();

  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<ServiceFormData>(() => createInitialFormData(serviceType));
  const [loading, setLoading] = useState(false);

  const config = useMemo(() => getServiceConfig(serviceType), [serviceType]);
  const totalSteps = config.steps.length;

  // ✅ Se serviceType mudar (ex: modal troca), reseta wizard corretamente
  useEffect(() => {
    setCurrentStep(1);
    setFormData(createInitialFormData(serviceType));
  }, [serviceType]);

  // Função para atualizar campos com suporte a paths aninhados
  const handleUpdate = useCallback((path: string, value: any) => {
    setFormData((prev) => {
      const newData: any = { ...prev };
      const keys = path.split(".");

      if (keys.length === 1) {
        newData[keys[0]] = value;
        return newData;
      }

      if (keys.length === 2) {
        const [parent, child] = keys;
        newData[parent] = {
          ...(newData[parent] || {}),
          [child]: value,
        };
        return newData;
      }

      if (keys.length === 3) {
        const [parent, child, grandchild] = keys;
        newData[parent] = {
          ...(newData[parent] || {}),
          [child]: {
            ...(newData[parent]?.[child] || {}),
            [grandchild]: value,
          },
        };
        return newData;
      }

      // Fallback: path mais profundo (seguro)
      let cursor = newData;
      for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i];
        cursor[k] = cursor[k] ?? {};
        cursor = cursor[k];
      }
      cursor[keys[keys.length - 1]] = value;

      return newData;
    });
  }, []);

  // Validação por etapa
  const validateStep = useCallback(
    (step: number): boolean => {
      switch (step) {
        case 1: {
          if (serviceType === "GUINCHO" && !formData.vehicle?.situation) {
            toast.error("Por favor, selecione a situação do veículo");
            return false;
          }
          if (
            (serviceType === "MUDANCA_RESIDENCIAL" || serviceType === "MUDANCA_COMERCIAL") &&
            !formData.mudanca?.rooms
          ) {
            toast.error("Por favor, selecione o número de cômodos");
            return false;
          }
          return true;
        }

        case 2: {
          if (!formData.personal.name?.trim()) {
            toast.error("Por favor, preencha seu nome");
            return false;
          }
          if (!formData.personal.phone?.trim()) {
            toast.error("Por favor, preencha seu telefone");
            return false;
          }
          return true;
        }

        case 3: {
          if (!formData.origin.city || !formData.origin.street || !formData.origin.number) {
            toast.error("Por favor, preencha o endereço de origem completo");
            return false;
          }

          if (config.requiresDestination) {
            if (!formData.destination?.city || !formData.destination?.street || !formData.destination?.number) {
              toast.error("Por favor, preencha o endereço de destino completo");
              return false;
            }
          }
          return true;
        }

        case 4: {
          // ✅ Regra específica FRETE_MOTO
          if (serviceType === "FRETE_MOTO") {
            const weight = parseFloat(formData.cargo?.weight || "0");
            const weightInKg = formData.cargo?.weightUnit === "ton" ? weight * 1000 : weight;
            if (weightInKg > 150) {
              toast.error("Frete por moto suporta cargas até 150kg");
              return false;
            }
          }
          return true;
        }

        case 5:
          return true;

        default:
          return true;
      }
    },
    [config.requiresDestination, formData, serviceType],
  );

  const handleNext = () => {
    if (!validateStep(currentStep)) return;
    if (currentStep < totalSteps) setCurrentStep((prev) => prev + 1);
  };

  const handleBack = () => {
    if (loading) return;
    if (currentStep > 1) setCurrentStep((prev) => prev - 1);
    else onClose();
  };

  // ✅ NORMALIZADOR para "MUDANCA" (se existir no banco como MUDANCA_RESIDENCIAL/COMERCIAL)
  const normalizeServiceTypeForDb = (t: string) => {
    // Se vier "MUDANCA" do catálogo antigo, garante compatibilidade
    if (t === "MUDANCA") return "MUDANCA_RESIDENCIAL";
    return t;
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;

    // ✅ Evita submit duplo
    if (loading) return;

    setLoading(true);

    try {
      // ✅ Bloqueio de segurança: se estiver logado, client_id deve existir
      // (garante que apareça no painel do produtor)
      if (!profile?.id) {
        toast.error("Você precisa estar logado para acompanhar a solicitação no painel.");
        setLoading(false);
        return;
      }

      const originAddress = `${formData.origin.street}, ${formData.origin.number}${
        formData.origin.complement ? `, ${formData.origin.complement}` : ""
      }, ${formData.origin.neighborhood}, ${formData.origin.city} - ${formData.origin.state}`;

      const destinationAddress =
        config.requiresDestination && formData.destination
          ? `${formData.destination.street}, ${formData.destination.number}${
              formData.destination.complement ? `, ${formData.destination.complement}` : ""
            }, ${formData.destination.neighborhood}, ${formData.destination.city} - ${formData.destination.state}`
          : null;

      const additionalInfo: Record<string, any> = {
        origin: { ...formData.origin, full_address: originAddress },
        preferredTime: formData.preferredTime || null,
      };

      if (destinationAddress && formData.destination) {
        additionalInfo.destination = { ...formData.destination, full_address: destinationAddress };
      }

      if (serviceType === "GUINCHO") {
        additionalInfo.vehicleDetails = formData.vehicle;
      } else if (serviceType === "FRETE_MOTO" || serviceType === "FRETE_URBANO") {
        additionalInfo.cargoDetails = formData.cargo;
      } else if (serviceType === "MUDANCA_RESIDENCIAL" || serviceType === "MUDANCA_COMERCIAL") {
        additionalInfo.mudancaDetails = formData.mudanca;
      } else if (serviceType === "SERVICO_AGRICOLA") {
        additionalInfo.agriculturalDetails = formData.agricultural;
      } else if (serviceType === "SERVICO_TECNICO") {
        additionalInfo.technicalDetails = formData.technical;
      }

      // ✅ Determinar o service_type final (catalogo pode mandar "id" que NAO é o enum)
      // Se catalogServiceId estiver vindo como um ID do catálogo, NÃO use como service_type.
      // Use o serviceType real do wizard.
      const finalServiceType = normalizeServiceTypeForDb(serviceType);

      const { data, error } = await supabase.functions.invoke("create-guest-service-request", {
        body: {
          prospect_user_id: null,
          client_id: profile.id, // ✅ sempre vinculado ao perfil logado
          service_type: finalServiceType, // ✅ NÃO usa catalogServiceId aqui
          // ✅ se você quiser guardar referência do catálogo, vai em additional_info
          contact_name: formData.personal.name,
          contact_phone: formData.personal.phone,
          contact_email: formData.personal.email || null,
          contact_document: formData.personal.document ? formData.personal.document.replace(/\D/g, "") : null,
          location_address: originAddress,
          location_lat: formData.origin.lat,
          location_lng: formData.origin.lng,
          problem_description: formData.problemDescription || catalogServiceDescription || null,
          urgency: formData.urgency,
          city_name: formData.origin.city,
          state: formData.origin.state,
          city_id: formData.origin.city_id || null,
          additional_info: {
            ...additionalInfo,
            catalog: catalogServiceId
              ? {
                  service_id: catalogServiceId,
                  label: catalogServiceLabel || null,
                }
              : null,
          },
        },
      });

      if (error) {
        console.error("Edge function error:", error);
        throw new Error(error.message || "Erro ao processar solicitação");
      }

      if ((data as any)?.error) {
        console.error("Server error:", data);
        throw new Error((data as any).details || (data as any).error);
      }

      const notificationTarget = [
        "GUINCHO",
        "MUDANCA_RESIDENCIAL",
        "MUDANCA_COMERCIAL",
        "FRETE_URBANO",
        "FRETE_MOTO",
      ].includes(serviceType)
        ? "Motoristas"
        : "Prestadores";

      toast.success(`Solicitação enviada com sucesso! ${notificationTarget} próximos foram notificados.`);

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error("Erro ao salvar solicitação:", error);
      showErrorToast(toast, "Erro ao enviar solicitação", error);
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <Step1ServiceType formData={formData} onUpdate={handleUpdate} serviceType={serviceType} />;
      case 2:
        return <Step2PersonalData formData={formData} onUpdate={handleUpdate} serviceType={serviceType} />;
      case 3:
        return (
          <Step3Location
            formData={formData}
            onUpdate={handleUpdate}
            serviceType={serviceType}
            requiresDestination={config.requiresDestination}
          />
        );
      case 4:
        return <Step4Details formData={formData} onUpdate={handleUpdate} serviceType={serviceType} />;
      case 5:
        return <Step5Review formData={formData} serviceType={serviceType} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header - FIXO */}
      <div className="p-4 border-b shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">{config.icon}</span>
          <h2 className="text-xl font-semibold">{catalogServiceLabel || config.title}</h2>
        </div>
        <p className="text-sm text-muted-foreground">{catalogServiceDescription || config.description}</p>

        {/* ✅ Mostra dica apenas se NÃO estiver logado */}
        {!profile?.id && (
          <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-xs text-blue-800 dark:text-blue-200">
              💡 <strong>Dica:</strong> Crie uma conta para acompanhar suas solicitações e ter acesso ao histórico!
            </p>
          </div>
        )}
      </div>

      {/* Progress - FIXO */}
      <div className="px-4 py-2 shrink-0 border-b">
        <WizardProgress steps={config.steps} currentStep={currentStep} variant="compact" />
      </div>

      {/* Step Content - SCROLLABLE */}
      <div className="flex-1 overflow-y-auto min-h-0 p-4 scroll-area">{renderStep()}</div>

      {/* Navigation Buttons - FIXO NO RODAPÉ */}
      <div className="p-4 border-t bg-background shrink-0 flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={handleBack}
          className="flex items-center gap-2"
          disabled={loading}
        >
          <ArrowLeft className="h-4 w-4" />
          {currentStep === 1 ? "Cancelar" : "Voltar"}
        </Button>

        <div className="flex-1" />

        {currentStep < totalSteps ? (
          <Button type="button" onClick={handleNext} className="flex items-center gap-2" disabled={loading}>
            Próximo
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                Confirmar Solicitação
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
};
