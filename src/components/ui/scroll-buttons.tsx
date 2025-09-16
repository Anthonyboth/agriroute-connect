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
      setShowScrollTop(scrollTop > 100);
      setShowScrollBottom(scrollTop < scrollHeight - clientHeight - 100);
    };

    scrollElement.addEventListener('scroll', handleScroll);
    handleScroll(); // Check initial state

    return () => scrollElement.removeEventListener('scroll', handleScroll);
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
      <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex flex-col gap-2 z-10">
        {showScrollTop && (
          <Button
            onClick={scrollToTop}
            size="sm"
            variant="outline"
            className="h-8 w-8 p-0 bg-background/80 backdrop-blur-sm border shadow-md hover:bg-background/90"
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
        )}
        
        {showScrollBottom && (
          <Button
            onClick={scrollToBottom}
            size="sm"
            variant="outline"
            className="h-8 w-8 p-0 bg-background/80 backdrop-blur-sm border shadow-md hover:bg-background/90"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};