import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, UserPlus } from 'lucide-react';
import { CompanyDriverManager } from './CompanyDriverManager';
import { AvailableDriversList } from './AvailableDriversList';

interface DriverFileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  affiliatedCount?: number;
  pendingCount?: number;
}

export const DriverFileModal = ({
  open,
  onOpenChange,
  companyId,
  affiliatedCount = 0,
  pendingCount = 0,
}: DriverFileModalProps) => {
  const [activeTab, setActiveTab] = useState('affiliated');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="right" 
        className="w-screen sm:w-[95vw] p-0 overflow-hidden"
      >
        <SheetHeader className="p-6 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <SheetTitle className="flex items-center gap-2 text-xl">
            <Users className="h-6 w-6 text-primary" />
            Fichário de Motoristas
          </SheetTitle>
        </SheetHeader>
        
        <Tabs 
          value={activeTab} 
          onValueChange={setActiveTab}
          className="h-[calc(100vh-80px)] flex flex-col"
        >
          <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <TabsList className="w-full grid grid-cols-2 px-6 pt-4 h-auto bg-transparent">
              <TabsTrigger 
                value="affiliated"
                className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Motoristas Afiliados</span>
                <span className="sm:hidden">Afiliados</span>
                {(affiliatedCount > 0 || pendingCount > 0) && (
                  <span className="ml-1 px-2 py-0.5 rounded-full bg-background/20 text-xs font-semibold">
                    {affiliatedCount + pendingCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger 
                value="available"
                className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <UserPlus className="h-4 w-4" />
                <span className="hidden sm:inline">Motoristas Disponíveis</span>
                <span className="sm:hidden">Disponíveis</span>
              </TabsTrigger>
            </TabsList>
          </div>
          
          <div className="flex-1 overflow-hidden">
            <TabsContent 
              value="affiliated" 
              className="h-full overflow-y-auto m-0 p-6 focus-visible:outline-none focus-visible:ring-0"
            >
              <CompanyDriverManager inModal />
            </TabsContent>
            
            <TabsContent 
              value="available" 
              className="h-full overflow-y-auto m-0 p-6 focus-visible:outline-none focus-visible:ring-0"
            >
              <AvailableDriversList companyId={companyId} />
            </TabsContent>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};
