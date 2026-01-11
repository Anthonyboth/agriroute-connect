import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { FileText, Loader2, CheckCircle2 } from 'lucide-react';
import { useFiscal } from '@/hooks/useFiscal';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CTeEmitirDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  freightId: string;
  onSuccess?: () => void;
}

interface EmpresaFiscal {
  id: string;
  cnpj: string;
  razao_social: string;
  nome_fantasia: string | null;
  ambiente_fiscal: string;
}

interface NFeVinculada {
  id: string;
  access_key: string;
  number: string;
  issuer_name: string;
  selected: boolean;
}

export function CTeEmitirDialog({ 
  open, 
  onOpenChange, 
  freightId,
  onSuccess 
}: CTeEmitirDialogProps) {
  const { loading, emitirCTe } = useFiscal();
  const [empresas, setEmpresas] = useState<EmpresaFiscal[]>([]);
  const [empresaId, setEmpresaId] = useState<string>('');
  const [nfes, setNfes] = useState<NFeVinculada[]>([]);
  const [loadingEmpresas, setLoadingEmpresas] = useState(false);

  useEffect(() => {
    if (open) {
      loadEmpresas();
      loadNfes();
    }
  }, [open, freightId]);

  const loadEmpresas = async () => {
    setLoadingEmpresas(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!profile) return;

      // Buscar empresas fiscais via transport_companies
      const { data: companies } = await supabase
        .from('transport_companies')
        .select('id')
        .eq('profile_id', profile.id);

      if (!companies?.length) {
        toast.warning('Você não possui transportadoras cadastradas');
        return;
      }

      const companyIds = companies.map(c => c.id);

      const { data: empresasData } = await supabase
        .from('empresas_fiscais')
        .select('id, cnpj, razao_social, nome_fantasia, ambiente_fiscal')
        .in('transport_company_id', companyIds)
        .eq('ativo', true);

      setEmpresas(empresasData || []);
      
      if (empresasData?.length === 1) {
        setEmpresaId(empresasData[0].id);
      }
    } catch (error) {
      console.error('Erro ao carregar empresas:', error);
    } finally {
      setLoadingEmpresas(false);
    }
  };

  const loadNfes = async () => {
    try {
      const { data: nfesData } = await supabase
        .from('nfe_documents')
        .select('id, access_key, number, issuer_name')
        .eq('freight_id', freightId)
        .eq('manifestation_type', 'confirmed');

      if (nfesData) {
        setNfes(nfesData.map((nfe) => ({
          id: nfe.id,
          access_key: nfe.access_key,
          number: nfe.number,
          issuer_name: nfe.issuer_name,
          selected: true,
        })));
      }
    } catch (error) {
      console.error('Erro ao carregar NF-es:', error);
    }
  };

  const toggleNfe = (id: string) => {
    setNfes(prev => prev.map(nfe => 
      nfe.id === id ? { ...nfe, selected: !nfe.selected } : nfe
    ));
  };

  const handleEmitir = async () => {
    if (!empresaId) {
      toast.error('Selecione uma empresa fiscal');
      return;
    }

    const nfeChaves = nfes.filter(n => n.selected).map(n => n.access_key);
    
    const result = await emitirCTe(freightId, empresaId, nfeChaves);
    
    if (result) {
      onSuccess?.();
      onOpenChange(false);
    }
  };

  const empresaSelecionada = empresas.find(e => e.id === empresaId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Emitir CT-e
          </DialogTitle>
          <DialogDescription>
            Emita o Conhecimento de Transporte Eletrônico para este frete
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Seleção de Empresa */}
          <div className="space-y-2">
            <Label>Empresa Emitente</Label>
            {loadingEmpresas ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando empresas...
              </div>
            ) : empresas.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma empresa fiscal cadastrada. Configure uma empresa antes de emitir CT-e.
              </p>
            ) : (
              <Select value={empresaId} onValueChange={setEmpresaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a empresa" />
                </SelectTrigger>
                <SelectContent>
                  {empresas.map((empresa) => (
                    <SelectItem key={empresa.id} value={empresa.id}>
                      <div className="flex items-center gap-2">
                        <span>{empresa.nome_fantasia || empresa.razao_social}</span>
                        <Badge variant="outline" className="text-xs">
                          {empresa.ambiente_fiscal === 'producao' ? 'Produção' : 'Homologação'}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {empresaSelecionada && (
              <p className="text-xs text-muted-foreground">
                CNPJ: {empresaSelecionada.cnpj}
              </p>
            )}
          </div>

          {/* NF-es Vinculadas */}
          {nfes.length > 0 && (
            <div className="space-y-2">
              <Label>NF-es Vinculadas</Label>
              <ScrollArea className="h-[150px] rounded-md border p-2">
                {nfes.map((nfe) => (
                  <div
                    key={nfe.id}
                    className="flex items-center space-x-2 py-2"
                  >
                    <Checkbox
                      id={nfe.id}
                      checked={nfe.selected}
                      onCheckedChange={() => toggleNfe(nfe.id)}
                    />
                    <label
                      htmlFor={nfe.id}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex-1"
                    >
                      <span>NF-e {nfe.number}</span>
                      <span className="text-muted-foreground ml-2">
                        ({nfe.issuer_name})
                      </span>
                    </label>
                  </div>
                ))}
              </ScrollArea>
              <p className="text-xs text-muted-foreground">
                {nfes.filter(n => n.selected).length} de {nfes.length} NF-es selecionadas
              </p>
            </div>
          )}

          {/* Aviso de ambiente */}
          {empresaSelecionada?.ambiente_fiscal === 'homologacao' && (
            <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/30 p-3">
              <p className="text-sm text-yellow-700 dark:text-yellow-400">
                <strong>Atenção:</strong> Esta emissão será realizada em ambiente de homologação (testes).
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleEmitir} 
            disabled={loading || !empresaId || empresas.length === 0}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Emitindo...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Emitir CT-e
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
