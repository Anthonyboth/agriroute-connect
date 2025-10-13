import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTransportCompany } from '@/hooks/useTransportCompany';
import { Loader2, Building2 } from 'lucide-react';

interface BecomeCompanyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const BecomeCompanyModal: React.FC<BecomeCompanyModalProps> = ({
  open,
  onOpenChange,
}) => {
  const { createCompany } = useTransportCompany();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    company_name: '',
    company_cnpj: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    antt_registration: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await createCompany(formData);
      onOpenChange(false);
      setFormData({
        company_name: '',
        company_cnpj: '',
        address: '',
        city: '',
        state: '',
        zip_code: '',
        antt_registration: '',
      });
    } catch (error) {
      console.error('Erro ao criar transportadora:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Tornar-se Transportadora
          </DialogTitle>
          <DialogDescription>
            Preencha os dados da sua transportadora para começar a gerenciar motoristas e fretes
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="company_name">Nome da Empresa *</Label>
            <Input
              id="company_name"
              value={formData.company_name}
              onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
              required
              placeholder="Ex: Transportadora XYZ Ltda"
            />
          </div>

          <div>
            <Label htmlFor="company_cnpj">CNPJ *</Label>
            <Input
              id="company_cnpj"
              value={formData.company_cnpj}
              onChange={(e) => setFormData({ ...formData, company_cnpj: e.target.value })}
              required
              placeholder="00.000.000/0000-00"
              maxLength={18}
            />
          </div>

          <div>
            <Label htmlFor="antt_registration">Registro ANTT</Label>
            <Input
              id="antt_registration"
              value={formData.antt_registration}
              onChange={(e) => setFormData({ ...formData, antt_registration: e.target.value })}
              placeholder="Número do registro ANTT"
            />
          </div>

          <div>
            <Label htmlFor="address">Endereço</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Rua, número, complemento"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="city">Cidade</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="Cidade"
              />
            </div>

            <div>
              <Label htmlFor="state">Estado</Label>
              <Input
                id="state"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                placeholder="UF"
                maxLength={2}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="zip_code">CEP</Label>
            <Input
              id="zip_code"
              value={formData.zip_code}
              onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
              placeholder="00000-000"
              maxLength={9}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : (
                'Criar Transportadora'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
