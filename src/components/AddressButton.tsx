import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MapPin, Edit } from 'lucide-react';
import { DetailedAddressModal } from './DetailedAddressModal';

interface AddressData {
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  reference: string;
  fullAddress: string;
  lat?: number;
  lng?: number;
}

interface AddressButtonProps {
  label: string;
  value?: string;
  onAddressChange: (address: string, lat?: number, lng?: number) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

export const AddressButton: React.FC<AddressButtonProps> = ({
  label,
  value = '',
  onAddressChange,
  placeholder = "Clique para preencher endereço",
  required = false,
  className = ''
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [savedAddress, setSavedAddress] = useState<AddressData | null>(null);

  const handleSaveAddress = (addressData: AddressData) => {
    setSavedAddress(addressData);
    onAddressChange(addressData.fullAddress, addressData.lat, addressData.lng);
  };

  const hasAddress = value && value.trim().length > 0;

  return (
    <>
      <div className={`space-y-2 ${className}`}>
        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {label} {required && <span className="text-destructive">*</span>}
        </label>
        
        <Button
          type="button"
          variant={hasAddress ? "outline" : "secondary"}
          className={`w-full justify-start h-auto p-4 ${hasAddress ? 'bg-background' : 'bg-muted'}`}
          onClick={() => setIsModalOpen(true)}
        >
          <div className="flex items-start gap-3 w-full">
            <div className="mt-0.5">
              {hasAddress ? (
                <Edit className="h-4 w-4 text-primary" />
              ) : (
                <MapPin className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            
            <div className="flex-1 text-left">
              {hasAddress ? (
                <div className="space-y-1">
                  <div className="text-sm font-medium">
                    {savedAddress?.street && savedAddress?.number 
                      ? `${savedAddress.street}, ${savedAddress.number}`
                      : value.split(',')[0]
                    }
                  </div>
                  <div className="text-xs text-muted-foreground line-clamp-2">
                    {value}
                  </div>
                  {savedAddress?.reference && (
                    <div className="text-xs text-muted-foreground italic">
                      Ref: {savedAddress.reference}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  {placeholder}
                </div>
              )}
            </div>
          </div>
        </Button>
      </div>

      <DetailedAddressModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveAddress}
        title={`Preencher ${label}`}
        initialData={{
          fullAddress: value,
          ...savedAddress
        }}
      />
    </>
  );
};