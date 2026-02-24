import React from 'react';
import { Button } from '@/components/ui/button';
import { useLoopPrevention } from '@/hooks/useLoopPrevention';
import { AlertCircle, RefreshCw, RotateCcw } from 'lucide-react';

interface LoopPreventionBoundaryProps {
  children: React.ReactNode;
}

const TRIGGER_LABELS: Record<string, string> = {
  REACT_UPDATE_DEPTH: 'React: profundidade máxima de atualização',
  REACT_TOO_MANY_RERENDERS: 'React: muitos re-renders / hooks instáveis',
};

export const LoopPreventionBoundary: React.FC<LoopPreventionBoundaryProps> = ({ children }) => {
  const { isTripped, tripDetails, reset } = useLoopPrevention();

  if (!isTripped) return <>{children}</>;

  const triggerLabel = tripDetails?.trigger
    ? TRIGGER_LABELS[tripDetails.trigger] || tripDetails.trigger
    : 'Desconhecido';

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg rounded-lg border border-destructive/30 bg-card p-6 text-card-foreground shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <AlertCircle className="h-8 w-8 text-destructive flex-shrink-0" />
          <div>
            <h1 className="text-lg font-semibold">Proteção anti-loop ativada</h1>
            <p className="text-sm text-muted-foreground">
              O app foi pausado automaticamente para evitar travamento.
              A equipe foi notificada via Telegram.
            </p>
          </div>
        </div>

        <div className="rounded-md border border-border bg-muted p-3 text-xs space-y-1">
          <div>
            <span className="font-medium">Tipo:</span> {triggerLabel}
          </div>

          {tripDetails?.errorMessage && (
            <div className="mt-1 text-destructive/80">
              <span className="font-medium">Erro:</span> {tripDetails.errorMessage}
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Recarregar agora
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={reset}
            className="w-full gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Tentar recuperar
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LoopPreventionBoundary;
