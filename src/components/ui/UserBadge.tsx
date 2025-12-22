import React, { memo } from 'react';
import { cn } from '@/lib/utils';
import { 
  User, 
  Truck, 
  Building2, 
  Wrench, 
  Shield,
  Users
} from 'lucide-react';

/**
 * User role types supported by the badge
 */
export type UserRole = 
  | 'PRODUTOR' 
  | 'MOTORISTA' 
  | 'TRANSPORTADORA' 
  | 'PRESTADOR_SERVICOS'
  | 'MOTORISTA_AFILIADO'
  | 'ADMIN';

/**
 * Badge size variants
 */
export type BadgeSize = 'sm' | 'md' | 'lg';

/**
 * Badge style variants
 */
export type BadgeVariant = 'filled' | 'outline' | 'subtle';

interface UserBadgeProps {
  role: UserRole;
  size?: BadgeSize;
  variant?: BadgeVariant;
  showIcon?: boolean;
  showLabel?: boolean;
  className?: string;
  customLabel?: string;
}

/**
 * Role configuration with colors and labels
 */
const ROLE_CONFIG: Record<UserRole, {
  label: string;
  icon: typeof User;
  bgColor: string;
  textColor: string;
  borderColor: string;
  subtleBg: string;
}> = {
  PRODUTOR: {
    label: 'Produtor',
    icon: User,
    bgColor: 'bg-blue-500',
    textColor: 'text-blue-600 dark:text-blue-400',
    borderColor: 'border-blue-300 dark:border-blue-600',
    subtleBg: 'bg-blue-50 dark:bg-blue-950',
  },
  MOTORISTA: {
    label: 'Motorista',
    icon: Truck,
    bgColor: 'bg-green-500',
    textColor: 'text-green-600 dark:text-green-400',
    borderColor: 'border-green-300 dark:border-green-600',
    subtleBg: 'bg-green-50 dark:bg-green-950',
  },
  TRANSPORTADORA: {
    label: 'Transportadora',
    icon: Building2,
    bgColor: 'bg-purple-500',
    textColor: 'text-purple-600 dark:text-purple-400',
    borderColor: 'border-purple-300 dark:border-purple-600',
    subtleBg: 'bg-purple-50 dark:bg-purple-950',
  },
  PRESTADOR_SERVICOS: {
    label: 'Prestador',
    icon: Wrench,
    bgColor: 'bg-orange-500',
    textColor: 'text-orange-600 dark:text-orange-400',
    borderColor: 'border-orange-300 dark:border-orange-600',
    subtleBg: 'bg-orange-50 dark:bg-orange-950',
  },
  MOTORISTA_AFILIADO: {
    label: 'Afiliado',
    icon: Users,
    bgColor: 'bg-teal-500',
    textColor: 'text-teal-600 dark:text-teal-400',
    borderColor: 'border-teal-300 dark:border-teal-600',
    subtleBg: 'bg-teal-50 dark:bg-teal-950',
  },
  ADMIN: {
    label: 'Admin',
    icon: Shield,
    bgColor: 'bg-red-500',
    textColor: 'text-red-600 dark:text-red-400',
    borderColor: 'border-red-300 dark:border-red-600',
    subtleBg: 'bg-red-50 dark:bg-red-950',
  },
};

/**
 * Size configurations
 */
const SIZE_CONFIG: Record<BadgeSize, {
  container: string;
  icon: string;
  text: string;
}> = {
  sm: {
    container: 'px-2 py-0.5 gap-1',
    icon: 'h-3 w-3',
    text: 'text-xs',
  },
  md: {
    container: 'px-2.5 py-1 gap-1.5',
    icon: 'h-4 w-4',
    text: 'text-sm',
  },
  lg: {
    container: 'px-3 py-1.5 gap-2',
    icon: 'h-5 w-5',
    text: 'text-base',
  },
};

/**
 * Unified UserBadge component
 * Displays user role with consistent styling across the application
 * WCAG AA compliant colors with proper contrast
 */
export const UserBadge = memo(function UserBadge({
  role,
  size = 'md',
  variant = 'subtle',
  showIcon = true,
  showLabel = true,
  className,
  customLabel,
}: UserBadgeProps) {
  const config = ROLE_CONFIG[role] || ROLE_CONFIG.PRODUTOR;
  const sizeConfig = SIZE_CONFIG[size];
  const Icon = config.icon;

  const variantClasses = {
    filled: cn(config.bgColor, 'text-white'),
    outline: cn('bg-transparent border', config.borderColor, config.textColor),
    subtle: cn(config.subtleBg, config.textColor, 'border', config.borderColor),
  };

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full whitespace-nowrap transition-colors',
        sizeConfig.container,
        variantClasses[variant],
        className
      )}
    >
      {showIcon && <Icon className={cn(sizeConfig.icon, 'flex-shrink-0')} />}
      {showLabel && (
        <span className={sizeConfig.text}>
          {customLabel || config.label}
        </span>
      )}
    </span>
  );
});

/**
 * Helper function to get role label
 */
export function getRoleLabel(role: UserRole): string {
  return ROLE_CONFIG[role]?.label || 'Usuário';
}

/**
 * Helper function to get role icon component
 */
export function getRoleIcon(role: UserRole): typeof User {
  return ROLE_CONFIG[role]?.icon || User;
}

/**
 * Helper to check if a string is a valid UserRole
 */
export function isValidRole(role: string): role is UserRole {
  return role in ROLE_CONFIG;
}

export default UserBadge;
