import React from 'react';
import { Button } from '@/components/ui/button';
import { MessageCircle } from 'lucide-react';
import { openSupport, SupportContext } from '@/lib/support';

interface SupportButtonProps {
  context?: SupportContext;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
  fullWidth?: boolean;
  label?: string;
}

export const SupportButton: React.FC<SupportButtonProps> = ({
  context,
  variant = 'default',
  size = 'default',
  className = '',
  fullWidth = false,
  label = 'Falar com Suporte',
}) => {
  const handleClick = () => {
    openSupport(context);
  };

  return (
    <Button 
      variant={variant} 
      size={size}
      onClick={handleClick}
      className={`${fullWidth ? 'w-full' : ''} ${className} gap-2`}
    >
      <MessageCircle className="h-4 w-4" />
      {label}
    </Button>
  );
};

export default SupportButton;
