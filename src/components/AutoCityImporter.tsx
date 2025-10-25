import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

export function AutoCityImporter() {
  const [status, setStatus] = useState<'importing' | 'success' | 'error'>('importing');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    const importCities = async () => {
      try {
        console.log('🚀 Iniciando importação automática de TODAS as cidades brasileiras...');
        
        // Simular progresso enquanto importa
        const progressInterval = setInterval(() => {
          setProgress(prev => Math.min(prev + 2, 95));
        }, 1000);

        const { data, error } = await supabase.functions.invoke('import-cities', {
          body: { state: 'ALL' }
        });

        clearInterval(progressInterval);
        setProgress(100);

        if (error) {
          console.error('❌ Erro na importação:', error);
          setStatus('error');
          toast.error('Erro ao importar cidades', {
            description: error.message
          });
          return;
        }

        console.log('✅ Importação concluída:', data);
        setResult(data);
        setStatus('success');
        
        toast.success('Importação completa!', {
          description: `${data.totalImported || data.imported || 0} cidades importadas com sucesso`
        });

        // Auto-remover após 5 segundos
        setTimeout(() => {
          const element = document.getElementById('auto-city-importer');
          if (element) element.style.display = 'none';
        }, 5000);

      } catch (err: any) {
        console.error('❌ Erro fatal na importação:', err);
        setStatus('error');
        toast.error('Erro fatal ao importar cidades', {
          description: err.message
        });
      }
    };

    importCities();
  }, []);

  if (status === 'success' && !result) return null;

  return (
    <Card id="auto-city-importer" className="border-primary/50 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {status === 'importing' && <Loader2 className="h-5 w-5 animate-spin" />}
          {status === 'success' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
          {status === 'error' && <AlertCircle className="h-5 w-5 text-destructive" />}
          Importação de Cidades
        </CardTitle>
        <CardDescription>
          {status === 'importing' && 'Importando todas as 5.570 cidades brasileiras da API do IBGE...'}
          {status === 'success' && 'Importação concluída com sucesso!'}
          {status === 'error' && 'Erro durante a importação. Verifique os logs.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status === 'importing' && (
          <>
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-muted-foreground">
              Progresso: {progress}% - Isso pode levar 2-4 minutos...
            </p>
          </>
        )}
        
        {status === 'success' && result && (
          <div className="space-y-2 text-sm">
            <p className="font-medium text-green-600">
              ✅ {result.totalImported || result.imported || 0} cidades importadas
            </p>
            {result.totalErrors > 0 && (
              <p className="text-amber-600">
                ⚠️ {result.totalErrors} erros durante a importação
              </p>
            )}
            <p className="text-muted-foreground">
              Estados processados: {result.states || 27}
            </p>
            <p className="text-xs text-muted-foreground mt-4">
              Este painel será removido automaticamente em 5 segundos...
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
