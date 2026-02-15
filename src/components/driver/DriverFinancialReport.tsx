import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDriverExpenses, DriverExpense } from '@/hooks/useDriverExpenses';
import { 
  TrendingUp, TrendingDown, DollarSign, Fuel, Gauge, 
  Calendar, Trash2, AlertCircle, Loader2, BarChart3
} from 'lucide-react';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface DriverFinancialReportProps {
  driverId: string;
}

const EXPENSE_TYPE_LABELS: Record<string, string> = {
  FUEL: 'Combustível',
  MAINTENANCE: 'Manutenção',
  TOLL: 'Pedágio',
  TIRE: 'Pneu',
  OTHER: 'Outros',
};

const EXPENSE_TYPE_COLORS: Record<string, string> = {
  FUEL: '#f59e0b',
  MAINTENANCE: '#3b82f6',
  TOLL: '#22c55e',
  TIRE: '#a855f7',
  OTHER: '#6b7280',
};

const formatBRL = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const DriverFinancialReport: React.FC<DriverFinancialReportProps> = ({ driverId }) => {
  const { expenses, earnings, financialSummary, isLoading, deleteExpense } = useDriverExpenses(driverId);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);

  // Guard: Se driverId estiver vazio, mostrar loading
  if (!driverId) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-28" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-28" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const { 
    totalEarnings, 
    totalExpenses, 
    netProfit, 
    avgKmPerLiter, 
    costPerKm,
    expensesByType,
    monthlyData,
    fuelHistory 
  } = financialSummary;

  // Dados para gráfico de pizza
  const pieData = Object.entries(expensesByType).map(([type, value]) => ({
    name: EXPENSE_TYPE_LABELS[type] || type,
    value,
    color: EXPENSE_TYPE_COLORS[type] || '#6b7280',
  }));

  const handleDeleteExpense = async () => {
    if (expenseToDelete) {
      await deleteExpense.mutateAsync(expenseToDelete);
      setExpenseToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cards de Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/40 dark:to-green-900/20 border-green-200 dark:border-green-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm font-medium">Ganhos Totais</span>
            </div>
            <p className="text-2xl font-bold text-green-700 dark:text-green-300">
              {formatBRL(totalEarnings)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/40 dark:to-red-900/20 border-red-200 dark:border-red-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-1">
              <TrendingDown className="h-4 w-4" />
              <span className="text-sm font-medium">Despesas Totais</span>
            </div>
            <p className="text-2xl font-bold text-red-700 dark:text-red-300">
              {formatBRL(totalExpenses)}
            </p>
          </CardContent>
        </Card>

        <Card className={`bg-gradient-to-br ${netProfit >= 0 ? 'from-blue-50 to-blue-100 dark:from-blue-950/40 dark:to-blue-900/20 border-blue-200 dark:border-blue-800' : 'from-orange-50 to-orange-100 dark:from-orange-950/40 dark:to-orange-900/20 border-orange-200 dark:border-orange-800'}`}>
          <CardContent className="pt-6">
            <div className={`flex items-center gap-2 ${netProfit >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'} mb-1`}>
              <DollarSign className="h-4 w-4" />
              <span className="text-sm font-medium">Lucro Líquido</span>
            </div>
            <p className={`text-2xl font-bold ${netProfit >= 0 ? 'text-blue-700 dark:text-blue-300' : 'text-orange-700 dark:text-orange-300'}`}>
              {formatBRL(netProfit)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/40 dark:to-amber-900/20 border-amber-200 dark:border-amber-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-1">
              <Fuel className="h-4 w-4" />
              <span className="text-sm font-medium">Média km/L</span>
            </div>
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">
              {avgKmPerLiter > 0 ? `${avgKmPerLiter.toFixed(2)} km/L` : 'N/A'}
            </p>
            {costPerKm > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                Custo: {formatBRL(costPerKm)}/km
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs de Gráficos e Histórico */}
      <Tabs defaultValue="charts" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="charts">
            <BarChart3 className="h-4 w-4 mr-2" />
            Gráficos
          </TabsTrigger>
          <TabsTrigger value="fuel">
            <Fuel className="h-4 w-4 mr-2" />
            Combustível
          </TabsTrigger>
          <TabsTrigger value="history">
            <Calendar className="h-4 w-4 mr-2" />
            Histórico
          </TabsTrigger>
        </TabsList>

        {/* Aba de Gráficos */}
        <TabsContent value="charts" className="space-y-6 mt-4">
          {/* Gráfico de Evolução Mensal */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Evolução Mensal (Ganhos vs Despesas)</CardTitle>
            </CardHeader>
            <CardContent>
              {monthlyData.some(d => d.earnings > 0 || d.expenses > 0) ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="month" fontSize={12} />
                    <YAxis fontSize={12} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                    <Tooltip 
                      formatter={(value: number) => formatBRL(value)}
                      labelStyle={{ color: 'var(--foreground)' }}
                      contentStyle={{ 
                        backgroundColor: 'var(--background)', 
                        border: '1px solid var(--border)',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="earnings" name="Ganhos" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="expenses" name="Despesas" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="profit" name="Lucro" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <AlertCircle className="h-12 w-12 mb-4 opacity-50" />
                  <p>Nenhum dado disponível ainda</p>
                  <p className="text-sm">Complete fretes e registre despesas para ver os gráficos</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Gráfico de Pizza - Distribuição de Despesas */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Distribuição de Despesas por Categoria</CardTitle>
            </CardHeader>
            <CardContent>
              {pieData.length > 0 ? (
                <div className="flex flex-col md:flex-row items-center justify-center gap-8">
                  <ResponsiveContainer width={300} height={250}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatBRL(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2">
                    {pieData.map((entry) => (
                      <div key={entry.name} className="flex items-center gap-3">
                        <div 
                          className="w-4 h-4 rounded-full" 
                          style={{ backgroundColor: entry.color }}
                        />
                        <span className="text-sm">{entry.name}</span>
                        <span className="text-sm font-semibold ml-auto">{formatBRL(entry.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                  <AlertCircle className="h-12 w-12 mb-4 opacity-50" />
                  <p>Nenhuma despesa registrada</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba de Combustível */}
        <TabsContent value="fuel" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Histórico de Consumo de Combustível</CardTitle>
            </CardHeader>
            <CardContent>
              {fuelHistory.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={fuelHistory}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis 
                      dataKey="date" 
                      fontSize={12}
                      tickFormatter={(d) => format(new Date(d), 'dd/MM', { locale: ptBR })}
                    />
                    <YAxis yAxisId="left" fontSize={12} />
                    <YAxis yAxisId="right" orientation="right" fontSize={12} />
                    <Tooltip 
                      labelFormatter={(d) => format(new Date(d as string), 'dd/MM/yyyy', { locale: ptBR })}
                      formatter={(value: number, name: string) => {
                        if (name === 'Litros') return `${value.toFixed(2)} L`;
                        if (name === 'km/L') return `${value.toFixed(2)} km/L`;
                        if (name === 'R$/L') return formatBRL(value);
                        return value;
                      }}
                      contentStyle={{ 
                        backgroundColor: 'var(--background)', 
                        border: '1px solid var(--border)',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                    <Bar yAxisId="left" dataKey="liters" name="Litros" fill="#f59e0b" />
                    <Bar yAxisId="right" dataKey="kmPerLiter" name="km/L" fill="#22c55e" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <Fuel className="h-12 w-12 mb-4 opacity-50" />
                  <p>Nenhum abastecimento registrado</p>
                  <p className="text-sm">Registre seus abastecimentos para acompanhar o consumo</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dicas de Economia */}
          {avgKmPerLiter > 0 && (
            <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 border-emerald-200 dark:border-emerald-800">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Gauge className="h-5 w-5 text-emerald-600" />
                  Análise de Consumo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span>Média de consumo:</span>
                  <Badge variant="outline" className="text-lg">
                    {avgKmPerLiter.toFixed(2)} km/L
                  </Badge>
                </div>
                {avgKmPerLiter >= 8 && avgKmPerLiter < 12 && (
                  <p className="text-sm text-emerald-600 dark:text-emerald-400">
                    ✅ Consumo dentro da média para veículos de carga
                  </p>
                )}
                {avgKmPerLiter >= 12 && (
                  <p className="text-sm text-emerald-600 dark:text-emerald-400">
                    🌟 Excelente! Seu veículo está muito econômico
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Aba de Histórico */}
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Histórico de Despesas</CardTitle>
            </CardHeader>
            <CardContent>
              {expenses.length > 0 ? (
                <div className="space-y-3">
                  {expenses.slice(0, 20).map((expense: DriverExpense) => (
                    <div 
                      key={expense.id} 
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: EXPENSE_TYPE_COLORS[expense.expense_type] }}
                        />
                        <div>
                          <p className="font-medium">
                            {EXPENSE_TYPE_LABELS[expense.expense_type]}
                            {expense.expense_type === 'FUEL' && expense.liters && (
                              <span className="text-muted-foreground font-normal ml-2">
                                ({expense.liters.toFixed(2)}L)
                              </span>
                            )}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(expense.expense_date), 'dd/MM/yyyy', { locale: ptBR })}
                            {expense.description && ` • ${expense.description}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-red-600 dark:text-red-400">
                          -{formatBRL(expense.amount)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => setExpenseToDelete(expense.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                  <Calendar className="h-12 w-12 mb-4 opacity-50" />
                  <p>Nenhuma despesa registrada</p>
                  <p className="text-sm">Use o formulário acima para adicionar</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={!!expenseToDelete} onOpenChange={() => setExpenseToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Despesa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A despesa será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteExpense}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteExpense.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Excluir'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
