import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, ShieldCheck, AlertTriangle, Loader2 } from 'lucide-react';
import { useInsurance, type InsuranceProduct, type UserInsurance } from '@/hooks/useInsurance';
import { InsuranceProductCard } from './insurance/InsuranceProductCard';
import { InsuranceDetailModal } from './insurance/InsuranceDetailModal';
import { InsuranceContractModal } from './insurance/InsuranceContractModal';
import { MyInsuranceCard } from './insurance/MyInsuranceCard';
import { InsuranceClaimModal } from './insurance/InsuranceClaimModal';
import { InsuranceClaimCard } from './insurance/InsuranceClaimCard';
import { InsuranceEducationSection } from './insurance/InsuranceEducationSection';

const InsuranceTab: React.FC = () => {
  const { products, userInsurances, claims, loading, createInsurance, createClaim, cancelInsurance } = useInsurance();

  const [detailProduct, setDetailProduct] = useState<InsuranceProduct | null>(null);
  const [contractProduct, setContractProduct] = useState<InsuranceProduct | null>(null);
  const [claimInsurance, setClaimInsurance] = useState<UserInsurance | null>(null);

  // Group products by category
  const grouped = products.reduce<Record<string, InsuranceProduct[]>>((acc, p) => {
    (acc[p.category] = acc[p.category] || []).push(p);
    return acc;
  }, {});

  const categoryLabels: Record<string, string> = {
    transporte: '🚛 Transporte',
    operacional: '📦 Operacional',
    profissional: '👤 Profissional',
    pessoal: '🏥 Pessoal',
  };

  const activeInsurances = userInsurances.filter(i => i.status === 'active');
  const inactiveInsurances = userInsurances.filter(i => i.status !== 'active');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-primary/10">
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-bold">Seguros AgriRoute</h2>
          <p className="text-sm text-muted-foreground">
            Proteção para sua operação e sua carga
          </p>
        </div>
      </div>

      <InsuranceEducationSection />

      <Tabs defaultValue="available" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="available" className="gap-1 text-xs sm:text-sm">
            <Shield className="h-3.5 w-3.5" />
            Disponíveis
          </TabsTrigger>
          <TabsTrigger value="my" className="gap-1 text-xs sm:text-sm">
            <ShieldCheck className="h-3.5 w-3.5" />
            Meus Seguros
          </TabsTrigger>
          <TabsTrigger value="claims" className="gap-1 text-xs sm:text-sm">
            <AlertTriangle className="h-3.5 w-3.5" />
            Sinistros
          </TabsTrigger>
        </TabsList>

        {/* Available Products */}
        <TabsContent value="available" className="space-y-6 mt-4">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category} className="space-y-3">
              <h3 className="font-semibold text-sm">{categoryLabels[category] || category}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map(product => (
                  <InsuranceProductCard
                    key={product.id}
                    product={product}
                    onViewDetails={setDetailProduct}
                    onContract={setContractProduct}
                  />
                ))}
              </div>
            </div>
          ))}
          {products.length === 0 && (
            <p className="text-center text-muted-foreground py-8">Nenhum seguro disponível no momento.</p>
          )}
        </TabsContent>

        {/* My Insurances */}
        <TabsContent value="my" className="space-y-4 mt-4">
          {activeInsurances.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Seguros Ativos</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {activeInsurances.map(ins => (
                  <MyInsuranceCard
                    key={ins.id}
                    insurance={ins}
                    onCancel={cancelInsurance}
                    onClaim={setClaimInsurance}
                  />
                ))}
              </div>
            </div>
          )}
          {inactiveInsurances.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground">Histórico</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {inactiveInsurances.map(ins => (
                  <MyInsuranceCard
                    key={ins.id}
                    insurance={ins}
                    onCancel={cancelInsurance}
                    onClaim={setClaimInsurance}
                  />
                ))}
              </div>
            </div>
          )}
          {userInsurances.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              Você ainda não contratou nenhum seguro. Explore a aba "Disponíveis".
            </p>
          )}
        </TabsContent>

        {/* Claims */}
        <TabsContent value="claims" className="space-y-4 mt-4">
          {claims.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {claims.map(claim => (
                <InsuranceClaimCard key={claim.id} claim={claim} />
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">Nenhum sinistro registrado.</p>
          )}
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <InsuranceDetailModal
        product={detailProduct}
        open={!!detailProduct}
        onClose={() => setDetailProduct(null)}
        onContract={(p) => { setDetailProduct(null); setContractProduct(p); }}
      />

      <InsuranceContractModal
        product={contractProduct}
        open={!!contractProduct}
        onClose={() => setContractProduct(null)}
        onConfirm={async (params) => {
          return createInsurance({
            insuranceProductId: params.insuranceProductId,
            coverageValue: params.coverageValue,
            price: params.price,
            paymentMethod: params.paymentMethod,
          });
        }}
      />

      {claimInsurance && (
        <InsuranceClaimModal
          open={!!claimInsurance}
          onClose={() => setClaimInsurance(null)}
          insuranceId={claimInsurance.id}
          insuranceName={claimInsurance.insurance_products?.name || 'Seguro'}
          maxCoverage={claimInsurance.coverage_value}
          onSubmit={async (params) => {
            return createClaim({
              userInsuranceId: params.userInsuranceId,
              description: params.description,
              evidenceUrls: params.evidenceUrls,
              amountClaimed: params.amountClaimed,
            });
          }}
        />
      )}
    </div>
  );
};

export default InsuranceTab;
