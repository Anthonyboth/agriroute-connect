import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Building2, Users, Truck } from 'lucide-react';
import { toast } from 'sonner';

interface TransportCompanyFormProps {
  profileData: any;
  onProfileDataChange: (data: any) => void;
}

export const TransportCompanyForm: React.FC<TransportCompanyFormProps> = ({
  profileData,
  onProfileDataChange
}) => {
  const [isTransportCompany, setIsTransportCompany] = useState(
    profileData.is_transport_company || false
  );

  const handleToggleTransportCompany = (checked: boolean) => {
    setIsTransportCompany(checked);
    onProfileDataChange({
      ...profileData,
      is_transport_company: checked,
      company_name: checked ? profileData.company_name : '',
      company_cnpj: checked ? profileData.company_cnpj : '',
      fleet_size: checked ? profileData.fleet_size : 0,
      company_description: checked ? profileData.company_description : ''
    });
  };

  return (
    <div className="space-y-6">
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Transportadora
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="transport-company"
              checked={isTransportCompany}
              onCheckedChange={handleToggleTransportCompany}
            />
            <Label htmlFor="transport-company" className="text-sm font-medium">
              Sou uma transportadora com múltiplos veículos e motoristas
            </Label>
          </div>

          {isTransportCompany && (
            <div className="space-y-4 pt-4 border-t">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company_name">
                    Nome da Transportadora *
                  </Label>
                  <Input
                    id="company_name"
                    value={profileData.company_name || ''}
                    onChange={(e) => onProfileDataChange({
                      ...profileData,
                      company_name: e.target.value
                    })}
                    placeholder="Ex: Transportes ABC Ltda"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company_cnpj">
                    CNPJ da Transportadora *
                  </Label>
                  <Input
                    id="company_cnpj"
                    value={profileData.company_cnpj || ''}
                    onChange={(e) => onProfileDataChange({
                      ...profileData,
                      company_cnpj: e.target.value
                    })}
                    placeholder="00.000.000/0000-00"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fleet_size">
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4" />
                    Tamanho da Frota (número de veículos)
                  </div>
                </Label>
                <Input
                  id="fleet_size"
                  type="number"
                  min="1"
                  value={profileData.fleet_size || ''}
                  onChange={(e) => onProfileDataChange({
                    ...profileData,
                    fleet_size: parseInt(e.target.value) || 0
                  })}
                  placeholder="Ex: 15"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="company_description">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Descrição da Transportadora
                  </div>
                </Label>
                <Textarea
                  id="company_description"
                  value={profileData.company_description || ''}
                  onChange={(e) => onProfileDataChange({
                    ...profileData,
                    company_description: e.target.value
                  })}
                  placeholder="Descreva sua transportadora, tipos de carga, regiões de atuação..."
                  rows={3}
                />
              </div>

              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <h4 className="font-medium text-blue-900 mb-2">Vantagens para Transportadoras:</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Gerencie múltiplos motoristas e veículos</li>
                    <li>• Visibilidade de todos os fretes da frota</li>
                    <li>• Relatórios consolidados de performance</li>
                    <li>• Ferramentas de gestão avançadas</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TransportCompanyForm;