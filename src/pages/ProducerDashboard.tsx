import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import FreightCard from "@/components/FreightCard";
import Header from "@/components/Header";
import { Plus, TrendingUp, Package, Clock, CheckCircle } from "lucide-react";
import heroImage from "@/assets/hero-logistics.jpg";

// Mock data
const mockFreights = [
  {
    id: '1',
    cargoType: 'Soja',
    weight: 34000,
    origin: 'Fazenda Santa Maria - Sorriso/MT',
    destination: 'Porto de Santos/SP',
    price: 8500,
    distance: 1247,
    status: 'ABERTO' as const,
    pickupDate: '2024-01-15',
    deliveryDate: '2024-01-17',
    urgency: 'MEDIA' as const
  },
  {
    id: '2', 
    cargoType: 'Milho',
    weight: 40000,
    origin: 'Fazenda Boa Vista - Campo Verde/MT',
    destination: 'Terminal Cargill - Rondonópolis/MT',
    price: 2800,
    distance: 87,
    status: 'RESERVADO' as const,
    pickupDate: '2024-01-14',
    deliveryDate: '2024-01-15',
    urgency: 'BAIXA' as const
  },
  {
    id: '3',
    cargoType: 'Algodão',
    weight: 28000,
    origin: 'Fazenda Primavera - Primavera do Leste/MT',
    destination: 'Fiação São Paulo/SP',
    price: 7200,
    distance: 980,
    status: 'ENTREGUE' as const,
    pickupDate: '2024-01-10',
    deliveryDate: '2024-01-12',
    urgency: 'ALTA' as const
  },
  {
    id: '4',
    cargoType: 'Adubo',
    weight: 35000,
    origin: 'Fazenda Rio Verde - Diamantino/MT',
    destination: 'Cooperativa Nova Mutum/MT',
    price: 1800,
    distance: 65,
    status: 'EM_TRANSITO' as const,
    pickupDate: '2024-01-13',
    deliveryDate: '2024-01-14',
    urgency: 'MEDIA' as const
  }
];

const mockUser = {
  name: 'João Silva',
  role: 'PRODUTOR' as const
};

export default function ProducerDashboard() {
  const [freights] = useState(mockFreights);

  const handleLogout = () => {
    console.log('Logout');
  };

  const handleMenuClick = () => {
    console.log('Menu click');
  };

  const handleFreightAction = (freight: any) => {
    console.log('Freight action:', freight);
  };

  const handleCreateFreight = () => {
    console.log('Create freight');
  };

  // Stats calculation
  const openFreights = freights.filter(f => f.status === 'ABERTO').length;
  const activeFreights = freights.filter(f => ['RESERVADO', 'EM_TRANSITO'].includes(f.status)).length;
  const completedFreights = freights.filter(f => f.status === 'ENTREGUE').length;
  const totalValue = freights.reduce((sum, f) => sum + f.price, 0);

  return (
    <div className="min-h-screen bg-background">
      <Header 
        user={mockUser}
        onMenuClick={handleMenuClick}
        onLogout={handleLogout}
      />

      {/* Hero Section */}
      <section className="relative h-[300px] flex items-center justify-center overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${heroImage})` }}
        />
        <div className="absolute inset-0 bg-primary/80" />
        <div className="relative z-10 text-center text-white">
          <h1 className="text-4xl font-bold mb-4">
            Bem-vindo, {mockUser.name}
          </h1>
          <p className="text-xl mb-6 opacity-90">
            Gerencie seus fretes agrícolas com facilidade
          </p>
          <Button 
            variant="hero" 
            size="xl" 
            onClick={handleCreateFreight}
          >
            <Plus className="mr-2 h-5 w-5" />
            Criar Novo Frete
          </Button>
        </div>
      </section>

      <div className="container py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="gradient-card shadow-card">
            <CardContent className="p-6">
              <div className="flex items-center">
                <Package className="h-8 w-8 text-primary" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">
                    Fretes Abertos
                  </p>
                  <p className="text-2xl font-bold">{openFreights}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="gradient-card shadow-card">
            <CardContent className="p-6">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-warning" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">
                    Em Andamento
                  </p>
                  <p className="text-2xl font-bold">{activeFreights}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="gradient-card shadow-card">
            <CardContent className="p-6">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-success" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">
                    Concluídos
                  </p>
                  <p className="text-2xl font-bold">{completedFreights}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="gradient-card shadow-card">
            <CardContent className="p-6">
              <div className="flex items-center">
                <TrendingUp className="h-8 w-8 text-accent" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">
                    Valor Total
                  </p>
                  <p className="text-2xl font-bold">
                    {new Intl.NumberFormat('pt-BR', { 
                      style: 'currency', 
                      currency: 'BRL',
                      notation: 'compact',
                      maximumFractionDigits: 0
                    }).format(totalValue)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Freights List */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-2xl">Meus Fretes</CardTitle>
              <div className="flex gap-2">
                <Badge variant="secondary">Todos ({freights.length})</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {freights.length > 0 ? (
                freights.map((freight) => (
                  <FreightCard
                    key={freight.id}
                    freight={freight}
                    userRole="PRODUTOR"
                    onAction={handleFreightAction}
                  />
                ))
              ) : (
                <div className="text-center py-12">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhum frete cadastrado</h3>
                  <p className="text-muted-foreground mb-4">
                    Crie seu primeiro frete para começar a encontrar motoristas.
                  </p>
                  <Button variant="hero" onClick={handleCreateFreight}>
                    <Plus className="mr-2 h-4 w-4" />
                    Criar Primeiro Frete
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}