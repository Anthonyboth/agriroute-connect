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
import { useAuthenticatedUser } from "@/hooks/useAuthenticatedUser";
import { usePrefilledUserData } from "@/hooks/usePrefilledUserData";
import { useFormNotification } from "@/hooks/useFormNotification";

interface ServiceWizardProps {
  serviceType: ServiceType;
  onClose: () => void;
  onSuccess?: () => void;
  // Para serviços do catálogo (agrícola/técnico)
  catalogServiceId?: string;
  catalogServiceLabel?: string;
  catalogServiceDescription?: string;
}

const createInitialFormData = (serviceType: ServiceType, catalogServiceId?: string): ServiceFormData => ({
  serviceType,
  subServiceType: catalogServiceId || "",
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
    type: serviceType === 'MUDANCA_COMERCIAL' ? 'COMERCIAL' : 'RESIDENCIAL',
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
  packageDetails: {
    packageType: "",
    weight: "",
    size: "",
    isFragile: false,
    pickupDate: "",
    pickupTime: "",
    observations: "",
    suggestedPrice: "",
  },
  petDetails: {
    petType: "",
    petSize: "",
    petWeight: "",
    needsCarrier: false,
    isAggressiveOrAnxious: false,
    needsStops: false,
    pickupDate: "",
    pickupTime: "",
    observations: "",
    ownerDeclaration: false,
    suggestedPrice: "",
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
  const { isLoggedInWithProfile, profile } = useAuthenticatedUser();
  const { personal: prefilledPersonal, address: prefilledAddress, loading: prefillLoading } = usePrefilledUserData();
  const { showFormError, showMissingField, showSuccess } = useFormNotification();

  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<ServiceFormData>(() => createInitialFormData(serviceType, catalogServiceId));
  const [loading, setLoading] = useState(false);
  const [hasPrefilled, setHasPrefilled] = useState(false);

  const config = useMemo(() => getServiceConfig(serviceType), [serviceType]);
  // Se logado, filtra step 2 do progresso
  const visibleSteps = useMemo(() => {
    if (isLoggedInWithProfile) {
      return config.steps.filter(s => s.id !== 2);
    }
    return config.steps;
  }, [config.steps, isLoggedInWithProfile]);
  const totalSteps = config.steps.length;

  // ✅ PREFILL AUTOMÁTICO: Preencher dados pessoais e endereço quando disponíveis
  useEffect(() => {
    if (prefillLoading || hasPrefilled) return;
    
    // Verificar se há dados para prefill
    if (prefilledPersonal.name || prefilledPersonal.phone || prefilledPersonal.document) {
      setFormData(prev => ({
        ...prev,
        personal: {
          ...prev.personal,
          name: prev.personal.name || prefilledPersonal.name,
          phone: prev.personal.phone || prefilledPersonal.phone,
          email: prev.personal.email || prefilledPersonal.email,
          document: prev.personal.document || prefilledPersonal.document,
        },
        origin: {
          ...prev.origin,
          city: prev.origin.city || prefilledAddress.city,
          city_id: prev.origin.city_id || prefilledAddress.city_id,
          state: prev.origin.state || prefilledAddress.state,
          lat: prev.origin.lat || prefilledAddress.lat,
          lng: prev.origin.lng || prefilledAddress.lng,
        },
      }));
      setHasPrefilled(true);
    }
  }, [prefillLoading, prefilledPersonal, prefilledAddress, hasPrefilled]);

  // ✅ Se serviceType mudar (ex: modal troca), reseta wizard corretamente
  useEffect(() => {
    setCurrentStep(1);
    setFormData(createInitialFormData(serviceType, catalogServiceId));
    setHasPrefilled(false); // Reset prefill flag para permitir novo prefill
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

  // Validação por etapa - usa useFormNotification para exibir erros claros
  const validateStep = useCallback(
    (step: number): boolean => {
      switch (step) {
        case 1: {
          if (serviceType === "GUINCHO" && !formData.vehicle?.situation) {
            showFormError({
              field: "Situação do Veículo",
              problem: "Este campo é obrigatório para serviço de guincho.",
              solution: "Selecione se o veículo está funcionando, não liga ou teve acidente.",
            });
            return false;
          }
          if (
            (serviceType === "MUDANCA_RESIDENCIAL" || serviceType === "MUDANCA_COMERCIAL") &&
            !formData.mudanca?.rooms
          ) {
            showFormError({
              field: "Número de Cômodos",
              problem: "Este campo é obrigatório para mudanças.",
              solution: "Selecione quantos cômodos serão movidos (1-2, 3-4, 5+).",
            });
            return false;
          }
          return true;
        }

        case 2: {
          // Usuários logados com perfil não passam por esta etapa
          if (isLoggedInWithProfile) return true;
          if (!formData.personal.name?.trim()) {
            showMissingField("name", "Nome Completo");
            return false;
          }
          if (formData.personal.name.trim().length < 3) {
            showFormError({
              field: "Nome Completo",
              problem: "Nome muito curto (mínimo 3 caracteres).",
              solution: "Informe seu nome completo para que o prestador possa identificá-lo.",
            });
            return false;
          }
          if (!formData.personal.phone?.trim()) {
            showMissingField("phone", "Telefone");
            return false;
          }
          if (formData.personal.phone.replace(/\D/g, '').length < 10) {
            showFormError({
              field: "Telefone",
              problem: "Telefone incompleto.",
              solution: "Informe um telefone válido com DDD (ex: 66 99999-0000).",
            });
            return false;
          }
          if (!formData.personal.document?.trim()) {
            showMissingField("document", "CPF ou CNPJ");
            return false;
          }
          const docDigits = formData.personal.document.replace(/\D/g, '');
          if (docDigits.length !== 11 && docDigits.length !== 14) {
            showFormError({
              field: "CPF ou CNPJ",
              problem: "Documento incompleto.",
              solution: "Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.",
            });
            return false;
          }
          return true;
        }

        case 3: {
          if (!formData.origin.city) {
            showFormError({
              field: "Cidade de Origem",
              problem: "Cidade não informada.",
              solution: "Digite o CEP ou selecione a cidade no campo de origem.",
            });
            return false;
          }
          if (!formData.origin.neighborhood) {
            showFormError({
              field: "Bairro",
              problem: "Bairro de origem não informado.",
              solution: "Preencha o bairro para que o prestador localize você.",
            });
            return false;
          }
          if (!formData.origin.street) {
            showFormError({
              field: "Rua/Logradouro",
              problem: "Endereço incompleto.",
              solution: "Preencha o nome da rua, avenida ou fazenda de origem.",
            });
            return false;
          }
          if (!formData.origin.number) {
            showFormError({
              field: "Número",
              problem: "Número do endereço não informado.",
              solution: "Informe o número ou digite 'S/N' se não houver.",
            });
            return false;
          }

          if (config.requiresDestination) {
            if (!formData.destination?.city) {
              showFormError({
                field: "Cidade de Destino",
                problem: "Destino não informado.",
                solution: "Digite o CEP ou selecione a cidade de destino.",
              });
              return false;
            }
            if (!formData.destination?.neighborhood) {
              showFormError({
                field: "Bairro de Destino",
                problem: "Bairro de destino não informado.",
                solution: "Preencha o bairro do endereço de destino.",
              });
              return false;
            }
            if (!formData.destination?.street) {
              showFormError({
                field: "Rua de Destino",
                problem: "Endereço de destino incompleto.",
                solution: "Preencha o nome da rua, avenida ou fazenda de destino.",
              });
              return false;
            }
            if (!formData.destination?.number) {
              showFormError({
                field: "Número de Destino",
                problem: "Número do endereço de destino não informado.",
                solution: "Informe o número ou digite 'S/N' se não houver.",
              });
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
              showFormError({
                field: "Peso da Carga",
                problem: "Peso excede o limite de 150kg para motoboy.",
                solution: "Reduza o peso ou escolha 'Frete Urbano' para cargas maiores.",
              });
              return false;
            }
          }
          // ✅ Validar datas obrigatórias para Mudança
          if (serviceType === "MUDANCA_RESIDENCIAL" || serviceType === "MUDANCA_COMERCIAL") {
            if (!formData.mudanca?.pickupDate) {
              showFormError({
                field: "Data de Coleta",
                problem: "Data de coleta não informada.",
                solution: "Selecione quando deseja iniciar a mudança.",
              });
              return false;
            }
            if (!formData.mudanca?.deliveryDate) {
              showFormError({
                field: "Data de Entrega",
                problem: "Data de entrega não informada.",
                solution: "Selecione quando a mudança deve ser concluída.",
              });
              return false;
            }
          }
          // ✅ Validar tipo de carga para frete urbano
          if ((serviceType === "FRETE_MOTO" || serviceType === "FRETE_URBANO") && !formData.cargo?.type) {
            showFormError({
              field: "Tipo de Carga",
              problem: "Tipo de carga não selecionado.",
              solution: "Selecione o que será transportado (ex: Documentos, Móveis, etc.).",
            });
            return false;
          }
          // ✅ Validar campos obrigatórios para Entrega de Pacotes
          if (serviceType === "ENTREGA_PACOTES") {
            if (!formData.packageDetails?.packageType) {
              showFormError({
                field: "Tipo de Pacote",
                problem: "Tipo de pacote não selecionado.",
                solution: "Selecione o tipo de item que será entregue.",
              });
              return false;
            }
          }
          // ✅ Validar campos obrigatórios para Transporte de Pet
          if (serviceType === "TRANSPORTE_PET") {
            if (!formData.petDetails?.petType) {
              showFormError({
                field: "Tipo de Pet",
                problem: "Tipo de pet não informado.",
                solution: "Selecione se é cachorro, gato ou outro.",
              });
              return false;
            }
            if (!formData.petDetails?.petSize) {
              showFormError({
                field: "Porte do Pet",
                problem: "Porte do pet não selecionado.",
                solution: "Selecione o porte: Pequeno, Médio ou Grande.",
              });
              return false;
            }
            if (!formData.petDetails?.ownerDeclaration) {
              showFormError({
                field: "Declaração de Responsabilidade",
                problem: "Declaração obrigatória não aceita.",
                solution: "Marque a declaração de responsabilidade para continuar.",
              });
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
    [config.requiresDestination, formData, serviceType, showFormError, showMissingField],
  );

  const handleNext = () => {
    if (!validateStep(currentStep)) return;
    if (currentStep < totalSteps) {
      let next = currentStep + 1;
      // Pular step 2 para usuários logados com perfil
      if (isLoggedInWithProfile && next === 2) next = 3;
      setCurrentStep(next);
    }
  };

  const handleBack = () => {
    if (loading) return;
    if (currentStep > 1) {
      let prev = currentStep - 1;
      // Pular step 2 para usuários logados com perfil
      if (isLoggedInWithProfile && prev === 2) prev = 1;
      setCurrentStep(prev);
    } else {
      onClose();
    }
  };

  // ✅ NORMALIZADOR para "MUDANCA" (se existir no banco como MUDANCA_RESIDENCIAL/COMERCIAL)
  const normalizeServiceTypeForDb = (t: string) => {
    // Se vier "MUDANCA" do catálogo antigo, garante compatibilidade
    if (t === "MUDANCA") return "MUDANCA_RESIDENCIAL";
    return t;
  };

  // ✅ FIX: Determinar o service_type final para o banco de dados
  // PRIORIDADE: catalogServiceId > serviceType
  // Isso garante que serviços específicos do catálogo (ex: AGRONOMO) 
  // sejam usados em vez de tipos genéricos (ex: SERVICO_AGRICOLA)
  const getFinalServiceType = (): string => {
    // Se temos um ID do catálogo válido, usar ele como service_type
    // Isso permite matching correto com os service_types dos prestadores
    if (catalogServiceId && catalogServiceId.length > 0) {
      console.log('[ServiceWizard] Usando catalogServiceId como service_type:', catalogServiceId);
      return normalizeServiceTypeForDb(catalogServiceId);
    }
    // Fallback para o tipo genérico do wizard
    console.log('[ServiceWizard] Usando serviceType genérico:', serviceType);
    return normalizeServiceTypeForDb(serviceType);
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;

    // ✅ Evita submit duplo
    if (loading) return;

    setLoading(true);

    try {
      // ✅ Suporte a solicitações de convidados (guest requests)
      // Se o usuário não está logado, a solicitação é enviada sem client_id
      // A edge function create-guest-service-request aceita solicitações anônimas

      // ✅ Regra do produto: NÃO criar solicitações genéricas de categoria.
      // Para serviços de catálogo (agrícola/técnico), o usuário precisa selecionar um serviço específico (serviceId).
      if ((serviceType === 'SERVICO_AGRICOLA' || serviceType === 'SERVICO_TECNICO') && (!catalogServiceId || catalogServiceId.length === 0)) {
        showFormError({
          field: 'Tipo de Serviço',
          problem: 'Seleção de serviço específica ausente.',
          solution: 'Volte e selecione um serviço específico (ex: Agrônomo, Análise de Solo, Pulverização por Drone).',
        });
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
      } else if (serviceType === "ENTREGA_PACOTES") {
        additionalInfo.packageDetails = formData.packageDetails;
      } else if (serviceType === "TRANSPORTE_PET") {
        additionalInfo.petDetails = formData.petDetails;
      }

      // ✅ FIX: Usar getFinalServiceType() que prioriza catalogServiceId
      // Isso garante que serviços específicos (AGRONOMO, ANALISE_SOLO, etc.) 
      // sejam usados em vez de tipos genéricos (SERVICO_AGRICOLA)
      const finalServiceType = getFinalServiceType();

      // ✅ Extrair valor sugerido pelo usuário (PET ou Pacotes)
      const suggestedPrice = 
        serviceType === "ENTREGA_PACOTES" && formData.packageDetails?.suggestedPrice
          ? parseFloat(formData.packageDetails.suggestedPrice)
          : serviceType === "TRANSPORTE_PET" && formData.petDetails?.suggestedPrice
            ? parseFloat(formData.petDetails.suggestedPrice)
            : null;

      const { data, error } = await supabase.functions.invoke("create-guest-service-request", {
        body: {
          prospect_user_id: profile?.id ? null : 'guest_user',
          client_id: profile?.id || null,
          service_type: finalServiceType,
          contact_name: formData.personal.name,
          contact_phone: formData.personal.phone ? formData.personal.phone.replace(/\D/g, '') : '',
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
          estimated_price: suggestedPrice && suggestedPrice > 0 ? suggestedPrice : null,
          // Destination fields (top-level for DB columns)
          destination_address: destinationAddress || null,
          destination_city: formData.destination?.city || null,
          destination_state: formData.destination?.state || null,
          destination_lat: formData.destination?.lat || null,
          destination_lng: formData.destination?.lng || null,
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

      // Fretes urbanos notificam MOTORISTAS, serviços técnicos/agrícolas notificam PRESTADORES
      const isFreightType = [
        "FRETE_URBANO",
        "FRETE_MOTO",
        "MUDANCA_RESIDENCIAL",
        "MUDANCA_COMERCIAL",
        "ENTREGA_PACOTES",
        "GUINCHO",
      ].includes(serviceType);

      const notificationTarget = isFreightType ? "Motoristas" : "Prestadores";
      showSuccess(`Solicitação enviada! ${notificationTarget} próximos foram notificados.`);

      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error("Erro ao salvar solicitação:", error);
      
      // ✅ Notificação clara do erro com solução específica
      const errorMsg = error?.message || '';
      let solution = "Verifique sua conexão com a internet e tente novamente em alguns segundos.";
      
      if (errorMsg.includes("permission")) {
        solution = "Verifique se você está logado corretamente e tente novamente.";
      } else if (errorMsg.includes("contact_phone") || errorMsg.includes("telefone") || errorMsg.includes("phone")) {
        solution = "O campo Telefone é obrigatório. Verifique se está preenchido corretamente com DDD.";
      } else if (errorMsg.includes("contact_name") || errorMsg.includes("name")) {
        solution = "O campo Nome é obrigatório. Verifique se está preenchido.";
      } else if (errorMsg.includes("validation") || errorMsg.includes("invalid") || errorMsg.includes("required")) {
        solution = "Verifique se todos os campos obrigatórios estão preenchidos corretamente.";
      }
      
      showFormError({
        problem: "Não foi possível enviar sua solicitação.",
        solution,
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <Step1ServiceType formData={formData} onUpdate={handleUpdate} serviceType={serviceType} catalogServiceId={catalogServiceId} />;
      case 2:
        // Usuários logados com perfil nunca devem ver esta tela
        if (isLoggedInWithProfile) return null;
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
      <div className="px-4 py-2 border-b shrink-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">{config.icon}</span>
          <h2 className="text-xl font-semibold">{catalogServiceLabel || config.title}</h2>
        </div>
        <p className="text-sm text-muted-foreground">{catalogServiceDescription || config.description}</p>
      </div>

      {/* Progress - FIXO */}
      <div className="px-4 py-2 shrink-0 border-b">
        <WizardProgress steps={visibleSteps} currentStep={currentStep} variant="compact" />
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
