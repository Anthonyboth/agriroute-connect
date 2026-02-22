import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getWhatsAppUrl } from '@/lib/support-contact';
import { playSoundSupport } from '@/utils/playSound';

interface Position {
  x: number;
  y: number;
}

const STORAGE_KEY = 'agriroute-support-button-position';

/**
 * Botão flutuante de suporte via WhatsApp
 * - Draggable: usuário pode arrastar para qualquer posição
 * - Persistente: salva posição no localStorage
 * - Discreto: design minimalista com hover sutil
 * - Acessível: tooltip e aria-label
 */
export const FloatingSupportButton: React.FC = () => {
  const location = useLocation();
  const [position, setPosition] = useState<Position>({ x: 24, y: 24 });
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const buttonRef = useRef<HTMLAnchorElement>(null);
  const dragStartPos = useRef<Position>({ x: 0, y: 0 });
  const hasMoved = useRef(false);
  const startPosition = useRef<Position>({ x: 0, y: 0 });

  // Esconder no painel administrativo
  const isAdminPanel = location.pathname.startsWith('/admin');

  // Carregar posição salva do localStorage
  useEffect(() => {
    const savedPosition = localStorage.getItem(STORAGE_KEY);
    if (savedPosition) {
      try {
        const parsed = JSON.parse(savedPosition);
        setPosition(parsed);
      } catch (e) {
        console.debug('Failed to parse saved position');
      }
    }
  }, []);

  // Salvar posição no localStorage quando mudar
  const savePosition = (newPosition: Position) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newPosition));
    setPosition(newPosition);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // apenas botão esquerdo
    hasMoved.current = false;
    startPosition.current = { x: e.clientX, y: e.clientY };
    setIsDragging(true);
    dragStartPos.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    hasMoved.current = false;
    startPosition.current = { x: touch.clientX, y: touch.clientY };
    setIsDragging(true);
    dragStartPos.current = {
      x: touch.clientX - position.x,
      y: touch.clientY - position.y,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      // Detectar se houve movimento significativo (>5px)
      const distance = Math.sqrt(
        Math.pow(e.clientX - startPosition.current.x, 2) +
        Math.pow(e.clientY - startPosition.current.y, 2)
      );
      if (distance > 5) {
        hasMoved.current = true;
      }
      
      const newX = e.clientX - dragStartPos.current.x;
      const newY = e.clientY - dragStartPos.current.y;
      
      // Limitar dentro da viewport
      const maxX = window.innerWidth - 48;
      const maxY = window.innerHeight - 48;
      
      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY)),
      });
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging) return;
      
      const touch = e.touches[0];
      
      // Detectar se houve movimento significativo (>5px)
      const distance = Math.sqrt(
        Math.pow(touch.clientX - startPosition.current.x, 2) +
        Math.pow(touch.clientY - startPosition.current.y, 2)
      );
      if (distance > 5) {
        hasMoved.current = true;
      }
      
      const newX = touch.clientX - dragStartPos.current.x;
      const newY = touch.clientY - dragStartPos.current.y;
      
      const maxX = window.innerWidth - 48;
      const maxY = window.innerHeight - 48;
      
      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY)),
      });
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        savePosition(position);
      }
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove);
      document.addEventListener('touchend', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging, position]);

  if (isAdminPanel) return null;

  const handleClick = (e: React.MouseEvent) => {
    // Só prevenir navegação se realmente arrastou
    if (hasMoved.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    // Tocar som antes de abrir WhatsApp
    playSoundSupport();
    // Deixa o link <a> funcionar naturalmente
  };

  return (
    <a
      ref={buttonRef}
      href={getWhatsAppUrl('Olá! Preciso de suporte.')}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      className={cn(
        'fixed rounded-full shadow-lg transition-all duration-200',
        'bg-[#25D366] hover:bg-[#1fb855] text-white',
        'flex items-center justify-center',
        'touch-none select-none',
        isDragging ? 'cursor-grabbing scale-110' : 'cursor-grab scale-100',
        isHovering && !isDragging && 'scale-105',
        'focus:outline-none focus:ring-2 focus:ring-[#25D366] focus:ring-offset-2'
      )}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: '48px',
        height: '48px',
        zIndex: 9999,
        opacity: isDragging ? 0.9 : isHovering ? 1 : 0.85,
      }}
      aria-label="Suporte via WhatsApp"
    >
      <MessageCircle className="h-6 w-6" />
    </a>
  );
};
