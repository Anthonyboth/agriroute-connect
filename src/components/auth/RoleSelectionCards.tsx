/**
 * RoleSelectionCards - Componente de seleção de tipo de conta via CARDS
 * 
 * Este é o componente ÚNICO para seleção de role em todo o app.
 * Usa a fonte única de verdade de src/lib/user-roles.ts
 * 
 * IMPORTANTE: Este componente substitui QUALQUER dropdown/select de "Tipo de Usuário"
 */

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { USER_ROLES, type CardSelectableRole } from '@/lib/user-roles';

interface RoleSelectionCardsProps {
  /** Role atualmente selecionado */
  selectedRole: CardSelectableRole | null;
  /** Callback quando um role é selecionado */
  onRoleSelect: (role: CardSelectableRole) => void;
  /** Callback quando o usuário clica em "Continuar" */
  onContinue: () => void;
  /** Label opcional para o título */
  title?: string;
  /** Descrição opcional */
  description?: string;
  /** Texto do botão de continuar */
  continueButtonText?: string;
  /** Se deve mostrar o botão de continuar */
  showContinueButton?: boolean;
}

export function RoleSelectionCards({
  selectedRole,
  onRoleSelect,
  onContinue,
  title = 'Escolha o tipo de conta',
  description = 'Selecione o perfil que melhor se encaixa com você',
  continueButtonText = 'Continuar',
  showContinueButton = true,
}: RoleSelectionCardsProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label className="text-base font-semibold">{title}</Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {USER_ROLES.map((role) => {
          const IconComponent = role.icon;
          const isSelected = selectedRole === role.value;
          
          return (
            <Card
              key={role.value}
              className={`cursor-pointer transition-all duration-200 ${
                isSelected
                  ? 'ring-2 ring-primary bg-primary/5 shadow-md'
                  : 'hover:bg-muted/50 hover:shadow-sm border-border'
              }`}
              onClick={() => onRoleSelect(role.value as CardSelectableRole)}
            >
              <CardContent className="flex flex-col items-center justify-center p-4 text-center">
                <div
                  className={`mb-2 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}
                >
                  <IconComponent className="h-6 w-6" />
                </div>
                <span className="text-sm font-medium">{role.label}</span>
                <span className="text-xs text-muted-foreground mt-1">{role.description}</span>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {showContinueButton && (
        <Button
          type="button"
          onClick={onContinue}
          disabled={!selectedRole}
          className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {continueButtonText}
        </Button>
      )}
    </div>
  );
}

export default RoleSelectionCards;
