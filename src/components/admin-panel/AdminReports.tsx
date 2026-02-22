import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Menu, BarChart3, TrendingUp, PieChart, Activity } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';

const AdminReports = () => {
  return (
    <div className="flex-1 bg-muted/30">
      <header className="bg-card border-b border-border px-6 py-4 flex items-center gap-4">
        <SidebarTrigger className="p-2 hover:bg-muted rounded-md">
          <Menu className="h-5 w-5" />
        </SidebarTrigger>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Relatórios</h1>
          <p className="text-sm text-muted-foreground">Análises e métricas da plataforma</p>
        </div>
      </header>

      <div className="p-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ReportCard
            icon={<BarChart3 className="h-8 w-8 text-primary" />}
            title="Relatório de Cadastros"
            description="Análise detalhada de aprovações, reprovações e tempo médio de análise por período."
          />
          <ReportCard
            icon={<TrendingUp className="h-8 w-8 text-success" />}
            title="Relatório de Fretes"
            description="Volume de fretes, valores movimentados, rotas mais frequentes e indicadores de performance."
          />
          <ReportCard
            icon={<PieChart className="h-8 w-8 text-accent" />}
            title="Relatório Financeiro"
            description="Receita, comissões, transações e projeções de faturamento da plataforma."
          />
          <ReportCard
            icon={<Activity className="h-8 w-8 text-warning" />}
            title="Relatório de Risco"
            description="Incidentes de fraude, alertas de segurança e indicadores de compliance."
          />
        </div>
      </div>
    </div>
  );
};

function ReportCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <Card className="shadow-sm border-dashed border-2 border-border hover:border-solid hover:border-primary/30 hover:shadow-md transition-all cursor-pointer">
      <CardContent className="py-8 text-center space-y-3">
        <div className="mx-auto">{icon}</div>
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">{description}</p>
        <p className="text-xs text-muted-foreground/60 mt-2">🚧 Em desenvolvimento</p>
      </CardContent>
    </Card>
  );
}

export default AdminReports;
