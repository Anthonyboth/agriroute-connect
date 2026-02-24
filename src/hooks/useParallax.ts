import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Hook para efeito parallax sutil em elementos hero.
 * Move a imagem de fundo mais lentamente que o scroll da página.
 * 
 * @param speed - Intensidade do parallax (0.1 = sutil, 0.5 = forte). Default: 0.15
 * @returns ref para o container e o valor de translateY calculado
 */
export function useParallax(speed = 0.15) {
  const ref = useRef<HTMLElement>(null);
  const [offset, setOffset] = useState(0);
  const ticking = useRef(false);

  const handleScroll = useCallback(() => {
    if (ticking.current) return;
    ticking.current = true;

    requestAnimationFrame(() => {
      if (!ref.current) {
        ticking.current = false;
        return;
      }
      const rect = ref.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;

      // Só calcular se o elemento está visível
      if (rect.bottom > 0 && rect.top < viewportHeight) {
        setOffset(rect.top * speed);
      }
      ticking.current = false;
    });
  }, [speed]);

  useEffect(() => {
    // Desativar parallax em mobile (prefere performance) e se prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMobile = window.innerWidth < 768;

    if (prefersReducedMotion || isMobile) return;

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Estado inicial

    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const style: React.CSSProperties = {
    transform: `translate3d(0, ${offset}px, 0)`,
    willChange: 'transform',
  };

  return { ref, style };
}
