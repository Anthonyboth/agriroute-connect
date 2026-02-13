// Página de Fiscalização - Acesso via QR Code
// Modo SOMENTE LEITURA para fiscais
// LGPD: Logs de acesso registrados automaticamente

import { useEffect, useState, useCallback } from 'react';
import { CenteredSpinner } from '@/components/ui/AppSpinner';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  ShieldCheck, 
  ShieldX, 
  ShieldAlert,
  MapPin, 
  Truck, 
  PawPrint,
  Calendar,
  FileText,
  AlertTriangle,
  Clock,
  User,
  Info,
  Eye
} from 'lucide-react';
import { getInspectionData, logInspectionAccessClient } from '@/services/livestockComplianceService';
import type { InspectionQRData } from '@/types/livestock-compliance';
import { 
  COMPLIANCE_STATUS_LABELS, 
  COMPLIANCE_STATUS_COLORS,
  LEGAL_DISCLAIMERS,
  isComplianceApproved,
  isComplianceBlocking
} from '@/types/livestock-compliance';
import { cn } from '@/lib/utils';

export default function InspectionView() {
  const [searchParams] = useSearchParams();
  const hash = searchParams.get('h') || searchParams.get('hash');
  
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<InspectionQRData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accessLogged, setAccessLogged] = useState(false);

  // Log LGPD-compliant access
  const logAccess = useCallback(async (qrHash: string, granted: boolean, reason?: string) => {
    if (accessLogged) return;
    
    try {
      await logInspectionAccessClient(qrHash, granted, reason);
      setAccessLogged(true);
      if (import.meta.env.DEV) console.log('[InspectionView] Access logged (LGPD compliant)');
    } catch (err) {
      console.error('[InspectionView] Failed to log access:', err);
    }
  }, [accessLogged]);

  useEffect(() => {
    async function fetchData() {
      if (!hash) {
        setError('QR Code inválido ou não fornecido');
        setLoading(false);
        return;
      }

      try {
        const inspectionData = await getInspectionData(hash);
        
        if (!inspectionData) {
          setError('QR Code expirado ou não encontrado');
          // Log denied access
          await logAccess(hash, false, 'QR Code expired or not found');
        } else {
          setData(inspectionData);
          // Log successful access
          await logAccess(hash, true);
        }
      } catch (err) {
        setError('Erro ao carregar dados de fiscalização');
        console.error(err);
        // Log error access
        if (hash) {
          await logAccess(hash, false, 'Error loading data');
        }
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [hash, logAccess]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <CenteredSpinner size="lg" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-lg border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <ShieldX className="h-6 w-6" />
              Erro de Fiscalização
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Acesso negado</AlertTitle>
              <AlertDescription>
                {error || 'Não foi possível carregar os dados'}
              </AlertDescription>
            </Alert>
            <p className="text-sm text-muted-foreground mt-4">
              Se você é fiscal, verifique se o QR Code está correto e não expirado.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isApproved = isComplianceApproved(data.compliance_status);
  const isBlocked = isComplianceBlocking(data.compliance_status);
  const statusLabel = COMPLIANCE_STATUS_LABELS[data.compliance_status] || data.compliance_status;
  const statusColor = COMPLIANCE_STATUS_COLORS[data.compliance_status] || '';

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header com Logo e Disclaimer */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">🚚 AgriRoute</CardTitle>
                <CardDescription>Ferramenta de Apoio à Fiscalização</CardDescription>
              </div>
              <Badge variant="outline" className="text-xs">
                SOMENTE LEITURA
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                {LEGAL_DISCLAIMERS.FISCAL_SUPPORT}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Status Principal */}
        <Card className={cn(
          'border-2',
          isApproved && 'border-green-500 bg-green-50/50',
          isBlocked && 'border-red-500 bg-red-50/50',
          !isApproved && !isBlocked && 'border-yellow-500 bg-yellow-50/50'
        )}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              {isApproved && <ShieldCheck className="h-16 w-16 text-green-600" />}
              {isBlocked && <ShieldX className="h-16 w-16 text-red-600" />}
              {!isApproved && !isBlocked && <ShieldAlert className="h-16 w-16 text-yellow-600" />}
              
              <div className="flex-1">
                <h2 className="text-2xl font-bold">
                  {isApproved ? 'EM CONFORMIDADE' : isBlocked ? 'NÃO CONFORME' : 'PENDENTE'}
                </h2>
                <p className="text-muted-foreground">{statusLabel}</p>
                
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant={isApproved ? 'default' : isBlocked ? 'destructive' : 'secondary'}>
                    Score de Risco: {data.risk_score}%
                  </Badge>
                  <Badge variant="outline" className={statusColor}>
                    {data.gta_status === 'valid' ? 'GTA Válida' : 
                     data.gta_status === 'expired' ? 'GTA Vencida' :
                     data.gta_status === 'missing' ? 'GTA Ausente' : 'GTA Inválida'}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dados do Transporte */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Truck className="h-5 w-5" />
              Dados do Transporte
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Origem e Destino */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">ORIGEM</p>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-green-600" />
                  <span className="font-medium">
                    {data.origin.city}/{data.origin.state}
                  </span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">DESTINO</p>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-red-600" />
                  <span className="font-medium">
                    {data.destination.city}/{data.destination.state}
                  </span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Dados do Animal */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">ESPÉCIE</p>
                <div className="flex items-center gap-2">
                  <PawPrint className="h-4 w-4" />
                  <span className="font-medium capitalize">{data.animal_species}</span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">QUANTIDADE</p>
                <span className="font-medium text-lg">{data.animal_count} cabeças</span>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">FINALIDADE</p>
              <span className="font-medium capitalize">{data.transport_purpose}</span>
            </div>

            <Separator />

            {/* Dados da GTA */}
            {data.gta_number && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">NÚMERO DA GTA</p>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span className="font-mono font-medium">{data.gta_number}</span>
                </div>
              </div>
            )}

            {data.gta_expiry && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">VALIDADE DA GTA</p>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span className="font-medium">
                    {new Date(data.gta_expiry).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>
            )}

            <Separator />

            {/* Motorista e Veículo */}
            {data.driver_name && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">MOTORISTA</p>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span className="font-medium">{data.driver_name}</span>
                </div>
              </div>
            )}

            {data.vehicle_plate && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">PLACA DO VEÍCULO</p>
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  <span className="font-mono font-medium">{data.vehicle_plate}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Timestamp */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>Dados gerados em:</span>
              </div>
              <span>{new Date(data.generated_at).toLocaleString('pt-BR')}</span>
            </div>
          </CardContent>
        </Card>

        {/* LGPD Access Indicator */}
        <Card className="border-blue-200 bg-blue-50/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3 text-sm">
              <Eye className="h-5 w-5 text-blue-600" />
              <div>
                <p className="font-medium text-blue-800">Acesso registrado (LGPD)</p>
                <p className="text-xs text-blue-600">
                  Este acesso foi registrado em conformidade com a Lei Geral de Proteção de Dados.
                  Informações coletadas: IP, navegador, data/hora.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Disclaimer Final */}
        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Aviso Legal</AlertTitle>
          <AlertDescription className="text-xs space-y-1">
            <p>{LEGAL_DISCLAIMERS.NO_OFFICIAL_VALIDATION}</p>
            <p>{LEGAL_DISCLAIMERS.COMPLIANCE_DISCLAIMER}</p>
          </AlertDescription>
        </Alert>

        {/* ID do Frete (para referência) */}
        <p className="text-center text-xs text-muted-foreground">
          Ref: {data.freight_id.slice(0, 8)}...
        </p>
      </div>
    </div>
  );
}
