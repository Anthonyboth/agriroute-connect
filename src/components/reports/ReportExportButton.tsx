import React, { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import type { DateRange, ExportFormat } from '@/types/reports';

interface ExportSection {
  title: string;
  type: 'kpi' | 'table' | 'list';
  data: Array<{ label: string; value: string | number }> | Array<Record<string, unknown>>;
  columns?: { key: string; label: string }[];
}

interface ReportExportButtonProps {
  reportTitle: string;
  dateRange: DateRange;
  sections: ExportSection[];
  disabled?: boolean;
  className?: string;
}

export const ReportExportButton: React.FC<ReportExportButtonProps> = ({
  reportTitle,
  dateRange,
  sections,
  disabled = false,
  className,
}) => {
  const [isExporting, setIsExporting] = useState(false);

  const getFileName = useCallback((extension: string) => {
    const fromDate = format(dateRange.from, 'yyyy-MM-dd');
    const toDate = format(dateRange.to, 'yyyy-MM-dd');
    const titleSlug = reportTitle.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    return `relatorio-${titleSlug}-${fromDate}-${toDate}.${extension}`;
  }, [reportTitle, dateRange]);

  const exportToPDF = useCallback(async () => {
    setIsExporting(true);
    try {
      const doc = new jsPDF();
      let yPosition = 20;

      // Header
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(reportTitle, 14, yPosition);
      yPosition += 10;

      // Date range
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      doc.text(
        `Período: ${format(dateRange.from, 'dd/MM/yyyy', { locale: ptBR })} - ${format(dateRange.to, 'dd/MM/yyyy', { locale: ptBR })}`,
        14,
        yPosition
      );
      yPosition += 5;
      doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, 14, yPosition);
      yPosition += 15;

      // Reset text color
      doc.setTextColor(0);

      // Sections
      for (const section of sections) {
        // Section title
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(section.title, 14, yPosition);
        yPosition += 8;

        if (section.type === 'kpi' || section.type === 'list') {
          const kpiData = section.data as Array<{ label: string; value: string | number }>;
          autoTable(doc, {
            startY: yPosition,
            head: [['Métrica', 'Valor']],
            body: kpiData.map(item => [item.label, String(item.value)]),
            theme: 'striped',
            headStyles: { fillColor: [41, 128, 185] },
            margin: { left: 14, right: 14 },
          });
          yPosition = (doc as typeof doc & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
        } else if (section.type === 'table' && section.columns) {
          const tableData = section.data as Array<Record<string, unknown>>;
          autoTable(doc, {
            startY: yPosition,
            head: [section.columns.map(col => col.label)],
            body: tableData.map(row => section.columns!.map(col => String(row[col.key] ?? ''))),
            theme: 'striped',
            headStyles: { fillColor: [41, 128, 185] },
            margin: { left: 14, right: 14 },
          });
          yPosition = (doc as typeof doc & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
        }

        // Check if we need a new page
        if (yPosition > 270) {
          doc.addPage();
          yPosition = 20;
        }
      }

      doc.save(getFileName('pdf'));
      toast.success('Relatório PDF exportado com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      toast.error('Erro ao exportar PDF');
    } finally {
      setIsExporting(false);
    }
  }, [reportTitle, dateRange, sections, getFileName]);

  const exportToExcel = useCallback(async () => {
    setIsExporting(true);
    try {
      const workbook = XLSX.utils.book_new();

      // Summary sheet
      const summaryData = [
        ['Relatório', reportTitle],
        ['Período', `${format(dateRange.from, 'dd/MM/yyyy')} - ${format(dateRange.to, 'dd/MM/yyyy')}`],
        ['Gerado em', format(new Date(), 'dd/MM/yyyy HH:mm')],
        [''],
      ];

      // Add each section
      for (const section of sections) {
        summaryData.push([section.title]);
        
        if (section.type === 'kpi' || section.type === 'list') {
          const kpiData = section.data as Array<{ label: string; value: string | number }>;
          kpiData.forEach(item => {
            summaryData.push([item.label, String(item.value)]);
          });
        } else if (section.type === 'table' && section.columns) {
          const tableData = section.data as Array<Record<string, unknown>>;
          summaryData.push(section.columns.map(col => col.label));
          tableData.forEach(row => {
            summaryData.push(section.columns!.map(col => String(row[col.key] ?? '')));
          });
        }
        
        summaryData.push(['']); // Empty row between sections
      }

      const worksheet = XLSX.utils.aoa_to_sheet(summaryData);
      
      // Set column widths
      worksheet['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 20 }];
      
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Resumo');

      // Generate file
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, getFileName('xlsx'));
      
      toast.success('Relatório Excel exportado com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar Excel:', error);
      toast.error('Erro ao exportar Excel');
    } finally {
      setIsExporting(false);
    }
  }, [reportTitle, dateRange, sections, getFileName]);

  const handleExport = useCallback((format: ExportFormat) => {
    if (format === 'pdf') {
      exportToPDF();
    } else {
      exportToExcel();
    }
  }, [exportToPDF, exportToExcel]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || isExporting}
          className={className}
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport('pdf')}>
          <FileText className="h-4 w-4 mr-2" />
          Exportar PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('excel')}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Exportar Excel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
