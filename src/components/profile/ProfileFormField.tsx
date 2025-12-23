import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface ProfileFormFieldProps {
  label: string;
  name: string;
  type?: 'text' | 'email' | 'tel' | 'number' | 'textarea';
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  error?: string;
}

export const ProfileFormField: React.FC<ProfileFormFieldProps> = ({
  label,
  name,
  type = 'text',
  value,
  defaultValue,
  placeholder,
  required,
  disabled,
  className,
  onChange,
  error
}) => {
  const inputId = `field-${name}`;
  
  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={inputId} className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      
      {type === 'textarea' ? (
        <Textarea
          id={inputId}
          name={name}
          value={value}
          defaultValue={defaultValue}
          placeholder={placeholder}
          disabled={disabled}
          onChange={onChange}
          className={cn(
            'min-h-[100px] resize-none',
            error && 'border-destructive focus-visible:ring-destructive'
          )}
        />
      ) : (
        <Input
          id={inputId}
          name={name}
          type={type}
          value={value}
          defaultValue={defaultValue}
          placeholder={placeholder}
          disabled={disabled}
          onChange={onChange}
          className={cn(
            error && 'border-destructive focus-visible:ring-destructive'
          )}
        />
      )}
      
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
};
