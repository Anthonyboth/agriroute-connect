import React from 'react';
import { Button } from '@/components/ui/button';
import { useLoopPrevention } from '@/hooks/useLoopPrevention';

interface LoopPreventionBoundaryProps {
  children: React.ReactNode;
}

export const LoopPreventionBoundary: React.FC<LoopPreventionBoundaryProps> = ({ children }) => {
  const { isTripped, tripDetails, reset } = useLoopPrevention();

  if (!isTripped) return <>{children}</>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
        <h1 className="text-lg font-semibold">Detectamos um loop e pausamos o app</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Para evitar travamento em produção, o aplicativo foi interrompido automaticamente e o incidente foi enviado
          para o Telegram.
        </p>

        {tripDetails?.trigger ? (
          <div className="mt-4 rounded-md border border-border bg-muted p-3 text-xs">
            <div><span className="font-medium">Motivo:</span> {tripDetails.trigger}</div>
            {typeof tripDetails.renderCount === 'number' ? (
              <div><span className="font-medium">Renders:</span> {tripDetails.renderCount} / {tripDetails.windowMs}ms</div>
            ) : null}
            {tripDetails.errorMessage ? (
              <div className="mt-1"><span className="font-medium">Erro:</span> {tripDetails.errorMessage}</div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full"
          >
            Recarregar agora
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={reset}
            className="w-full"
          >
            Tentar recuperar
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LoopPreventionBoundary;
