import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScrollButtonsProps {
  className?: string;
  scrollAreaId?: string;
  children: React.ReactNode;
}

export const ScrollButtons: React.FC<ScrollButtonsProps> = ({ 
  className, 
  scrollAreaId,
  children 
}) => {
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scrollElement = scrollAreaId 
      ? document.getElementById(scrollAreaId) 
      : scrollRef.current;
    
    if (!scrollElement) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollElement;
      setShowScrollTop(scrollTop > 150);
      setShowScrollBottom(scrollTop < scrollHeight - clientHeight - 150);
    };

    scrollElement.addEventListener('scroll', handleScroll);
    // Check initial state after a short delay to ensure content is rendered
    const timer = setTimeout(handleScroll, 100);

    return () => {
      scrollElement.removeEventListener('scroll', handleScroll);
      clearTimeout(timer);
    };
  }, [scrollAreaId]);

  const scrollToTop = () => {
    const scrollElement = scrollAreaId 
      ? document.getElementById(scrollAreaId) 
      : scrollRef.current;
    
    if (scrollElement) {
      scrollElement.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const scrollToBottom = () => {
    const scrollElement = scrollAreaId 
      ? document.getElementById(scrollAreaId) 
      : scrollRef.current;
    
    if (scrollElement) {
      scrollElement.scrollTo({ top: scrollElement.scrollHeight, behavior: 'smooth' });
    }
  };

  return (
    <div className={cn("relative", className)}>
      <div ref={scrollRef} className="h-full overflow-y-auto">
        {children}
      </div>
      
      {/* Scroll Buttons */}
      <div className="fixed right-6 top-1/2 transform -translate-y-1/2 flex flex-col gap-2 z-50 pointer-events-none">
        <div className="pointer-events-auto">
          {showScrollTop && (
            <Button
              onClick={scrollToTop}
              size="sm"
              variant="outline"
              className="h-10 w-10 p-0 bg-background/90 backdrop-blur-sm border shadow-lg hover:bg-background/95 hover:shadow-xl transition-all duration-200"
              title="Rolar para o topo"
            >
              <ChevronUp className="h-5 w-5" />
            </Button>
          )}
        </div>
        
        <div className="pointer-events-auto">
          {showScrollBottom && (
            <Button
              onClick={scrollToBottom}
              size="sm"
              variant="outline"
              className="h-10 w-10 p-0 bg-background/90 backdrop-blur-sm border shadow-lg hover:bg-background/95 hover:shadow-xl transition-all duration-200"
              title="Rolar para baixo"
            >
              <ChevronDown className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};