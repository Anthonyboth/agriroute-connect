/**
 * P0 HOTFIX: Modal de Contato SIMPLES - Com createPortal para document.body
 * Renderiza fora de qualquer stacking context (isolate, transform, etc.)
 * z-index máximo seguro: 2147483647
 */
import React, { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, MessageCircle, Mail, Phone, MapPin, Clock } from 'lucide-react';
import { SUPPORT_PHONE_DISPLAY, SUPPORT_EMAIL, getWhatsAppUrl } from '@/lib/support-contact';

interface ContactSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ContactSupportModal: React.FC<ContactSupportModalProps> = ({ isOpen, onClose }) => {
  // Travar scroll do body quando aberto
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      const originalPaddingRight = document.body.style.paddingRight;
      
      // Compensar scrollbar para evitar layout shift
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = 'hidden';
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }
      
      return () => {
        document.body.style.overflow = originalOverflow;
        document.body.style.paddingRight = originalPaddingRight;
      };
    }
  }, [isOpen]);

  // Fechar com ESC
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  // Handler para clique no overlay (fechar)
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Handler para WhatsApp
  const handleWhatsAppClick = () => {
    const url = getWhatsAppUrl('Olá! Gostaria de saber mais sobre o AgriRoute.');
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Handler para Email
  const handleEmailClick = () => {
    window.open(`mailto:${SUPPORT_EMAIL}?subject=Contato AgriRoute`, '_blank');
  };

  if (!isOpen) return null;

  // P0 HOTFIX: Usar createPortal para renderizar diretamente no document.body
  // Isso escapa do stacking context criado por 'isolate' na Landing page
  const modalContent = (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ 
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        zIndex: 2147483647, // Máximo z-index seguro para garantir que fique acima de TUDO
        isolation: 'isolate' // Cria novo stacking context para o modal
      }}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-modal-title"
    >
      {/* Modal Container - z-index relativo alto para garantir ordem dentro do portal */}
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl"
        style={{ 
          backgroundColor: 'hsl(var(--card))',
          color: 'hsl(var(--card-foreground))',
          zIndex: 2147483647 // Mesmo z-index máximo para o conteúdo
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full transition-colors z-10"
          style={{ 
            backgroundColor: 'hsl(var(--muted))',
            color: 'hsl(var(--muted-foreground))'
          }}
          aria-label="Fechar modal"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Content */}
        <div className="p-6 sm:p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h2 
              id="contact-modal-title"
              className="text-2xl sm:text-3xl font-bold mb-2"
            >
              Entre em Contato
            </h2>
            <p style={{ color: 'hsl(var(--muted-foreground))' }}>
              Fale conosco para suporte, parcerias ou dúvidas sobre nossa plataforma
            </p>
          </div>

          {/* Contact Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {/* WhatsApp Card */}
            <div 
              className="rounded-xl p-6 text-center transition-all hover:scale-[1.02]"
              style={{ 
                backgroundColor: 'hsl(var(--muted) / 0.5)',
                border: '1px solid hsl(var(--border))'
              }}
            >
              <div 
                className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4"
                style={{ backgroundColor: 'hsl(142.1 76.2% 36.3%)' }}
              >
                <MessageCircle className="h-7 w-7 text-white" />
              </div>
              <h3 className="font-semibold text-lg mb-2">WhatsApp</h3>
              <p 
                className="text-sm mb-4"
                style={{ color: 'hsl(var(--muted-foreground))' }}
              >
                Atendimento rápido via WhatsApp
              </p>
              <button
                type="button"
                onClick={handleWhatsAppClick}
                className="w-full py-3 px-4 rounded-lg font-medium transition-colors"
                style={{ 
                  backgroundColor: 'hsl(var(--primary))',
                  color: 'hsl(var(--primary-foreground))'
                }}
              >
                Chamar no WhatsApp
              </button>
            </div>

            {/* Email Card */}
            <div 
              className="rounded-xl p-6 text-center transition-all hover:scale-[1.02]"
              style={{ 
                backgroundColor: 'hsl(var(--muted) / 0.5)',
                border: '1px solid hsl(var(--border))'
              }}
            >
              <div 
                className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4"
                style={{ backgroundColor: 'hsl(var(--accent))' }}
              >
                <Mail className="h-7 w-7" style={{ color: 'hsl(var(--accent-foreground))' }} />
              </div>
              <h3 className="font-semibold text-lg mb-2">E-mail</h3>
              <p 
                className="font-mono text-sm mb-2"
                style={{ color: 'hsl(var(--foreground))' }}
              >
                {SUPPORT_EMAIL}
              </p>
              <p 
                className="text-sm mb-4"
                style={{ color: 'hsl(var(--muted-foreground))' }}
              >
                Envie sua mensagem por e-mail
              </p>
              <button
                type="button"
                onClick={handleEmailClick}
                className="w-full py-3 px-4 rounded-lg font-medium transition-colors"
                style={{ 
                  backgroundColor: 'transparent',
                  border: '1px solid hsl(var(--border))',
                  color: 'hsl(var(--foreground))'
                }}
              >
                Enviar E-mail
              </button>
            </div>
          </div>

          {/* Info Bar */}
          <div 
            className="rounded-xl p-4 sm:p-6"
            style={{ backgroundColor: 'hsl(var(--muted) / 0.3)' }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              <div className="flex items-center justify-center gap-2">
                <Clock className="h-5 w-5" style={{ color: 'hsl(var(--muted-foreground))' }} />
                <div className="text-left">
                  <p className="font-medium text-sm">Horário</p>
                  <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
                    Seg-Seg: 07h-19h
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-center gap-2">
                <Phone className="h-5 w-5" style={{ color: 'hsl(var(--muted-foreground))' }} />
                <div className="text-left">
                  <p className="font-medium text-sm">Telefone</p>
                  <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
                    {SUPPORT_PHONE_DISPLAY}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-center gap-2">
                <MapPin className="h-5 w-5" style={{ color: 'hsl(var(--muted-foreground))' }} />
                <div className="text-left">
                  <p className="font-medium text-sm">Localização</p>
                  <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
                    Mato Grosso, Brasil
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <p 
            className="text-center text-sm mt-6"
            style={{ color: 'hsl(var(--muted-foreground))' }}
          >
            Respondemos em até 24 horas úteis
          </p>
        </div>
      </div>
    </div>
  );

  // P0 HOTFIX: Renderizar via createPortal diretamente no document.body
  // Isso escapa do stacking context 'isolate' da Landing page
  return createPortal(modalContent, document.body);
};

export default ContactSupportModal;
