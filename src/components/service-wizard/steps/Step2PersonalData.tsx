import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ServiceFormData, ServiceType } from '../types';
import { User, Phone, Mail, FileText } from 'lucide-react';

interface Step2Props {
  formData: ServiceFormData;
  onUpdate: (field: string, value: any) => void;
  serviceType: ServiceType;
}

export const Step2PersonalData: React.FC<Step2Props> = ({ formData, onUpdate, serviceType }) => {
  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const formatDocument = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      // CPF
      if (numbers.length <= 3) return numbers;
      if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
      if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
      return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9)}`;
    } else {
      // CNPJ
      if (numbers.length <= 2) return numbers;
      if (numbers.length <= 5) return `${numbers.slice(0, 2)}.${numbers.slice(2)}`;
      if (numbers.length <= 8) return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5)}`;
      if (numbers.length <= 12) return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}/${numbers.slice(8)}`;
      return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}/${numbers.slice(8, 12)}-${numbers.slice(12, 14)}`;
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name" className="flex items-center gap-2">
          <User className="h-4 w-4" />
          Nome Completo *
        </Label>
        <Input
          id="name"
          value={formData.personal.name}
          onChange={(e) => onUpdate('personal.name', e.target.value)}
          placeholder="Seu nome completo"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone" className="flex items-center gap-2">
          <Phone className="h-4 w-4" />
          WhatsApp *
        </Label>
        <Input
          id="phone"
          value={formData.personal.phone}
          onChange={(e) => onUpdate('personal.phone', formatPhone(e.target.value))}
          placeholder="(11) 99999-9999"
          maxLength={15}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email" className="flex items-center gap-2">
          <Mail className="h-4 w-4" />
          E-mail (opcional)
        </Label>
        <Input
          id="email"
          type="email"
          value={formData.personal.email}
          onChange={(e) => onUpdate('personal.email', e.target.value)}
          placeholder="seu@email.com"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="document" className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          CPF ou CNPJ *
        </Label>
        <Input
          id="document"
          value={formData.personal.document}
          onChange={(e) => onUpdate('personal.document', formatDocument(e.target.value))}
          placeholder="000.000.000-00 ou 00.000.000/0000-00"
          maxLength={18}
        />
      </div>

      {(serviceType === 'SERVICO_AGRICOLA' || serviceType === 'SERVICO_TECNICO') && (
        <div className="space-y-2">
          <Label htmlFor="profession">
            Profissão/Cargo (opcional)
          </Label>
          <Input
            id="profession"
            value={formData.personal.profession || ''}
            onChange={(e) => onUpdate('personal.profession', e.target.value)}
            placeholder="Ex: Produtor Rural, Gerente, Técnico..."
          />
        </div>
      )}
    </div>
  );
};
