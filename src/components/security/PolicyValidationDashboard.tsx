import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PolicyViolation {
  object_type: string;
  object_name: string;
  violation_type: string;
  violation_details: string;
  recommendation: string;
}

export const PolicyValidationDashboard = () => {
  const [violations, setViolations] = useState<PolicyViolation[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const runValidation = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('scan_policies_for_role_references');
      
      if (error) throw error;
      
      setViolations(data || []);
      
      if (data && data.length > 0) {
        toast({
          title: '⚠️ Violações Detectadas',
          description: `Encontradas ${data.length} referências a profiles.role que devem ser corrigidas`,
          variant: 'destructive'
        });
      } else {
        toast({
          title: '✅ Validação Completa',
          description: 'Nenhuma violação encontrada. Todas as policies estão corretas!',
        });
      }
    } catch (error: any) {
      console.error('[PolicyValidation] Error:', error);
      toast({
        title: 'Erro na Validação',
        description: error.message || 'Não foi possível executar a validação',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="space-y-2">
        <CardTitle className="flex items-center gap-2 text-foreground">
          🔍 Validação de Políticas RLS
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Verifica se existem policies usando profiles.role em vez de has_role()
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={runValidation} 
          disabled={loading}
          className="w-full sm:w-auto"
          variant="default"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Escaneando...
            </>
          ) : (
            <>
              🔎 Executar Validação
            </>
          )}
        </Button>
        
        {violations.length === 0 && !loading && (
          <Alert className="border-success bg-success/10">
            <CheckCircle className="h-4 w-4 text-success" />
            <AlertTitle className="text-success">✅ Todas as 17 Políticas Migradas!</AlertTitle>
            <AlertDescription className="text-success/80">
              Todas as políticas RLS foram migradas para usar has_role() com a tabela user_roles.
              O sistema agora usa os roles: admin, driver, producer, service_provider, carrier, affiliated_driver.
            </AlertDescription>
          </Alert>
        )}
        
        {violations.length > 0 && (
          <div className="space-y-3">
            <Alert variant="destructive" className="border-destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>❌ {violations.length} Violações Encontradas</AlertTitle>
              <AlertDescription>
                As seguintes policies e funções precisam ser corrigidas para usar has_role():
              </AlertDescription>
            </Alert>
            
            {violations.map((v, i) => (
              <Alert key={i} variant="destructive" className="border-destructive/50">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle className="text-destructive font-mono text-xs">
                  {v.object_type}: {v.object_name}
                </AlertTitle>
                <AlertDescription className="space-y-2">
                  <div className="bg-destructive/10 p-2 rounded font-mono text-xs overflow-x-auto">
                    {v.violation_details.substring(0, 200)}
                    {v.violation_details.length > 200 && '...'}
                  </div>
                  <div className="text-sm text-foreground mt-2 flex items-start gap-2">
                    <span className="text-success">✅</span>
                    <span className="flex-1">{v.recommendation}</span>
                  </div>
                </AlertDescription>
              </Alert>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
