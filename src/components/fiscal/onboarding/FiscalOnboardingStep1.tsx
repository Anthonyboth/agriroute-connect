import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { User, Building, Building2, ArrowRight } from 'lucide-react';
import { IssuerType, RegisterIssuerData } from '@/hooks/useFiscalIssuer';

interface FiscalOnboardingStep1Props {
  data: Partial<RegisterIssuerData>;
  onUpdate: (updates: Partial<RegisterIssuerData>) => void;
  onNext: () => void;
}

const ISSUER_TYPES = [
  {
    value: 'CPF' as IssuerType,
    title: 'Pessoa Física (CPF)',
    description: 'Motorista autônomo ou transportador individual',
    icon: User,
  },
  {
    value: 'MEI' as IssuerType,
    title: 'MEI',
    description: 'Microempreendedor Individual',
    icon: Building,
  },
  {
    value: 'CNPJ' as IssuerType,
    title: 'Pessoa Jurídica (CNPJ)',
    description: 'Empresa, transportadora ou cooperativa',
    icon: Building2,
  },
];

export function FiscalOnboardingStep1({ data, onUpdate, onNext }: FiscalOnboardingStep1Props) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Selecione o tipo de emissor</h3>
        <p className="text-muted-foreground text-sm mt-1">
          Escolha o tipo de documento que será usado para emissão de NF-e
        </p>
      </div>

      <RadioGroup
        value={data.issuer_type}
        onValueChange={(value) => onUpdate({ issuer_type: value as IssuerType })}
        className="space-y-4"
      >
        {ISSUER_TYPES.map((type) => {
          const Icon = type.icon;
          const isSelected = data.issuer_type === type.value;
          
          return (
            <Card
              key={type.value}
              className={`cursor-pointer transition-all ${
                isSelected
                  ? 'border-primary ring-2 ring-primary/20'
                  : 'hover:border-muted-foreground/50'
              }`}
              onClick={() => onUpdate({ issuer_type: type.value })}
            >
              <CardContent className="flex items-center gap-4 p-4">
                <RadioGroupItem value={type.value} id={type.value} className="sr-only" />
                <div
                  className={`p-3 rounded-full ${
                    isSelected ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <Label
                    htmlFor={type.value}
                    className="text-base font-medium cursor-pointer"
                  >
                    {type.title}
                  </Label>
                  <p className="text-sm text-muted-foreground">{type.description}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </RadioGroup>

      <div className="pt-4">
        <Button onClick={onNext} className="w-full">
          Continuar
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
