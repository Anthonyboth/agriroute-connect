/**
 * ProfileInfoCard.tsx
 * 
 * Card de informações pessoais estilo Facebook.
 * Suporta modo visualização e edição com transição suave.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { User, Phone, Mail, FileText, Building2, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FieldConfig {
  name: string;
  label: string;
  icon?: React.ReactNode;
  type?: 'text' | 'tel' | 'email' | 'textarea';
  placeholder?: string;
  readOnly?: boolean;
  span?: 1 | 2;
}

interface ProfileInfoCardProps {
  title: string;
  icon?: React.ReactNode;
  fields: FieldConfig[];
  data: Record<string, string>;
  isEditing: boolean;
  onChange: (name: string, value: string) => void;
  className?: string;
}

export const ProfileInfoCard: React.FC<ProfileInfoCardProps> = ({
  title,
  icon,
  fields,
  data,
  isEditing,
  onChange,
  className
}) => {
  return (
    <Card className={cn("transition-all duration-200", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {fields.map((field) => (
            <div 
              key={field.name} 
              className={cn(
                "space-y-1.5",
                field.span === 2 && "sm:col-span-2"
              )}
            >
              <Label 
                htmlFor={`field-${field.name}`}
                className="text-sm font-medium text-muted-foreground flex items-center gap-1.5"
              >
                {field.icon}
                {field.label}
              </Label>
              
              {isEditing && !field.readOnly ? (
                field.type === 'textarea' ? (
                  <Textarea
                    id={`field-${field.name}`}
                    value={data[field.name] || ''}
                    onChange={(e) => onChange(field.name, e.target.value)}
                    placeholder={field.placeholder || `Digite ${field.label.toLowerCase()}`}
                    className="min-h-[80px] resize-none transition-all duration-200"
                  />
                ) : (
                  <Input
                    id={`field-${field.name}`}
                    type={field.type || 'text'}
                    value={data[field.name] || ''}
                    onChange={(e) => onChange(field.name, e.target.value)}
                    placeholder={field.placeholder || `Digite ${field.label.toLowerCase()}`}
                    className="transition-all duration-200"
                  />
                )
              ) : (
                <p className={cn(
                  "text-sm py-2 px-3 rounded-md min-h-[40px] flex items-center",
                  "bg-muted/30 text-foreground",
                  !data[field.name] && "text-muted-foreground italic"
                )}>
                  {data[field.name] || 'Não informado'}
                </p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// Configurações de campos padrão para reutilização
export const personalInfoFields: FieldConfig[] = [
  { 
    name: 'full_name', 
    label: 'Nome Completo', 
    icon: <User className="h-3.5 w-3.5" />,
    span: 2
  },
  { 
    name: 'phone', 
    label: 'Telefone WhatsApp', 
    icon: <Phone className="h-3.5 w-3.5" />,
    type: 'tel'
  },
  { 
    name: 'contact_phone', 
    label: 'Telefone de Contato', 
    icon: <Phone className="h-3.5 w-3.5" />,
    type: 'tel'
  },
  { 
    name: 'cpf_cnpj', 
    label: 'CPF/CNPJ', 
    icon: <FileText className="h-3.5 w-3.5" />,
    readOnly: true
  },
];

export const producerFields: FieldConfig[] = [
  { 
    name: 'farm_name', 
    label: 'Nome da Fazenda', 
    icon: <Building2 className="h-3.5 w-3.5" />
  },
  { 
    name: 'farm_address', 
    label: 'Endereço da Fazenda', 
    icon: <MapPin className="h-3.5 w-3.5" />
  },
];

export const driverFields: FieldConfig[] = [
  { 
    name: 'cooperative', 
    label: 'Cooperativa', 
    icon: <Building2 className="h-3.5 w-3.5" />
  },
  { 
    name: 'rntrc', 
    label: 'RNTRC', 
    icon: <FileText className="h-3.5 w-3.5" />,
    readOnly: true
  },
];

export const emergencyFields: FieldConfig[] = [
  { 
    name: 'emergency_contact_name', 
    label: 'Nome do Contato', 
    icon: <User className="h-3.5 w-3.5" />
  },
  { 
    name: 'emergency_contact_phone', 
    label: 'Telefone de Emergência', 
    icon: <Phone className="h-3.5 w-3.5" />,
    type: 'tel'
  },
];
