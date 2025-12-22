import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatsCard } from '@/components/ui/stats-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, TrendingUp, TrendingDown, Download, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatBRL, formatDate } from '@/lib/formatters';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

interface Transaction {
  id: string;
  type: 'CREDIT' | 'DEBIT';
  amount: number;
  description: string;
  status: string;
  created_at: string;
  freight_id?: string;
}

interface CompanyFinancialDashboardProps {
  companyId: string;
  companyName?: string;
}

export function CompanyFinancialDashboard({ companyId, companyName = 'Empresa' }: CompanyFinancialDashboardProps) {
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Query real data from financial_transactions table with timeout
  const { data: transactions = [], isLoading, error, isError } = useQuery({
    queryKey: ['financial-transactions', companyId, period],
    queryFn: async () => {
      const now = new Date();
      let startDate = new Date();
      
      switch (period) {
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(now.getMonth() - 1);
          break;
        case 'quarter':
          startDate.setMonth(now.getMonth() - 3);
          break;
        case 'year':
          startDate.setFullYear(now.getFullYear() - 1);
          break;
      }

      const { data, error } = await supabase
        .from('financial_transactions')
        .select('*')
        .eq('company_id', companyId)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as Transaction[];
    },
    enabled: !!companyId,
    staleTime: 30000, // Cache por 30 segundos
    refetchInterval: 60000, // Polling a cada 60s em vez de WebSocket
    retry: 2,
  });

  // Calculate summary
  const summary = useMemo(() => {
    const credits = transactions
      .filter(t => t.type === 'CREDIT')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const debits = transactions
      .filter(t => t.type === 'DEBIT')
      .reduce((sum, t) => sum + t.amount, 0);
    
    return {
      balance: credits - debits,
      credits,
      debits,
      transactionCount: transactions.length
    };
  }, [transactions]);

  // Prepare chart data
  const evolutionData = useMemo(() => {
    const grouped = transactions.reduce((acc, t) => {
      const date = new Date(t.created_at).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' });
      if (!acc[date]) acc[date] = { date, credits: 0, debits: 0 };
      
      if (t.type === 'CREDIT') acc[date].credits += t.amount;
      else acc[date].debits += t.amount;
      
      return acc;
    }, {} as Record<string, { date: string; credits: number; debits: number }>);
    
    return Object.values(grouped).reverse();
  }, [transactions]);

  const typeDistribution = useMemo(() => [
    { name: 'Entradas', value: summary.credits, color: '#22c55e' },
    { name: 'Saídas', value: summary.debits, color: '#ef4444' }
  ], [summary]);

  // Pagination
  const paginatedTransactions = useMemo(() => {
    const start = (page - 1) * pageSize;
    return transactions.slice(start, start + pageSize);
  }, [transactions, page]);

  const totalPages = Math.ceil(transactions.length / pageSize);

  // Export functions
  const exportToPDF = () => {
    try {
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text('Relatório Financeiro', 14, 15);
      doc.setFontSize(12);
      doc.text(`${companyName}`, 14, 22);
      doc.setFontSize(10);
      doc.text(`Período: ${getPeriodLabel(period)}`, 14, 28);
      doc.text(`Gerado em: ${formatDate(new Date().toISOString())}`, 14, 34);
      
      // Summary
      doc.setFontSize(11);
      doc.text(`Saldo: ${formatBRL(summary.balance)}`, 14, 44);
      doc.text(`Entradas: ${formatBRL(summary.credits)}`, 14, 50);
      doc.text(`Saídas: ${formatBRL(summary.debits)}`, 14, 56);
      
      // Table
      const tableData = transactions.map(t => [
        formatDate(t.created_at),
        t.type === 'CREDIT' ? 'Entrada' : 'Saída',
        t.description,
        formatBRL(t.amount),
        t.status
      ]);
      
      autoTable(doc, {
        startY: 64,
        head: [['Data', 'Tipo', 'Descrição', 'Valor', 'Status']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [34, 197, 94] }
      });
      
      doc.save(`relatorio_financeiro_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('Relatório PDF gerado!');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar PDF');
    }
  };

  const exportToExcel = () => {
    try {
      const summaryData = [
        ['Relatório Financeiro'],
        ['Empresa:', companyName],
        ['Período:', getPeriodLabel(period)],
        [],
        ['Saldo:', summary.balance],
        ['Entradas:', summary.credits],
        ['Saídas:', summary.debits],
        []
      ];
      
      const detailsData = [
        ['Data', 'Tipo', 'Descrição', 'Valor', 'Status']
      ];
      
      transactions.forEach(t => {
        summaryData.push([
          formatDate(t.created_at),
          t.type === 'CREDIT' ? 'Entrada' : 'Saída',
          t.description,
          t.amount.toString(),
          t.status
        ]);
      });
      
      const wb = XLSX.utils.book_new();
      const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
      const ws2 = XLSX.utils.aoa_to_sheet(detailsData);
      
      XLSX.utils.book_append_sheet(wb, ws1, 'Resumo');
      XLSX.utils.book_append_sheet(wb, ws2, 'Transações');
      
      XLSX.writeFile(wb, `relatorio_financeiro_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Relatório Excel gerado!');
    } catch (error) {
      console.error('Erro ao gerar Excel:', error);
      toast.error('Erro ao gerar Excel');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground">Carregando dados financeiros...</p>
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <Card className="border-destructive/50">
          <CardContent className="py-8 text-center">
            <p className="text-destructive mb-4">Erro ao carregar dados financeiros</p>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Dashboard Financeiro</h2>
          <p className="text-muted-foreground">Acompanhe suas transações e saldo</p>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Última Semana</SelectItem>
              <SelectItem value="month">Último Mês</SelectItem>
              <SelectItem value="quarter">Último Trimestre</SelectItem>
              <SelectItem value="year">Último Ano</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportToPDF}>
            <Download className="h-4 w-4 mr-2" />
            PDF
          </Button>
          <Button variant="outline" onClick={exportToExcel}>
            <Download className="h-4 w-4 mr-2" />
            Excel
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Atual</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBRL(summary.balance)}</div>
            <p className={`text-xs ${summary.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {summary.balance >= 0 ? 'Positivo' : 'Negativo'}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Entradas</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatBRL(summary.credits)}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Saídas</CardTitle>
            <ArrowDownRight className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatBRL(summary.debits)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Evolução do Saldo</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={evolutionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value) => formatBRL(Number(value))} />
                <Legend />
                <Line type="monotone" dataKey="credits" stroke="#22c55e" name="Entradas" />
                <Line type="monotone" dataKey="debits" stroke="#ef4444" name="Saídas" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribuição Entradas vs Saídas</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={typeDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${formatBRL(entry.value)}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {typeDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatBRL(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Transações Recentes</CardTitle>
          <CardDescription>Página {page} de {totalPages}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {paginatedTransactions.map(transaction => (
              <div key={transaction.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={transaction.type === 'CREDIT' ? 'default' : 'destructive'}>
                      {transaction.type === 'CREDIT' ? 'Entrada' : 'Saída'}
                    </Badge>
                    <span className="font-medium">{transaction.description}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatDate(transaction.created_at)}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-bold ${transaction.type === 'CREDIT' ? 'text-green-600' : 'text-red-600'}`}>
                    {transaction.type === 'CREDIT' ? '+' : '-'} {formatBRL(transaction.amount)}
                  </p>
                  <Badge variant="outline" className="mt-1">
                    {transaction.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex justify-center gap-2 mt-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Anterior
            </Button>
            <span className="flex items-center px-4">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Próxima
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper functions
function getStartDate(period: 'week' | 'month' | 'quarter' | 'year'): Date {
  const now = new Date();
  switch (period) {
    case 'week':
      return new Date(now.setDate(now.getDate() - 7));
    case 'month':
      return new Date(now.setMonth(now.getMonth() - 1));
    case 'quarter':
      return new Date(now.setMonth(now.getMonth() - 3));
    case 'year':
      return new Date(now.setFullYear(now.getFullYear() - 1));
  }
}

function getPeriodLabel(period: 'week' | 'month' | 'quarter' | 'year'): string {
  switch (period) {
    case 'week': return 'Última Semana';
    case 'month': return 'Último Mês';
    case 'quarter': return 'Último Trimestre';
    case 'year': return 'Último Ano';
  }
}
