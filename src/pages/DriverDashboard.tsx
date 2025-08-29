import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FreightCard } from "@/components/FreightCard";
import { Header } from "@/components/Header";
import { MapPin, TrendingUp, Truck, Clock, CheckCircle, Filter } from "lucide-react";
import heroImage from "@/assets/hero-logistics.jpg";

// Mock data for available freights
const mockAvailableFreights = [
  {
    id: '1',
    cargoType: 'Soja',
    totalWeight: 34,
    requiredVehicleType: 'Bitrem',
    originAddress: 'Fazenda Santa Maria - Sorriso/MT',
    destAddress: 'Porto de Santos/SP',
    suggestedPrice: 8500,
    distance: 1247,
    status: 'OPEN' as const,
    windowStart: '2024-01-15',
    windowEnd: '2024-01-17'
  },
  {
    id: '5',
    cargoType: 'Fertilizante',
    totalWeight: 30,
    requiredVehicleType: 'Bitrem',
    originAddress: 'Terminal Yara - Cubatão/SP',
    destAddress: 'Fazenda Aurora - Lucas do Rio Verde/MT',
    suggestedPrice: 9200,
    distance: 1450,
    status: 'OPEN' as const,
    windowStart: '2024-01-16',
    windowEnd: '2024-01-18'
  }
];

// Mock data for driver's trips
const mockMyTrips = [
  {
    id: '2', 
    cargoType: 'Milho',
    totalWeight: 40,
    requiredVehicleType: 'Bitrem',
    originAddress: 'Fazenda Boa Vista - Campo Verde/MT',
    destAddress: 'Terminal Cargill - Rondonópolis/MT',
    suggestedPrice: 2800,
    distance: 87,
    status: 'IN_TRANSIT' as const,
    windowStart: '2024-01-14',
    windowEnd: '2024-01-15'
  },
  {
    id: '3',
    cargoType: 'Algodão',
    totalWeight: 28,
    requiredVehicleType: 'Bitrem',
    originAddress: 'Fazenda Primavera - Primavera do Leste/MT',
    destAddress: 'Fiação São Paulo/SP',
    suggestedPrice: 7200,
    distance: 980,
    status: 'DELIVERED' as const,
    windowStart: '2024-01-10',
    windowEnd: '2024-01-12'
  }
];

const mockUser = {
  name: 'Carlos Santos',
  role: 'MOTORISTA' as const
};

export default function DriverDashboard() {
  const [availableFreights] = useState(mockAvailableFreights);
  const [myTrips] = useState(mockMyTrips);
  const [activeTab, setActiveTab] = useState<'available' | 'mytrips'>('available');

  const handleLogout = () => {
    console.log('Logout');
  };

  const handleMenuClick = () => {
    console.log('Menu click');
  };

  const handleFreightAction = (freight: any) => {
    console.log('Freight action:', freight);
  };

  // Stats calculation
  const activeTrips = myTrips.filter(t => ['BOOKED', 'PICKUP', 'IN_TRANSIT'].includes(t.status)).length;
  const completedTrips = myTrips.filter(t => t.status === 'DELIVERED').length;
  const availableCount = availableFreights.length;
  const totalEarnings = myTrips.reduce((sum, t) => sum + t.suggestedPrice, 0);

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
            Olá, {mockUser.name}
          </h1>
          <p className="text-xl mb-6 opacity-90">
            Encontre fretes agrícolas próximos e aumente sua renda
          </p>
          <Button 
            variant="hero" 
            size="xl" 
            onClick={() => setActiveTab('available')}
          >
            <MapPin className="mr-2 h-5 w-5" />
            Buscar Fretes
          </Button>
        </div>
      </section>

      <div className="container py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="gradient-card shadow-card">
            <CardContent className="p-6">
              <div className="flex items-center">
                <MapPin className="h-8 w-8 text-primary" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">
                    Fretes Disponíveis
                  </p>
                  <p className="text-2xl font-bold">{availableCount}</p>
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
                    Viagens Ativas
                  </p>
                  <p className="text-2xl font-bold">{activeTrips}</p>
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
                    Concluídas
                  </p>
                  <p className="text-2xl font-bold">{completedTrips}</p>
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
                    Ganhos Totais
                  </p>
                  <p className="text-2xl font-bold">
                    {new Intl.NumberFormat('pt-BR', { 
                      style: 'currency', 
                      currency: 'BRL',
                      notation: 'compact',
                      maximumFractionDigits: 0
                    }).format(totalEarnings)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 mb-6">
          <Button
            variant={activeTab === 'available' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('available')}
          >
            Fretes Disponíveis ({availableCount})
          </Button>
          <Button
            variant={activeTab === 'mytrips' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('mytrips')}
          >
            Minhas Viagens ({myTrips.length})
          </Button>
        </div>

        {/* Content */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-2xl">
                {activeTab === 'available' ? 'Fretes Disponíveis' : 'Minhas Viagens'}
              </CardTitle>
              {activeTab === 'available' && (
                <Button variant="outline" size="sm">
                  <Filter className="mr-2 h-4 w-4" />
                  Filtros
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {activeTab === 'available' ? (
                availableFreights.length > 0 ? (
                  availableFreights.map((freight) => (
                    <FreightCard
                      key={freight.id}
                      freight={freight}
                      userRole="MOTORISTA"
                      onAction={handleFreightAction}
                    />
                  ))
                ) : (
                  <div className="text-center py-12">
                    <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Nenhum frete disponível</h3>
                    <p className="text-muted-foreground mb-4">
                      Não há fretes compatíveis com seu veículo na região no momento.
                    </p>
                    <Button variant="outline">
                      <Filter className="mr-2 h-4 w-4" />
                      Ajustar Filtros
                    </Button>
                  </div>
                )
              ) : (
                myTrips.length > 0 ? (
                  myTrips.map((trip) => (
                    <FreightCard
                      key={trip.id}
                      freight={trip}
                      userRole="MOTORISTA"
                      onAction={handleFreightAction}
                    />
                  ))
                ) : (
                  <div className="text-center py-12">
                    <Truck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Nenhuma viagem ainda</h3>
                    <p className="text-muted-foreground mb-4">
                      Aceite seu primeiro frete para começar a fazer viagens.
                    </p>
                    <Button variant="hero" onClick={() => setActiveTab('available')}>
                      <MapPin className="mr-2 h-4 w-4" />
                      Buscar Fretes
                    </Button>
                  </div>
                )
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}