import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { MapPin, Settings, AlertTriangle } from 'lucide-react';
import { isNative } from '@/utils/location';
import { Capacitor } from '@capacitor/core';

interface GPSPermissionDeniedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const GPSPermissionDeniedDialog = ({ open, onOpenChange }: GPSPermissionDeniedDialogProps) => {
  const isAndroid = isNative() && Capacitor.getPlatform() === 'android';
  const isIOS = isNative() && Capacitor.getPlatform() === 'ios';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Permissão de Localização Necessária
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 text-sm">
              <p className="text-foreground font-medium">
                O rastreamento GPS não pode funcionar sem a permissão de localização ativada.
              </p>

              {isAndroid && (
                <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                  <p className="font-semibold flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Como ativar no Android:
                  </p>
                  <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
                    <li>Abra as <strong className="text-foreground">Configurações</strong> do celular</li>
                    <li>Vá em <strong className="text-foreground">Apps</strong> ou <strong className="text-foreground">Aplicativos</strong></li>
                    <li>Encontre e toque em <strong className="text-foreground">AgriRoute</strong></li>
                    <li>Toque em <strong className="text-foreground">Permissões</strong></li>
                    <li>Toque em <strong className="text-foreground">Localização</strong></li>
                    <li>Selecione <strong className="text-foreground">"Permitir o tempo todo"</strong></li>
                  </ol>
                  <div className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 p-2 text-amber-800 dark:text-amber-200 text-xs">
                    <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>
                      Se você já negou a permissão antes, o Android <strong>não perguntará novamente</strong>. 
                      Você precisa ativar manualmente nas Configurações.
                    </span>
                  </div>
                </div>
              )}

              {isIOS && (
                <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                  <p className="font-semibold flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Como ativar no iPhone:
                  </p>
                  <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
                    <li>Abra os <strong className="text-foreground">Ajustes</strong></li>
                    <li>Vá em <strong className="text-foreground">Privacidade e Segurança</strong></li>
                    <li>Toque em <strong className="text-foreground">Serviços de Localização</strong></li>
                    <li>Encontre <strong className="text-foreground">AgriRoute</strong></li>
                    <li>Selecione <strong className="text-foreground">"Sempre"</strong></li>
                  </ol>
                </div>
              )}

              {!isNative() && (
                <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                  <p className="font-semibold flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Como ativar no navegador:
                  </p>
                  <p className="text-muted-foreground">
                    Clique no ícone de cadeado 🔒 na barra de endereço e permita o acesso à localização para este site.
                  </p>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={() => onOpenChange(false)}>
            Entendi
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
