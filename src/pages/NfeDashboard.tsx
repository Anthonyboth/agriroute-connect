import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NfeScannerDialog } from '@/components/nfe/NfeScannerDialog';
import { ManifestationDialog } from '@/components/nfe/ManifestationDialog';
import { NfeCard } from '@/components/nfe/NfeCard';
import { useNfe } from '@/hooks/useNfe';
import { NFeDocument } from '@/types/nfe';
import { Plus, Loader2, FileText } from 'lucide-react';

export default function NfeDashboard() {
  const [showScanner, setShowScanner] = useState(false);
  const [showManifestation, setShowManifestation] = useState(false);
  const [selectedNfe, setSelectedNfe] = useState<NFeDocument | null>(null);
  const [nfes, setNfes] = useState<NFeDocument[]>([]);
  const { loading, listNfes } = useNfe();

  const loadNfes = async () => {
    const data = await listNfes();
    setNfes(data);
  };

  useEffect(() => {
    loadNfes();
  }, []);

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
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-3xl font-bold">Gestão de NF-es</h1>
                <p className="text-muted-foreground">
                  Gerencie suas notas fiscais eletrônicas
                </p>
              </div>
            </div>
            <Button onClick={() => setShowScanner(true)} size="lg">
              <Plus className="h-5 w-5 mr-2" />
              Nova NF-e
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
        ) : nfes.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Nenhuma NF-e cadastrada</h2>
            <p className="text-muted-foreground mb-6">
              Comece adicionando sua primeira nota fiscal eletrônica
            </p>
            <Button onClick={() => setShowScanner(true)}>
              <Plus className="h-5 w-5 mr-2" />
              Adicionar NF-e
            </Button>
          </div>
        ) : (
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-8">
              <TabsTrigger value="all" className="text-base">
                Todas ({nfes.length})
              </TabsTrigger>
              <TabsTrigger value="pending" className="text-base">
                Pendentes ({pendingNfes.length})
              </TabsTrigger>
              <TabsTrigger value="manifested" className="text-base">
                Manifestadas ({manifestedNfes.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {nfes.map((nfe) => (
                  <NfeCard
                    key={nfe.id}
                    nfe={nfe}
                    onManifest={nfe.status === 'pending' ? () => handleManifestClick(nfe) : undefined}
                  />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="pending">
              {pendingNfes.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <p className="text-lg">Nenhuma NF-e pendente de manifestação</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {pendingNfes.map((nfe) => (
                    <NfeCard
                      key={nfe.id}
                      nfe={nfe}
                      onManifest={() => handleManifestClick(nfe)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="manifested">
              {manifestedNfes.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <p className="text-lg">Nenhuma NF-e manifestada ainda</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {manifestedNfes.map((nfe) => (
                    <NfeCard key={nfe.id} nfe={nfe} />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}

        <NfeScannerDialog
          open={showScanner}
          onClose={() => setShowScanner(false)}
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
            onSuccess={handleManifestationSuccess}
          />
        )}
      </div>
    </div>
  );
}
