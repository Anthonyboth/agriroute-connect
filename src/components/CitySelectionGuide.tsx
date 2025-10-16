import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertTriangle, MapPin, Search, MousePointer } from 'lucide-react';

interface CitySelectionGuideProps {
  variant?: 'inline' | 'modal' | 'compact';
  showImportance?: boolean;
}

export const CitySelectionGuide: React.FC<CitySelectionGuideProps> = ({
  variant = 'inline',
  showImportance = true
}) => {
  if (variant === 'compact') {
    return (
      <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
        <MapPin className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-sm text-blue-800 dark:text-blue-200">
          <strong>Dica:</strong> Selecione a cidade da lista para garantir o match correto com fretes e serviços
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="border-2 border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-start gap-3">
          <MapPin className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
              Como selecionar uma cidade corretamente
            </h4>
            <div className="space-y-3 text-sm text-blue-800 dark:text-blue-200">
              {/* Passo 1 */}
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 shrink-0">
                  1
                </Badge>
                <div>
                  <div className="flex items-center gap-2 font-medium mb-1">
                    <Search className="h-3.5 w-3.5" />
                    Digite o nome da cidade
                  </div>
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    Digite pelo menos 2 letras. Aguarde as sugestões aparecerem automaticamente.
                  </p>
                </div>
              </div>

              {/* Passo 2 */}
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 shrink-0">
                  2
                </Badge>
                <div>
                  <div className="flex items-center gap-2 font-medium mb-1">
                    <MousePointer className="h-3.5 w-3.5" />
                    Clique em uma cidade da lista
                  </div>
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    Escolha a cidade correta da lista de sugestões. Use as setas ↑↓ para navegar.
                  </p>
                </div>
              </div>

              {/* Passo 3 */}
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 shrink-0">
                  3
                </Badge>
                <div>
                  <div className="flex items-center gap-2 font-medium mb-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Confirme a seleção
                  </div>
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    A cidade e estado aparecem no campo. Você verá um ícone ✓ verde confirmando a seleção válida.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {showImportance && (
          <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
              <strong>Por que é importante?</strong> Selecionar da lista garante que:
              <ul className="mt-1 ml-4 list-disc space-y-0.5">
                <li>Fretes e serviços sejam encontrados corretamente na sua região</li>
                <li>Motoristas e prestadores recebam notificações precisas</li>
                <li>As distâncias sejam calculadas com exatidão</li>
                <li>O matching automático funcione perfeitamente</li>
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300 pt-2 border-t border-blue-200 dark:border-blue-800">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
          <span className="font-medium">Cidade validada ✓</span>
          <span className="text-blue-600 dark:text-blue-400">significa que foi selecionada corretamente da lista</span>
        </div>
      </CardContent>
    </Card>
  );
};
