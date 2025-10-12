import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Leaf, Activity, CheckCircle, AlertCircle, XCircle, Clock, Server, Database, Globe, Smartphone } from 'lucide-react';

const Status = () => {
  const navigate = useNavigate();
  const [uptime, setUptime] = useState(99.9);

  useEffect(() => {
    // Simulate real-time uptime updates
    const interval = setInterval(() => {
      setUptime(prev => Math.min(99.99, prev + Math.random() * 0.01));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const services = [
    {
      name: 'Plataforma Web',
      status: 'operational',
      icon: Globe,
      description: 'Interface principal da AgriRoute',
      uptime: 99.95,
      responseTime: 245
    },
    {
      name: 'API Principal',
      status: 'operational', 
      icon: Server,
      description: 'Serviços de backend e API REST',
      uptime: 99.98,
      responseTime: 180
    },
    {
      name: 'Banco de Dados',
      status: 'operational',
      icon: Database,
      description: 'Sistema de armazenamento Supabase',
      uptime: 99.99,
      responseTime: 95
    },
    {
      name: 'Aplicativo Mobile',
      status: 'maintenance',
      icon: Smartphone,
      description: 'App mobile para iOS e Android',
      uptime: 98.5,
      responseTime: 320
    },
    {
      name: 'Sistema de Pagamentos',
      status: 'operational',
      icon: CheckCircle,
      description: 'Processamento de transações financeiras',
      uptime: 99.97,
      responseTime: 156
    },
    {
      name: 'Notificações',
      status: 'degraded',
      icon: AlertCircle,
      description: 'Sistema de notificações por email e SMS',
      uptime: 97.8,
      responseTime: 890
    }
  ];

  const incidents = [
    {
      title: 'Manutenção Programada - Aplicativo Mobile',
      status: 'investigating',
      severity: 'medium',
      date: '2024-01-10',
      time: '14:30',
      description: 'Realizando atualização do sistema de notificações push do aplicativo mobile.'
    },
    {
      title: 'Lentidão no Sistema de Notificações',
      status: 'monitoring',
      severity: 'low',
      date: '2024-01-10',
      time: '09:15',
      description: 'Identificamos lentidão no envio de notificações. Equipe técnica investigando.'
    },
    {
      title: 'Instabilidade Resolvida - API de Pagamentos',
      status: 'resolved',
      severity: 'high',
      date: '2024-01-09',
      time: '16:45',
      description: 'Problema de conectividade com gateway de pagamento foi corrigido. Serviço normalizado.'
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operational': return 'default';
      case 'degraded': return 'secondary';
      case 'maintenance': return 'outline';
      case 'outage': return 'destructive';
      default: return 'secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'operational': return CheckCircle;
      case 'degraded': return AlertCircle;
      case 'maintenance': return Clock;
      case 'outage': return XCircle;
      default: return AlertCircle;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'operational': return 'Operacional';
      case 'degraded': return 'Degradado';
      case 'maintenance': return 'Manutenção';
      case 'outage': return 'Fora do Ar';
      default: return 'Desconhecido';
    }
  };

  const getIncidentStatusColor = (status: string) => {
    switch (status) {
      case 'investigating': return 'secondary';
      case 'identified': return 'destructive';
      case 'monitoring': return 'outline';
      case 'resolved': return 'default';
      default: return 'secondary';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'default';
      case 'medium': return 'secondary';
      case 'high': return 'destructive';
      case 'critical': return 'destructive';
      default: return 'secondary';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/')} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <div className="flex items-center space-x-2">
            <Leaf className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold text-foreground">AgriRoute</span>
          </div>
          <div></div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 gradient-hero">
        <div className="container mx-auto px-4 text-center">
          <Activity className="h-16 w-16 text-primary-foreground mx-auto mb-6" />
          <h1 className="text-4xl md:text-5xl font-bold text-primary-foreground mb-6">
            Status da Plataforma
          </h1>
          <p className="text-lg text-primary-foreground/90 max-w-2xl mx-auto">
            Monitoramento em tempo real dos serviços da AgriRoute
          </p>
        </div>
      </section>

      {/* Overall Status */}
      <section className="py-12 bg-muted/30">
        <div className="container mx-auto px-4">
          <Card className="shadow-card max-w-2xl mx-auto">
            <CardContent className="p-8 text-center">
              <div className="flex items-center justify-center gap-2 mb-4">
                <CheckCircle className="h-8 w-8 text-success" />
                <h2 className="text-2xl font-bold text-foreground">
                  Todos os Sistemas Operacionais
                </h2>
              </div>
              <p className="text-muted-foreground mb-6">
                A plataforma AgriRoute está funcionando normalmente
              </p>
              <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
                <div>
                  <span className="text-2xl font-bold text-success">{uptime.toFixed(2)}%</span>
                  <p>Uptime (30 dias)</p>
                </div>
                <div className="w-px h-12 bg-border"></div>
                <div>
                  <span className="text-2xl font-bold text-foreground">24/7</span>
                  <p>Monitoramento</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Services Status */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Status dos Serviços
            </h2>
            <p className="text-muted-foreground">
              Monitoramento individual de cada componente da plataforma
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service, index) => {
              const StatusIcon = getStatusIcon(service.status);
              return (
                <Card key={service.name} className="shadow-card hover:shadow-glow transition-smooth">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <service.icon className="h-6 w-6 text-primary" />
                        {service.name}
                      </div>
                      <Badge variant={getStatusColor(service.status)}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {getStatusText(service.status)}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      {service.description}
                    </p>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Uptime:</span>
                        <p className="font-semibold text-success">{service.uptime}%</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Resposta:</span>
                        <p className="font-semibold">{service.responseTime}ms</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Recent Incidents */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Incidentes Recentes
            </h2>
            <p className="text-muted-foreground">
              Histórico de ocorrências e manutenções
            </p>
          </div>

          <div className="max-w-4xl mx-auto space-y-4">
            {incidents.map((incident, index) => (
              <Card key={`${incident.date}-${incident.title}`} className="shadow-card">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-lg font-semibold text-foreground">
                      {incident.title}
                    </h3>
                    <div className="flex gap-2">
                      <Badge variant={getIncidentStatusColor(incident.status)}>
                        {incident.status}
                      </Badge>
                      <Badge variant={getSeverityColor(incident.severity)}>
                        {incident.severity}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-muted-foreground mb-3">
                    {incident.description}
                  </p>
                  <div className="text-sm text-muted-foreground">
                    {incident.date} às {incident.time}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Subscribe to Updates */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <Card className="shadow-card max-w-2xl mx-auto">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">
                Receber Atualizações
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-muted-foreground mb-6">
                Seja notificado sobre mudanças no status dos serviços da AgriRoute
              </p>
              <div className="space-y-4">
                <Button className="gradient-primary text-primary-foreground w-full">
                  Inscrever-se para Atualizações
                </Button>
                <div className="text-sm text-muted-foreground">
                  <p>Ou siga-nos em nossas redes sociais para atualizações em tempo real</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Contact Support */}
      <section className="py-12 bg-muted/30">
        <div className="container mx-auto px-4 text-center">
          <h3 className="text-xl font-semibold text-foreground mb-4">
            Problemas Técnicos?
          </h3>
          <p className="text-muted-foreground mb-4">
            Se você está enfrentando problemas não listados aqui, entre em contato com nosso suporte
          </p>
          <div className="space-y-2 text-sm text-muted-foreground mb-6">
            <p><strong>Email:</strong> agrirouteconnect@gmail.com</p>
            <p><strong>WhatsApp:</strong> 015 66 9 9942-6656</p>
            <p><strong>Chat:</strong> Disponível 24/7 na plataforma</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Status;