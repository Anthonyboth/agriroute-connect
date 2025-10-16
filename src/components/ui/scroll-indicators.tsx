import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface ScrollIndicatorsProps {
  targetRef: React.RefObject<HTMLElement>;
  className?: string;
}

export function ScrollIndicators({ targetRef, className }: ScrollIndicatorsProps) {
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);

  useEffect(() => {
    const element = targetRef.current;
    if (!element) return;

    const checkScroll = () => {
      const { scrollLeft, scrollWidth, clientWidth } = element;
      
      setShowLeft(scrollLeft > 10);
      setShowRight(scrollLeft < scrollWidth - clientWidth - 10);
    };

    // Check initially
    checkScroll();

    // Add scroll listener
    element.addEventListener('scroll', checkScroll);
    
    // Add resize observer to handle window resizing
    const resizeObserver = new ResizeObserver(checkScroll);
    resizeObserver.observe(element);

    return () => {
      element.removeEventListener('scroll', checkScroll);
      resizeObserver.disconnect();
    };
  }, [targetRef]);

  return (
    <>
      {/* Left gradient indicator */}
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-12 pointer-events-none transition-opacity duration-300 z-10",
          "bg-gradient-to-r from-background to-transparent",
          showLeft ? "opacity-100" : "opacity-0",
          className
        )}
      />
      
      {/* Right gradient indicator */}
      <div
        className={cn(
          "absolute right-0 top-0 bottom-0 w-12 pointer-events-none transition-opacity duration-300 z-10",
          "bg-gradient-to-l from-background to-transparent",
          showRight ? "opacity-100" : "opacity-0",
          className
        )}
      />
    </>
  );
}
