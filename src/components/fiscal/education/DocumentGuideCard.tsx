import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  Truck, 
  ClipboardList, 
  PawPrint,
  Briefcase,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { DocumentType, getDocumentInfo } from '@/lib/fiscal-requirements';

interface DocumentGuideCardProps {
  docType: DocumentType;
  onClick?: () => void;
  isSelected?: boolean;
  showFullInfo?: boolean;
}

const DOCUMENT_ICONS: Record<DocumentType, React.ReactNode> = {
  NFE: <FileText className="h-6 w-6" />,
  CTE: <Truck className="h-6 w-6" />,
  MDFE: <ClipboardList className="h-6 w-6" />,
  GTA: <PawPrint className="h-6 w-6" />,
  NFSE: <Briefcase className="h-6 w-6" />,
};

const DOCUMENT_COLORS: Record<DocumentType, string> = {
  NFE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  CTE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  MDFE: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  GTA: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  NFSE: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
};

export const DocumentGuideCard: React.FC<DocumentGuideCardProps> = ({
  docType,
  onClick,
  isSelected = false,
  showFullInfo = false,
}) => {
  const info = getDocumentInfo(docType);

  if (showFullInfo) {
    return (
      <Card className="h-full">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${DOCUMENT_COLORS[docType]}`}>
              {DOCUMENT_ICONS[docType]}
            </div>
            <div>
              <CardTitle className="text-xl">{info.name}</CardTitle>
              <CardDescription>{info.fullName}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium text-sm text-muted-foreground mb-1">O que é</h4>
            <p className="text-sm">{info.description}</p>
          </div>
          
          <div>
            <h4 className="font-medium text-sm text-muted-foreground mb-2">Quem precisa</h4>
            <ul className="space-y-1">
              {info.whoNeeds.map((item, idx) => (
                <li key={idx} className="text-sm flex items-start gap-2">
                  <ChevronRight className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          
          <div>
            <h4 className="font-medium text-sm text-muted-foreground mb-1">Órgão responsável</h4>
            <Badge variant="outline">{info.authority}</Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      className={`cursor-pointer transition-all hover:shadow-md ${
        isSelected ? 'ring-2 ring-primary' : ''
      }`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${DOCUMENT_COLORS[docType]}`}>
            {DOCUMENT_ICONS[docType]}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold">{info.name}</h3>
            <p className="text-xs text-muted-foreground truncate">{info.fullName}</p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
};

export default DocumentGuideCard;
