import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MapPin, Navigation } from 'lucide-react';
import { toast } from 'sonner';
import GoogleMap from '@/components/GoogleMap';

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

interface DetailedAddressModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (addressData: AddressData) => void;
  title: string;
  initialData?: Partial<AddressData>;
}

export const DetailedAddressModal: React.FC<DetailedAddressModalProps> = ({
  isOpen,
  onClose,
  onSave,
  title,
  initialData
}) => {
  const [addressData, setAddressData] = useState<AddressData>({
    street: '',
    number: '',
    neighborhood: '',
    city: '',
    state: '',
    zipCode: '',
    reference: '',
    fullAddress: '',
    lat: undefined,
    lng: undefined
  });

  const [mapCenter, setMapCenter] = useState({ lat: -14.235004, lng: -51.92528 }); // Centro do Brasil
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (initialData) {
      setAddressData(prev => ({ ...prev, ...initialData }));
      if (initialData.lat && initialData.lng) {
        setMapCenter({ lat: initialData.lat, lng: initialData.lng });
        setSelectedLocation({ lat: initialData.lat, lng: initialData.lng });
      }
    }
  }, [initialData, isOpen]);

  const updateFullAddress = (data: AddressData) => {
    const parts = [
      data.street && data.number ? `${data.street}, ${data.number}` : data.street,
      data.neighborhood,
      data.city,
      data.state,
      data.zipCode
    ].filter(Boolean);
    
    return parts.join(', ');
  };

  const handleInputChange = (field: keyof AddressData, value: string) => {
    const newData = { ...addressData, [field]: value };
    newData.fullAddress = updateFullAddress(newData);
    setAddressData(newData);
  };

  const handleUseCurrentLocation = async () => {
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        });
      });

      const { latitude, longitude } = position.coords;
      setMapCenter({ lat: latitude, lng: longitude });
      setSelectedLocation({ lat: latitude, lng: longitude });
      
      setAddressData(prev => ({
        ...prev,
        lat: latitude,
        lng: longitude
      }));

      toast.success('Localização atual definida no mapa!');
    } catch (error) {
      toast.error('Erro ao obter localização atual');
    }
  };

  const handleMapClick = (lat: number, lng: number) => {
    setSelectedLocation({ lat, lng });
    setAddressData(prev => ({
      ...prev,
      lat,
      lng
    }));
    toast.success('Localização selecionada no mapa!');
  };

  const handleSave = () => {
    if (!addressData.street || !addressData.city || !addressData.state) {
      toast.error('Preencha pelo menos rua, cidade e estado');
      return;
    }

    const finalData = {
      ...addressData,
      fullAddress: updateFullAddress(addressData)
    };

    onSave(finalData);
    onClose();
  };

  const handleReset = () => {
    setAddressData({
      street: '',
      number: '',
      neighborhood: '',
      city: '',
      state: '',
      zipCode: '',
      reference: '',
      fullAddress: '',
      lat: undefined,
      lng: undefined
    });
    setSelectedLocation(null);
    setMapCenter({ lat: -14.235004, lng: -51.92528 });
  };

  const markers = selectedLocation ? [{
    position: selectedLocation,
    title: 'Localização Selecionada',
    infoWindow: 'Localização do endereço'
  }] : [];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Formulário de Endereço */}
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <Label htmlFor="street">Rua/Avenida *</Label>
                <Input
                  id="street"
                  value={addressData.street}
                  onChange={(e) => handleInputChange('street', e.target.value)}
                  placeholder="Nome da rua"
                  required
                />
              </div>
              <div>
                <Label htmlFor="number">Número</Label>
                <Input
                  id="number"
                  value={addressData.number}
                  onChange={(e) => handleInputChange('number', e.target.value)}
                  placeholder="123"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="neighborhood">Bairro</Label>
              <Input
                id="neighborhood"
                value={addressData.neighborhood}
                onChange={(e) => handleInputChange('neighborhood', e.target.value)}
                placeholder="Nome do bairro"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="city">Cidade *</Label>
                <Input
                  id="city"
                  value={addressData.city}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  placeholder="Nome da cidade"
                  required
                />
              </div>
              <div>
                <Label htmlFor="state">Estado *</Label>
                <Input
                  id="state"
                  value={addressData.state}
                  onChange={(e) => handleInputChange('state', e.target.value)}
                  placeholder="SP, RJ, MG..."
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="zipCode">CEP</Label>
              <Input
                id="zipCode"
                value={addressData.zipCode}
                onChange={(e) => handleInputChange('zipCode', e.target.value)}
                placeholder="00000-000"
                maxLength={9}
              />
            </div>

            <div>
              <Label htmlFor="reference">Ponto de Referência</Label>
              <Textarea
                id="reference"
                value={addressData.reference}
                onChange={(e) => handleInputChange('reference', e.target.value)}
                placeholder="Ex: Próximo ao supermercado, em frente à escola..."
                rows={3}
              />
            </div>

            <div>
              <Label>Endereço Completo (Prévia)</Label>
              <div className="p-3 bg-muted rounded-md text-sm">
                {addressData.fullAddress || 'Complete os campos acima para ver o endereço completo'}
              </div>
            </div>
          </div>

          {/* Mapa */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Localização no Mapa</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleUseCurrentLocation}
                className="flex items-center gap-2"
              >
                <Navigation className="h-4 w-4" />
                Usar Localização Atual
              </Button>
            </div>

              <GoogleMap
                center={mapCenter}
                zoom={15}
                markers={markers}
                onClick={handleMapClick}
                className="w-full h-full"
              />

            <div className="text-xs text-muted-foreground">
              💡 Clique no mapa para marcar a localização exata do endereço
            </div>
          </div>
        </div>

        <div className="flex justify-between pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
          >
            Limpar Tudo
          </Button>
          
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSave}
            >
              Salvar Endereço
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};