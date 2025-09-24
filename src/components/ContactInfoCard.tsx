import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Phone, MessageSquare, Mail, User, Users } from 'lucide-react';

interface ContactInfoProps {
  requesterName?: string;
  contactPhone?: string;
  requesterPhone?: string;
  showWhatsApp?: boolean;
}

export const ContactInfoCard: React.FC<ContactInfoProps> = ({
  requesterName,
  contactPhone,
  requesterPhone,
  showWhatsApp = true
}) => {
  const phone = contactPhone || requesterPhone;
  
  if (!requesterName && !phone) {
    return null;
  }

  const formatPhone = (phoneNumber: string) => {
    // Remove caracteres não numéricos
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    // Formato brasileiro
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    } else if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
    }
    
    return phoneNumber;
  };

  const getWhatsAppUrl = (phoneNumber: string) => {
    const cleaned = phoneNumber.replace(/\D/g, '');
    const formattedForWhatsApp = cleaned.startsWith('55') ? cleaned : `55${cleaned}`;
    return `https://wa.me/${formattedForWhatsApp}`;
  };

  return (
    <Card className="bg-blue-50 border-blue-200 mt-3">
      <CardContent className="p-3">
        <h4 className="font-medium text-sm text-blue-800 mb-2 flex items-center">
          <Users className="h-4 w-4 mr-1" />
          Dados de Contato do Cliente
        </h4>
        <div className="space-y-2">
          {requesterName && (
            <div className="flex items-center text-sm text-blue-700">
              <User className="h-3 w-3 mr-2 flex-shrink-0" />
              <span><strong>Nome:</strong> {requesterName}</span>
            </div>
          )}
          
          {phone && (
            <div className="flex items-center text-sm text-blue-700">
              <Phone className="h-3 w-3 mr-2 flex-shrink-0" />
              <span><strong>Telefone:</strong> {formatPhone(phone)}</span>
            </div>
          )}
          
          {phone && showWhatsApp && (
            <div className="flex items-center text-sm text-blue-700">
              <MessageSquare className="h-3 w-3 mr-2 flex-shrink-0" />
              <a 
                href={getWhatsAppUrl(phone)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                <strong>WhatsApp:</strong> Abrir conversa
              </a>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};