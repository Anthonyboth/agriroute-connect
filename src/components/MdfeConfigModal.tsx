import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Save, AlertCircle, FileText } from 'lucide-react';
import { useMdfeConfig, type MdfeConfig } from '@/hooks/useMdfeConfig';

interface MdfeConfigModalProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  onConfigSaved?: () => void;
}

export const MdfeConfigModal: React.FC<MdfeConfigModalProps> = ({ 
  open, 
  onClose, 
  userId,
  onConfigSaved 
}) => {
  const { config, loading: loadingConfig, saveConfig } = useMdfeConfig(userId);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState<Omit<MdfeConfig, 'id' | 'created_at' | 'updated_at'>>({
    user_id: userId,
    cnpj: '',
    inscricao_estadual: '',
    rntrc: '',
    razao_social: '',
    nome_fantasia: '',
    logradouro: '',
    numero: '',
    bairro: '',
    municipio: '',
    uf: '',
    cep: '',
    serie_mdfe: '1',
  });

  // Carregar config existente quando modal abrir
  useEffect(() => {
    if (open && config) {
      setFormData({
        user_id: config.user_id,
        cnpj: config.cnpj || '',
        inscricao_estadual: config.inscricao_estadual || '',
        rntrc: config.rntrc || '',
        razao_social: config.razao_social || '',
        nome_fantasia: config.nome_fantasia || '',
        logradouro: config.logradouro || '',
        numero: config.numero || '',
        bairro: config.bairro || '',
        municipio: config.municipio || '',
        uf: config.uf || '',
        cep: config.cep || '',
        serie_mdfe: config.serie_mdfe || '1',
      });
    }
  }, [open, config]);

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const formatCNPJ = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.slice(0, 14);
  };

  const formatCEP = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 5) return numbers;
    return `${numbers.slice(0, 5)}-${numbers.slice(5, 8)}`;
  };

  const validateForm = () => {
    const errors: string[] = [];
    
    if (!formData.cnpj || formData.cnpj.length !== 14) {
      errors.push('CNPJ inválido (deve ter 14 dígitos)');
    }
    
    if (!formData.inscricao_estadual) {
      errors.push('Inscrição Estadual é obrigatória');
    }
    
    if (!formData.rntrc) {
      errors.push('RNTRC é obrigatório');
    }

    return errors;
  };

  const handleSave = async () => {
    const errors = validateForm();
    if (errors.length > 0) {
      alert(errors.join('\n'));
      return;
    }

    setSaving(true);
    const result = await saveConfig(formData);
    setSaving(false);

    if (!result.error) {
      onConfigSaved?.();
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Configuração do MDFe
          </DialogTitle>
          <DialogDescription>
            Configure seus dados fiscais para emissão de Manifestos Eletrônicos de Transporte
          </DialogDescription>
        </DialogHeader>

        {loadingConfig && !config ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Campos obrigatórios:</strong> CNPJ, Inscrição Estadual e RNTRC são necessários para emitir MDFe
              </AlertDescription>
            </Alert>

            {/* Dados Fiscais */}
            <div className="space-y-4">
              <h4 className="font-semibold text-sm">📋 Dados Fiscais</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cnpj">CNPJ *</Label>
                  <Input
                    id="cnpj"
                    placeholder="00000000000000"
                    value={formData.cnpj}
                    onChange={(e) => handleChange('cnpj', formatCNPJ(e.target.value))}
                    maxLength={14}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="ie">Inscrição Estadual *</Label>
                  <Input
                    id="ie"
                    placeholder="000000000"
                    value={formData.inscricao_estadual}
                    onChange={(e) => handleChange('inscricao_estadual', e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rntrc">RNTRC *</Label>
                <Input
                  id="rntrc"
                  placeholder="00000000"
                  value={formData.rntrc}
                  onChange={(e) => handleChange('rntrc', e.target.value)}
                />
              </div>
            </div>

            {/* Dados da Empresa */}
            <div className="space-y-4">
              <h4 className="font-semibold text-sm">🏢 Dados da Empresa</h4>
              
              <div className="space-y-2">
                <Label htmlFor="razao_social">Razão Social</Label>
                <Input
                  id="razao_social"
                  placeholder="Nome da empresa conforme CNPJ"
                  value={formData.razao_social}
                  onChange={(e) => handleChange('razao_social', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nome_fantasia">Nome Fantasia</Label>
                <Input
                  id="nome_fantasia"
                  placeholder="Nome comercial"
                  value={formData.nome_fantasia}
                  onChange={(e) => handleChange('nome_fantasia', e.target.value)}
                />
              </div>
            </div>

            {/* Endereço */}
            <div className="space-y-4">
              <h4 className="font-semibold text-sm">📍 Endereço</h4>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="logradouro">Logradouro</Label>
                  <Input
                    id="logradouro"
                    placeholder="Rua, Avenida..."
                    value={formData.logradouro}
                    onChange={(e) => handleChange('logradouro', e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="numero">Número</Label>
                  <Input
                    id="numero"
                    placeholder="123"
                    value={formData.numero}
                    onChange={(e) => handleChange('numero', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bairro">Bairro</Label>
                  <Input
                    id="bairro"
                    placeholder="Centro"
                    value={formData.bairro}
                    onChange={(e) => handleChange('bairro', e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="cep">CEP</Label>
                  <Input
                    id="cep"
                    placeholder="00000-000"
                    value={formData.cep}
                    onChange={(e) => handleChange('cep', formatCEP(e.target.value))}
                    maxLength={9}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="municipio">Município</Label>
                  <Input
                    id="municipio"
                    placeholder="São Paulo"
                    value={formData.municipio}
                    onChange={(e) => handleChange('municipio', e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="uf">UF</Label>
                  <Input
                    id="uf"
                    placeholder="SP"
                    value={formData.uf}
                    onChange={(e) => handleChange('uf', e.target.value.toUpperCase())}
                    maxLength={2}
                  />
                </div>
              </div>
            </div>

            {/* Configurações Técnicas */}
            <div className="space-y-4">
              <h4 className="font-semibold text-sm">⚙️ Configurações Técnicas</h4>
              
              <div className="space-y-2">
                <Label htmlFor="serie_mdfe">Série MDFe</Label>
                <Input
                  id="serie_mdfe"
                  placeholder="1"
                  value={formData.serie_mdfe}
                  onChange={(e) => handleChange('serie_mdfe', e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button onClick={onClose} variant="outline" disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || loadingConfig}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Save className="h-4 w-4 mr-2" />
            Salvar Configuração
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
