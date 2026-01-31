/**
 * PendingDriverCard - Card para exibir motorista com solicitação de afiliação pendente
 * Componente separado para permitir uso correto de hooks React
 */
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { DriverAvatar } from '@/components/ui/driver-avatar';
import { useAffiliationValidation } from '@/hooks/useAffiliationValidation';
import { Star, Check, AlertCircle } from 'lucide-react';

interface PendingDriverCardProps {
  driver: any;
  onApprove: () => void;
  onReject: () => void;
  isApproving: boolean;
  isRejecting: boolean;
}

export const PendingDriverCard: React.FC<PendingDriverCardProps> = ({
  driver,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
}) => {
  // Hook agora é chamado no nível do componente, não dentro de um loop
  const validation = useAffiliationValidation(driver.driver);

  return (
    <div 
      className="relative p-4 border-2 border-green-500 rounded-lg bg-background shadow-lg animate-pulse-border"
    >
      {/* Badge "NOVO" */}
      <div className="absolute -top-2 -right-2 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold animate-bounce z-10">
        NOVO
      </div>

      <div className="flex flex-col gap-4">
        {/* Header com foto e info */}
        <div className="flex items-center gap-4">
          <DriverAvatar
            profilePhotoUrl={driver.driver?.profile_photo_url}
            selfieUrl={driver.driver?.selfie_url}
            fullName={driver.driver?.full_name}
            className="h-16 w-16 border-2 border-green-500"
            fallbackClassName="bg-green-100 text-green-700 text-xl"
          />
          
          <div className="flex-1">
            <p className="font-semibold text-lg">{driver.driver?.full_name}</p>
            <p className="text-sm text-muted-foreground">{driver.driver?.email}</p>
            <p className="text-sm text-muted-foreground">{driver.driver?.contact_phone}</p>
            
            {driver.driver?.rating > 0 && (
              <div className="flex items-center gap-1 mt-1">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                <span className="text-sm">{driver.driver.rating.toFixed(1)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Badges de validação */}
        <div className="flex flex-wrap gap-2">
          {driver.driver?.cnh_validation_status === 'APPROVED' && (
            <Badge variant="outline" className="text-xs bg-green-50 border-green-500 text-green-700">
              <Check className="h-3 w-3 mr-1" /> CNH Válida
            </Badge>
          )}
          {driver.driver?.document_validation_status === 'APPROVED' && (
            <Badge variant="outline" className="text-xs bg-green-50 border-green-500 text-green-700">
              <Check className="h-3 w-3 mr-1" /> Documentos OK
            </Badge>
          )}
          {validation.hasAllDocuments ? (
            <Badge variant="outline" className="text-xs bg-green-50 border-green-500 text-green-700">
              <Check className="h-3 w-3 mr-1" /> Perfil Completo
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs bg-blue-50 border-blue-500 text-blue-700">
              Documentos pendentes ({validation.optionalFields.length})
            </Badge>
          )}
        </div>

        {/* Barra de completude do perfil */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">Completude do Perfil</span>
            <span className="font-bold text-foreground">{validation.completionPercentage}%</span>
          </div>
          <Progress value={validation.completionPercentage} className="h-2" />
        </div>

        {/* Avisos de documentos opcionais */}
        {validation.optionalFields.length > 0 && (
          <Alert className="py-2 border-blue-500/50 bg-blue-50/10">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-xs text-blue-700">
              <strong>Documentos opcionais:</strong> {validation.optionalFields.join(', ')}
              <p className="mt-1 text-muted-foreground">
                Você pode aprovar agora e solicitar depois.
              </p>
            </AlertDescription>
          </Alert>
        )}

        {/* Avisos de dados obrigatórios faltando (apenas CPF/CNPJ) */}
        {validation.missingFields.length > 0 && (
          <Alert variant="destructive" className="py-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>Dados obrigatórios faltando:</strong> {validation.missingFields.join(', ')}
            </AlertDescription>
          </Alert>
        )}

        {/* Botões de ação */}
        <div className="flex gap-2 pt-2">
          <Button
            size="sm"
            className="flex-1 bg-green-600 hover:bg-green-700"
            onClick={onApprove}
            disabled={isApproving}
            title="Configurar permissões e aprovar"
          >
            {isApproving ? (
              <>
                <Check className="h-4 w-4 mr-2 animate-spin" />
                Aprovando...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Aprovar
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={onReject}
            disabled={isRejecting}
          >
            {isRejecting ? 'Rejeitando...' : 'Rejeitar'}
          </Button>
        </div>
      </div>
    </div>
  );
};
