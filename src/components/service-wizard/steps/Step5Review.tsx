import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ServiceFormData, ServiceType, URGENCY_LABELS, ADDITIONAL_SERVICES } from '../types';
import { getServiceConfig } from '../config';
import { User, MapPin, Package, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toUF } from '@/utils/city-deduplication';

interface Step5Props {
  formData: ServiceFormData;
  serviceType: ServiceType;
}

export const Step5Review: React.FC<Step5Props> = ({ formData, serviceType }) => {
  const config = getServiceConfig(serviceType);
  const urgencyInfo = URGENCY_LABELS[formData.urgency];

  // Formata endereço SEMPRE com UF de 2 letras
  const formatAddress = (address: typeof formData.origin) => {
    if (!address) return 'Não informado';
    // Converter state para UF
    const uf = address.state ? (toUF(address.state) || address.state) : '';
    const parts = [
      address.street,
      address.number && `nº ${address.number}`,
      address.neighborhood,
      address.complement,
      address.city,
      uf
    ].filter(Boolean);
    return parts.join(', ') || 'Não informado';
  };

  const getSelectedServices = () => {
    if (!formData.mudanca?.additionalServices?.length) return null;
    return ADDITIONAL_SERVICES
      .filter(s => formData.mudanca?.additionalServices?.includes(s.id))
      .map(s => s.label)
      .join(', ');
  };

  return (
    <div className="space-y-4">
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{config.icon}</span>
            <div>
              <h3 className="font-semibold text-lg">{config.title}</h3>
              <p className="text-sm text-muted-foreground">{config.description}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dados Pessoais */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <User className="h-4 w-4" />
            Seus Dados
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Nome:</span>
            <span className="font-medium">{formData.personal.name || 'Não informado'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Telefone:</span>
            <span className="font-medium">{formData.personal.phone || 'Não informado'}</span>
          </div>
          {formData.personal.email && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">E-mail:</span>
              <span className="font-medium">{formData.personal.email}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Documento:</span>
            <span className="font-medium">{formData.personal.document || 'Não informado'}</span>
          </div>
        </CardContent>
      </Card>

      {/* Localização */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Localização
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <span className="text-muted-foreground block mb-1">
              {config.requiresDestination ? 'Origem:' : 'Local:'}
            </span>
            <span className="font-medium">{formatAddress(formData.origin)}</span>
          </div>
          {config.requiresDestination && formData.destination && (
            <>
              <Separator />
              <div>
                <span className="text-muted-foreground block mb-1">Destino:</span>
                <span className="font-medium">{formatAddress(formData.destination)}</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Detalhes do Serviço */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Package className="h-4 w-4" />
            Detalhes do Serviço
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {formData.problemDescription && (
            <div>
              <span className="text-muted-foreground block mb-1">Descrição:</span>
              <span className="font-medium">{formData.problemDescription}</span>
            </div>
          )}

          {/* Guincho */}
          {serviceType === 'GUINCHO' && formData.vehicle && (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Veículo:</span>
                <span className="font-medium">{formData.vehicle.type}</span>
              </div>
              {formData.vehicle.plate && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Placa:</span>
                  <span className="font-medium">{formData.vehicle.plate}</span>
                </div>
              )}
            </>
          )}

          {/* Frete */}
          {(serviceType === 'FRETE_MOTO' || serviceType === 'FRETE_URBANO') && formData.cargo && (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tipo de Carga:</span>
                <span className="font-medium">{formData.cargo.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Peso:</span>
                <span className="font-medium">{formData.cargo.weight} {formData.cargo.weightUnit}</span>
              </div>
              {formData.cargo.needsPackaging && (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span>Precisa de embalagem</span>
                </div>
              )}
              {formData.cargo.needsHelper && (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span>Precisa de ajudante</span>
                </div>
              )}
            </>
          )}

          {/* Mudança */}
          {(serviceType === 'MUDANCA_RESIDENCIAL' || serviceType === 'MUDANCA_COMERCIAL') && formData.mudanca && (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tipo:</span>
                <span className="font-medium">{formData.mudanca.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cômodos:</span>
                <span className="font-medium">{formData.mudanca.rooms}</span>
              </div>
              {formData.mudanca.volume && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Volume:</span>
                  <span className="font-medium">{formData.mudanca.volume} m³</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Data Coleta:</span>
                <span className="font-medium">{formData.mudanca.pickupDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Data Entrega:</span>
                <span className="font-medium">{formData.mudanca.deliveryDate}</span>
              </div>
              {getSelectedServices() && (
                <div>
                  <span className="text-muted-foreground block mb-1">Serviços Adicionais:</span>
                  <span className="font-medium">{getSelectedServices()}</span>
                </div>
              )}
            </>
          )}

          {/* Técnico */}
          {serviceType === 'SERVICO_TECNICO' && formData.technical && (
            <>
              {formData.technical.equipmentType && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Equipamento:</span>
                  <span className="font-medium">{formData.technical.equipmentType}</span>
                </div>
              )}
              {formData.technical.brand && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Marca:</span>
                  <span className="font-medium">{formData.technical.brand}</span>
                </div>
              )}
              {formData.technical.model && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Modelo:</span>
                  <span className="font-medium">{formData.technical.model}</span>
                </div>
              )}
            </>
          )}

          {/* Agrícola */}
          {serviceType === 'SERVICO_AGRICOLA' && formData.agricultural && (
            <>
              {formData.agricultural.farmName && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Propriedade:</span>
                  <span className="font-medium">{formData.agricultural.farmName}</span>
                </div>
              )}
              {formData.agricultural.area && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Área:</span>
                  <span className="font-medium">{formData.agricultural.area} hectares</span>
                </div>
              )}
              {formData.agricultural.culture && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cultura:</span>
                  <span className="font-medium">{formData.agricultural.culture}</span>
                </div>
              )}
            </>
          )}

          <Separator />

          <div className="flex justify-between items-center">
            <span className="text-muted-foreground flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              Urgência:
            </span>
            <Badge className={urgencyInfo.color}>{urgencyInfo.label}</Badge>
          </div>

          {formData.preferredTime && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Horário:
              </span>
              <span className="font-medium">{formData.preferredTime}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
