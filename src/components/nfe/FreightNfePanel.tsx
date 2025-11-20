import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NfeScannerDialog } from './NfeScannerDialog';
import { ManifestationDialog } from './ManifestationDialog';
import { NfeCard } from './NfeCard';
import { useNfe } from '@/hooks/useNfe';
import { NFeDocument } from '@/types/nfe';
import { Plus, Loader2 } from 'lucide-react';

interface FreightNfePanelProps {
  freightId: string;
}

export function FreightNfePanel({ freightId }: FreightNfePanelProps) {
  const [showScanner, setShowScanner] = useState(false);
  const [showManifestation, setShowManifestation] = useState(false);
  const [selectedNfe, setSelectedNfe] = useState<NFeDocument | null>(null);
  const [nfes, setNfes] = useState<NFeDocument[]>([]);
  const { loading, listNfes } = useNfe();

  const loadNfes = async () => {
    const data = await listNfes({ freight_id: freightId });
    setNfes(data);
  };

  useEffect(() => {
    loadNfes();
  }, [freightId]);

  const handleScanSuccess = () => {
    loadNfes();
  };

  const handleManifestClick = (nfe: NFeDocument) => {
    setSelectedNfe(nfe);
    setShowManifestation(true);
  };

  const handleManifestationSuccess = () => {
    loadNfes();
  };

  const pendingNfes = nfes.filter(nfe => nfe.status === 'pending');
  const manifestedNfes = nfes.filter(nfe => nfe.status === 'manifested');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Notas Fiscais (NF-e)</h3>
        <Button onClick={() => setShowScanner(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Adicionar NF-e
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : nfes.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>Nenhuma NF-e vinculada a este frete</p>
          <p className="text-sm mt-2">Clique em "Adicionar NF-e" para começar</p>
        </div>
      ) : (
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">
              Todas ({nfes.length})
            </TabsTrigger>
            <TabsTrigger value="pending">
              Pendentes ({pendingNfes.length})
            </TabsTrigger>
            <TabsTrigger value="manifested">
              Manifestadas ({manifestedNfes.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4 mt-4">
            {nfes.map((nfe) => (
              <NfeCard
                key={nfe.id}
                nfe={nfe}
                onManifest={nfe.status === 'pending' ? () => handleManifestClick(nfe) : undefined}
              />
            ))}
          </TabsContent>

          <TabsContent value="pending" className="space-y-4 mt-4">
            {pendingNfes.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                Nenhuma NF-e pendente
              </p>
            ) : (
              pendingNfes.map((nfe) => (
                <NfeCard
                  key={nfe.id}
                  nfe={nfe}
                  onManifest={() => handleManifestClick(nfe)}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="manifested" className="space-y-4 mt-4">
            {manifestedNfes.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                Nenhuma NF-e manifestada
              </p>
            ) : (
              manifestedNfes.map((nfe) => (
                <NfeCard key={nfe.id} nfe={nfe} />
              ))
            )}
          </TabsContent>
        </Tabs>
      )}

      <NfeScannerDialog
        open={showScanner}
        onClose={() => setShowScanner(false)}
        freightId={freightId}
        onSuccess={handleScanSuccess}
      />

      {selectedNfe && (
        <ManifestationDialog
          open={showManifestation}
          onClose={() => {
            setShowManifestation(false);
            setSelectedNfe(null);
          }}
          nfeAccessKey={selectedNfe.access_key}
          freightId={freightId}
          onSuccess={handleManifestationSuccess}
        />
      )}
    </div>
  );
}
