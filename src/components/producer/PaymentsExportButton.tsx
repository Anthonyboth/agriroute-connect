import React, { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { PaymentCardData } from './PaymentCard';

// Types for lazy-loaded libraries
type JsPDFType = typeof import('jspdf').default;
type AutoTableType = typeof import('jspdf-autotable').default;
type XLSXType = typeof import('xlsx');
type SaveAsType = typeof import('file-saver').saveAs;

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
      // Lazy load Excel libraries only when needed
      const [xlsxModule, fileSaverModule] = await Promise.all([
        import('xlsx'),
        import('file-saver')
      ]);
      
      const XLSX = xlsxModule as XLSXType;
      const saveAs = fileSaverModule.saveAs as SaveAsType;
      
      const workbook = XLSX.utils.book_new();
      const summary = calculateSummary();

      // Summary sheet
      const summaryData = [
        ['Relatório de Pagamentos - Produtor'],
        [''],
        ['Gerado em', format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })],
        dateRange ? ['Período', `${format(dateRange.from, 'dd/MM/yyyy')} - ${format(dateRange.to, 'dd/MM/yyyy')}`] : [],
        [''],
        ['RESUMO FINANCEIRO'],
        ['Categoria', 'Quantidade', 'Valor (R$)'],
        ['Pendentes', summary.pendingCount, summary.pendingValue],
        ['Aguardando Confirmação', summary.awaitingCount, summary.awaitingValue],
        ['Concluídos', summary.completedCount, summary.completedValue],
        ['TOTAL', summary.totalPayments, summary.totalValue],
      ].filter(row => row.length > 0);

      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      summarySheet['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumo');

      // Payments detail sheet
      const paymentsData = payments.map(p => ({
        'Data': format(new Date(p.created_at), 'dd/MM/yyyy', { locale: ptBR }),
        'Motorista': p.driver?.full_name || 'N/A',
        'Telefone': p.driver?.contact_phone || 'N/A',
        'Origem': p.freight ? `${p.freight.origin_city || '?'}/${p.freight.origin_state || '?'}` : 'N/A',
        'Destino': p.freight ? `${p.freight.destination_city || '?'}/${p.freight.destination_state || '?'}` : 'N/A',
        'Tipo de Carga': p.freight?.cargo_type || 'N/A',
        'Distância (km)': p.freight?.distance_km || 0,
        'Valor do Frete (R$)': p.freight?.price || 0,
        'Valor do Pagamento (R$)': p.amount,
        'Status': getStatusLabel(p.status),
        'Observações': p.notes || '',
      }));

      const paymentsSheet = XLSX.utils.json_to_sheet(paymentsData);
      paymentsSheet['!cols'] = [
        { wch: 12 }, { wch: 25 }, { wch: 15 }, { wch: 20 }, { wch: 20 },
        { wch: 15 }, { wch: 12 }, { wch: 18 }, { wch: 20 }, { wch: 22 }, { wch: 30 }
      ];
      XLSX.utils.book_append_sheet(workbook, paymentsSheet, 'Pagamentos');

      // Generate file
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, getFileName('xlsx'));
      
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
