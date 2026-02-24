import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  Truck, 
  FileSpreadsheet, 
  PawPrint, 
  Plus,
  Eye,
  Upload,
  Lock,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react';
import { DocumentPermissions, BLOCKED_DOCUMENT_REASONS } from '@/hooks/useDocumentPermissions';
import { NfeEmissionWizard } from '@/components/fiscal/nfe/NfeEmissionWizard';
import { CteEmissionWizard } from '@/components/fiscal/cte/CteEmissionWizard';
import { MdfeEmissionWizard } from '@/components/fiscal/mdfe/MdfeEmissionWizard';
import { GtaUploadDialog } from '@/components/fiscal/gta/GtaUploadDialog';
import { NfeManagementPanel } from '@/components/fiscal/nfe/NfeManagementPanel';

interface FiscalDocumentCardsProps {
  userRole: string;
  fiscalIssuer: any;
  permissions: DocumentPermissions;
  recentCounts?: {
    nfes: number;
    ctes: number;
    mdfes: number;
  };
}

interface DocumentCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  enabled: boolean;
  blockedReason?: string;
  count?: number;
  onEmit: () => void;
  onManage: () => void;
  hasCertificate?: boolean;
  requiresCertificate?: boolean;
  actionLabel?: string;
}

const DocumentCard: React.FC<DocumentCardProps> = ({
  title,
  description,
  icon,
  color,
  enabled,
  blockedReason,
  count = 0,
  onEmit,
  onManage,
  hasCertificate,
  requiresCertificate,
  actionLabel = 'Emitir',
}) => {
  const needsCertificate = requiresCertificate && !hasCertificate;
  const isActionable = enabled && !needsCertificate;

  return (
    <Card className={`transition-all ${
      !enabled 
        ? 'opacity-60 bg-muted/30' 
        : needsCertificate 
          ? 'border-yellow-500/30 bg-yellow-500/5'
          : 'hover:shadow-md'
    }`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className={`p-2 rounded-lg ${color}`}>
            {icon}
          </div>
          {!enabled ? (
            <Badge variant="secondary" className="gap-1">
              <Lock className="h-3 w-3" />
              Bloqueado
            </Badge>
          ) : needsCertificate ? (
            <Badge variant="outline" className="gap-1 border-yellow-500 text-yellow-600">
              <AlertCircle className="h-3 w-3" />
              Certificado
            </Badge>
          ) : count > 0 ? (
            <Badge variant="secondary" className="gap-1">
              <Clock className="h-3 w-3" />
              {count} este mês
            </Badge>
          ) : null}
        </div>
        <CardTitle className="text-lg mt-3">{title}</CardTitle>
        <CardDescription className="text-sm">
          {!enabled ? blockedReason : description}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="pt-0">
        {isActionable ? (
          <div className="flex gap-2">
            <Button 
              size="sm" 
              className="flex-1"
              onClick={onEmit}
            >
              <Plus className="h-4 w-4 mr-1" />
              {actionLabel}
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={onManage}
            >
              <Eye className="h-4 w-4" />
            </Button>
          </div>
        ) : needsCertificate ? (
          <Button size="sm" variant="outline" className="w-full" disabled>
            <Upload className="h-4 w-4 mr-2" />
            Upload Certificado A1
          </Button>
        ) : (
          <Button size="sm" variant="ghost" className="w-full" disabled>
            <Lock className="h-4 w-4 mr-2" />
            Não disponível
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export const FiscalDocumentCards: React.FC<FiscalDocumentCardsProps> = ({
  userRole,
  fiscalIssuer,
  permissions,
  recentCounts,
}) => {
  const [showNfeWizard, setShowNfeWizard] = useState(false);
  const [showCteWizard, setShowCteWizard] = useState(false);
  const [showMdfeWizard, setShowMdfeWizard] = useState(false);
  const [showGtaUpload, setShowGtaUpload] = useState(false);
  const [showNfeManagement, setShowNfeManagement] = useState(false);

  // ✅ CORREÇÃO: Verificar status do certificado usando 'status' e 'sefaz_status'
  // O campo 'certificate_uploaded_at' NÃO EXISTE na tabela fiscal_issuers
  const hasCertificate = 
    fiscalIssuer?.sefaz_status === 'validated' || 
    fiscalIssuer?.sefaz_status === 'production_enabled' ||
    fiscalIssuer?.sefaz_status === 'homologation_enabled' ||
    fiscalIssuer?.status === 'active' ||
    fiscalIssuer?.status === 'certificate_uploaded' ||
    fiscalIssuer?.status === 'production_enabled' ||
    fiscalIssuer?.status === 'homologation_enabled';

  const documents = [
    {
      id: 'nfe',
      title: 'NF-e',
      description: 'Nota Fiscal Eletrônica de Serviços',
      icon: <FileText className="h-5 w-5 text-blue-600" />,
      color: 'bg-blue-100 dark:bg-blue-900/30',
      enabled: permissions.canEmitNfe,
      count: recentCounts?.nfes || 0,
      requiresCertificate: false,
      onEmit: () => setShowNfeWizard(true),
      onManage: () => setShowNfeManagement(true),
    },
    {
      id: 'cte',
      title: 'CT-e',
      description: 'Conhecimento de Transporte Eletrônico',
      icon: <Truck className="h-5 w-5 text-green-600" />,
      color: 'bg-green-100 dark:bg-green-900/30',
      enabled: permissions.canEmitCte,
      blockedReason: BLOCKED_DOCUMENT_REASONS.CTE_BLOCKED,
      count: recentCounts?.ctes || 0,
      requiresCertificate: true,
      onEmit: () => setShowCteWizard(true),
      onManage: () => {},
    },
    {
      id: 'mdfe',
      title: 'MDF-e',
      description: 'Manifesto de Documentos Fiscais',
      icon: <FileSpreadsheet className="h-5 w-5 text-purple-600" />,
      color: 'bg-purple-100 dark:bg-purple-900/30',
      enabled: permissions.canEmitMdfe,
      blockedReason: BLOCKED_DOCUMENT_REASONS.MDFE_BLOCKED,
      count: recentCounts?.mdfes || 0,
      requiresCertificate: true,
      onEmit: () => setShowMdfeWizard(true),
      onManage: () => {},
    },
    {
      id: 'gta',
      title: 'GT-A',
      description: 'Guia de Transporte Animal (upload externo)',
      icon: <PawPrint className="h-5 w-5 text-amber-600" />,
      color: 'bg-amber-100 dark:bg-amber-900/30',
      enabled: permissions.canUploadGta,
      blockedReason: BLOCKED_DOCUMENT_REASONS.GTA_BLOCKED,
      requiresCertificate: false,
      onEmit: () => setShowGtaUpload(true),
      onManage: () => {},
      actionLabel: 'Enviar',
    },
  ];

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {documents.map((doc) => (
          <DocumentCard
            key={doc.id}
            {...doc}
            hasCertificate={hasCertificate}
          />
        ))}
      </div>

      {/* Wizards de Emissão */}
      {showNfeWizard && (
        <NfeEmissionWizard
          isOpen={showNfeWizard}
          onClose={() => setShowNfeWizard(false)}
          fiscalIssuer={fiscalIssuer}
        />
      )}

      {showCteWizard && (
        <CteEmissionWizard
          isOpen={showCteWizard}
          onClose={() => setShowCteWizard(false)}
          fiscalIssuer={fiscalIssuer}
        />
      )}

      {showMdfeWizard && (
        <MdfeEmissionWizard
          isOpen={showMdfeWizard}
          onClose={() => setShowMdfeWizard(false)}
          fiscalIssuer={fiscalIssuer}
        />
      )}

      {showGtaUpload && (
        <GtaUploadDialog
          isOpen={showGtaUpload}
          onClose={() => setShowGtaUpload(false)}
        />
      )}

      {showNfeManagement && (
        <NfeManagementPanel
          isOpen={showNfeManagement}
          onClose={() => setShowNfeManagement(false)}
          fiscalIssuer={fiscalIssuer}
        />
      )}
    </>
  );
};
