import React, { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { PaymentCardData } from './PaymentCard';
import { exportToXlsx } from '@/lib/excel-export';

// Types for lazy-loaded libraries
type JsPDFType = typeof import('jspdf').default;
type AutoTableType = typeof import('jspdf-autotable').default;

interface PaymentsExportButtonProps {
  payments: PaymentCardData[];
  dateRange?: { from: Date; to: Date };
  disabled?: boolean;
}

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'proposed': return 'Pendente';
    case 'paid_by_producer': return 'Aguardando Motorista';
    case 'completed': return 'Concluído';
    default: return status;
  }
};

export const PaymentsExportButton: React.FC<PaymentsExportButtonProps> = ({
  payments,
  dateRange,
  disabled = false,
}) => {
  const [isExporting, setIsExporting] = useState(false);

  const getFileName = useCallback((extension: string) => {
    const date = format(new Date(), 'yyyy-MM-dd');
    return `pagamentos-produtor-${date}.${extension}`;
  }, []);

  const calculateSummary = useCallback(() => {
    const pending = payments.filter(p => p.status === 'proposed');
    const awaiting = payments.filter(p => p.status === 'paid_by_producer');
    const completed = payments.filter(p => p.status === 'completed');

    return {
      totalPayments: payments.length,
      pendingCount: pending.length,
      pendingValue: pending.reduce((sum, p) => sum + p.amount, 0),
      awaitingCount: awaiting.length,
      awaitingValue: awaiting.reduce((sum, p) => sum + p.amount, 0),
      completedCount: completed.length,
      completedValue: completed.reduce((sum, p) => sum + p.amount, 0),
      totalValue: payments.reduce((sum, p) => sum + p.amount, 0),
    };
  }, [payments]);

  const exportToPDF = useCallback(async () => {
    setIsExporting(true);
    try {
      // Lazy load PDF libraries only when needed
      const [jsPDFModule, autoTableModule] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable')
      ]);
      
      const jsPDF = jsPDFModule.default as JsPDFType;
      const autoTable = autoTableModule.default as AutoTableType;
      
      const doc = new jsPDF();
      let yPosition = 20;
      const summary = calculateSummary();

      // Header
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('Relatório de Pagamentos', 14, yPosition);
      yPosition += 10;

      // Date info
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      if (dateRange) {
        doc.text(
          `Período: ${format(dateRange.from, 'dd/MM/yyyy', { locale: ptBR })} - ${format(dateRange.to, 'dd/MM/yyyy', { locale: ptBR })}`,
          14,
          yPosition
        );
        yPosition += 5;
      }
      doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, 14, yPosition);
      yPosition += 15;

      // Reset text color
      doc.setTextColor(0);

      // Summary section
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Resumo Financeiro', 14, yPosition);
      yPosition += 8;

      autoTable(doc, {
        startY: yPosition,
        head: [['Categoria', 'Quantidade', 'Valor (R$)']],
        body: [
          ['Pendentes', summary.pendingCount.toString(), summary.pendingValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })],
          ['Aguardando Confirmação', summary.awaitingCount.toString(), summary.awaitingValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })],
          ['Concluídos', summary.completedCount.toString(), summary.completedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })],
          ['TOTAL', summary.totalPayments.toString(), summary.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })],
        ],
        theme: 'striped',
        headStyles: { fillColor: [34, 139, 34] },
        margin: { left: 14, right: 14 },
        footStyles: { fontStyle: 'bold' },
      });
      yPosition = (doc as typeof doc & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;

      // Payments detail section
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Detalhes dos Pagamentos', 14, yPosition);
      yPosition += 8;

      autoTable(doc, {
        startY: yPosition,
        head: [['Data', 'Motorista', 'Rota', 'Carga', 'Valor (R$)', 'Status']],
        body: payments.map(p => [
          format(new Date(p.created_at), 'dd/MM/yy', { locale: ptBR }),
          p.driver?.full_name || 'N/A',
          p.freight ? `${p.freight.origin_city || '?'}/${p.freight.origin_state || '?'} → ${p.freight.destination_city || '?'}/${p.freight.destination_state || '?'}` : 'N/A',
          p.freight?.cargo_type || 'N/A',
          p.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
          getStatusLabel(p.status),
        ]),
        theme: 'striped',
        headStyles: { fillColor: [34, 139, 34] },
        margin: { left: 14, right: 14 },
        styles: { fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 20 },
          1: { cellWidth: 30 },
          2: { cellWidth: 50 },
          3: { cellWidth: 25 },
          4: { cellWidth: 25 },
          5: { cellWidth: 30 },
        },
      });

      doc.save(getFileName('pdf'));
      toast.success('Relatório PDF exportado com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      toast.error('Exportação PDF indisponível. Tente novamente.');
    } finally {
      setIsExporting(false);
    }
  }, [payments, dateRange, calculateSummary, getFileName]);

  const exportToExcel = useCallback(async () => {
    setIsExporting(true);
    try {
      const summary = calculateSummary();

      // Summary sheet data
      const summaryData: (string | number)[][] = [
        ['Relatório de Pagamentos - Produtor', '', ''],
        ['', '', ''],
        ['Gerado em', format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR }), ''],
      ];
      
      if (dateRange) {
        summaryData.push(['Período', `${format(dateRange.from, 'dd/MM/yyyy')} - ${format(dateRange.to, 'dd/MM/yyyy')}`, '']);
      }
      
      summaryData.push(
        ['', '', ''],
        ['RESUMO FINANCEIRO', '', ''],
        ['Categoria', 'Quantidade', 'Valor (R$)'],
        ['Pendentes', summary.pendingCount, summary.pendingValue],
        ['Aguardando Confirmação', summary.awaitingCount, summary.awaitingValue],
        ['Concluídos', summary.completedCount, summary.completedValue],
        ['TOTAL', summary.totalPayments, summary.totalValue]
      );

      // Payments detail sheet data
      const paymentsData: (string | number)[][] = [
        ['Data', 'Motorista', 'Telefone', 'Origem', 'Destino', 'Tipo de Carga', 'Distância (km)', 'Valor do Frete (R$)', 'Valor do Pagamento (R$)', 'Status', 'Observações'],
        ...payments.map(p => [
          format(new Date(p.created_at), 'dd/MM/yyyy', { locale: ptBR }),
          p.driver?.full_name || 'N/A',
          p.driver?.contact_phone || 'N/A',
          p.freight ? `${p.freight.origin_city || '?'}/${p.freight.origin_state || '?'}` : 'N/A',
          p.freight ? `${p.freight.destination_city || '?'}/${p.freight.destination_state || '?'}` : 'N/A',
          p.freight?.cargo_type || 'N/A',
          p.freight?.distance_km || 0,
          p.freight?.price || 0,
          p.amount,
          getStatusLabel(p.status),
          p.notes || '',
        ])
      ];

      exportToXlsx({
        fileName: getFileName('xlsx'),
        sheets: [
          { name: 'Resumo', data: summaryData, columnWidths: [25, 15, 20] },
          { name: 'Pagamentos', data: paymentsData, columnWidths: [12, 25, 15, 20, 20, 15, 12, 18, 20, 22, 30] }
        ]
      });
      
      toast.success('Relatório Excel exportado com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar Excel:', error);
      toast.error('Exportação Excel indisponível. Tente novamente.');
    } finally {
      setIsExporting(false);
    }
  }, [payments, dateRange, calculateSummary, getFileName]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || isExporting || payments.length === 0}
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-background border shadow-lg z-50">
        <DropdownMenuItem onClick={exportToPDF}>
          <FileText className="h-4 w-4 mr-2" />
          Exportar PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToExcel}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Exportar Excel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
