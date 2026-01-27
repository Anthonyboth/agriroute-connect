// P0 HOTFIX: Contato e Cadastrar-se RECRIADOS - onSignupClick adicionado para abrir modal de cadastro
import { useState, useCallback, useEffect } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useNavigate } from "react-router-dom";

interface MobileMenuProps {
  onContactClick: () => void;
  onSignupClick: () => void;
}

export function MobileMenu({ onContactClick, onSignupClick }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  // Explicitly block body scroll when menu is open (belt & suspenders approach)
  useEffect(() => {
    if (open) {
      const originalOverflow = document.body.style.overflow;
      const originalPaddingRight = document.body.style.paddingRight;
      
      document.body.style.overflow = 'hidden';
      // Prevent layout shift from scrollbar disappearing
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }
      
      return () => {
        document.body.style.overflow = originalOverflow;
        document.body.style.paddingRight = originalPaddingRight;
      };
    }
  }, [open]);

  const handleNavigation = useCallback((path: string) => {
    setOpen(false);
    if (path.startsWith('#')) {
      const element = document.querySelector(path);
      element?.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate(path);
    }
  }, [navigate]);

  const handleLoginClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(false);
    navigate('/auth?mode=login');
  }, [navigate]);

  const handleSignupClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(false);
    // Pequeno delay para garantir que o Sheet feche antes de abrir o modal
    setTimeout(() => {
      onSignupClick();
    }, 100);
  }, [onSignupClick]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon"
          type="button"
          className="flex-shrink-0 md:hidden"
          aria-label="Menu de navegação"
        >
          <Menu className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[280px] sm:w-[350px]">
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-4 mt-8">
          <button
            type="button"
            onClick={() => handleNavigation('#features')}
            className="text-left py-3 px-4 rounded-lg hover:bg-accent transition-colors text-base"
          >
            Recursos
          </button>
          <button
            type="button"
            onClick={() => handleNavigation('/sobre')}
            className="text-left py-3 px-4 rounded-lg hover:bg-accent transition-colors text-base"
          >
            Sobre
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
              onContactClick();
            }}
            className="text-left py-3 px-4 rounded-lg hover:bg-accent transition-colors text-base"
          >
            Contato
          </button>
          
          <div className="border-t pt-4 mt-2 flex flex-col gap-3">
            <Button 
              type="button"
              onClick={handleSignupClick}
              className="w-full justify-start text-base gradient-primary text-primary-foreground font-medium"
            >
              Cadastrar-se
            </Button>
            <Button 
              type="button"
              onClick={handleLoginClick}
              className="w-full justify-start text-base bg-orange-500 hover:bg-orange-600 text-gray-900 font-medium"
            >
              Entrar
            </Button>
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
