import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useNavigate } from "react-router-dom";

interface MobileMenuProps {
  onContactClick: () => void;
}

export function MobileMenu({ onContactClick }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleNavigation = (path: string) => {
    setOpen(false);
    if (path.startsWith('#')) {
      const element = document.querySelector(path);
      element?.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate(path);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon"
          className="flex-shrink-0"
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
            onClick={() => handleNavigation('#features')}
            className="text-left py-3 px-4 rounded-lg hover:bg-accent transition-colors text-base"
          >
            Recursos
          </button>
          <button
            onClick={() => handleNavigation('/sobre')}
            className="text-left py-3 px-4 rounded-lg hover:bg-accent transition-colors text-base"
          >
            Sobre
          </button>
          <button
            onClick={() => {
              setOpen(false);
              onContactClick();
            }}
            className="text-left py-3 px-4 rounded-lg hover:bg-accent transition-colors text-base"
          >
            Contato
          </button>
          
          <div className="border-t pt-4 mt-2 flex flex-col gap-3">
            <Button 
              onClick={() => handleNavigation('/auth')}
              className="w-full justify-start text-base bg-orange-500 hover:bg-orange-600 text-white"
            >
              Entrar
            </Button>
            <Button 
              onClick={() => handleNavigation('/auth?tab=signup')}
              className="w-full justify-start text-base bg-green-600 hover:bg-green-700 text-white"
            >
              Cadastrar-se
            </Button>
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
