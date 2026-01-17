import React, { useState, memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  FileSpreadsheet, 
  FileText, 
  Download, 
  Calendar as CalendarIcon,
  BarChart3,
  DollarSign,
  Truck,
  Loader2,
  CheckCircle
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { exportToXlsx } from '@/lib/excel-export';
import { saveAs } from 'file-saver';

export type ReportType = 'performance' | 'financial' | 'operational';
export type ExportFormat = 'pdf' | 'excel' | 'csv';

interface DateRange {
  from: Date;
  to: Date;
}

interface ReportData {
  title: string;
  subtitle: string;
  generatedAt: string;
  dateRange: string;
  sections: ReportSection[];
}

interface ReportSection {
  title: string;
  type: 'table' | 'summary';
  headers?: string[];
  rows?: string[][];
  items?: { label: string; value: string | number }[];
}

interface UnifiedReportExporterProps {
  companyId?: string;
  userId?: string;
  userRole?: string;
  className?: string;
}

const REPORT_CONFIGS: Record<ReportType, {
  title: string;
  icon: typeof BarChart3;
  description: string;
}> = {
  performance: {
    title: 'Relatório de Performance',
    icon: BarChart3,
    description: 'Fretes completados, taxa de sucesso, tempo médio',
  },
  financial: {
    title: 'Relatório Financeiro',
    icon: DollarSign,
    description: 'Receitas, custos, lucros, comissões',
  },
  operational: {
    title: 'Relatório Operacional',
    icon: Truck,
    description: 'Quilometragem, combustível, manutenções',
  },
};

const PERIOD_PRESETS = [
  { label: 'Últimos 7 dias', getValue: () => ({ from: subDays(new Date(), 7), to: new Date() }) },
  { label: 'Últimos 30 dias', getValue: () => ({ from: subDays(new Date(), 30), to: new Date() }) },
  { label: 'Este mês', getValue: () => ({ from: startOfMonth(new Date()), to: new Date() }) },
  { label: 'Mês passado', getValue: () => ({ 
    from: startOfMonth(subMonths(new Date(), 1)), 
    to: endOfMonth(subMonths(new Date(), 1)) 
  }) },
  { label: 'Últimos 3 meses', getValue: () => ({ from: subMonths(new Date(), 3), to: new Date() }) },
];

/**
 * Unified Report Exporter Component
 * Exports performance, financial, and operational reports to PDF, Excel, CSV
 */
export const UnifiedReportExporter = memo(function UnifiedReportExporter({
  companyId,
  userId,
  userRole,
  className,
}: UnifiedReportExporterProps) {
  const [reportType, setReportType] = useState<ReportType>('performance');
  const [formats, setFormats] = useState<ExportFormat[]>(['pdf']);
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [periodPreset, setPeriodPreset] = useState<string>('');

  const toggleFormat = (format: ExportFormat) => {
    setFormats(prev => 
      prev.includes(format) 
        ? prev.filter(f => f !== format)
        : [...prev, format]
    );
  };

  const applyPreset = (presetLabel: string) => {
    const preset = PERIOD_PRESETS.find(p => p.label === presetLabel);
    if (preset) {
      setDateRange(preset.getValue());
      setPeriodPreset(presetLabel);
    }
  };

  // Generate mock report data (in real app, fetch from API)
  const generateReportData = (): ReportData => {
    const config = REPORT_CONFIGS[reportType];
    const dateRangeStr = `${format(dateRange.from, 'dd/MM/yyyy')} - ${format(dateRange.to, 'dd/MM/yyyy')}`;

    const sections: ReportSection[] = [];

    if (reportType === 'performance') {
      sections.push({
        title: 'Resumo de Performance',
        type: 'summary',
        items: [
          { label: 'Total de Fretes', value: 45 },
          { label: 'Fretes Completados', value: 42 },
          { label: 'Taxa de Sucesso', value: '93.3%' },
          { label: 'Tempo Médio de Entrega', value: '2.5 dias' },
          { label: 'Avaliação Média', value: '4.8/5' },
        ],
      });
      sections.push({
        title: 'Fretes por Status',
        type: 'table',
        headers: ['Status', 'Quantidade', 'Percentual'],
        rows: [
          ['Entregues', '42', '93.3%'],
          ['Em Trânsito', '2', '4.4%'],
          ['Cancelados', '1', '2.2%'],
        ],
      });
    } else if (reportType === 'financial') {
      sections.push({
        title: 'Resumo Financeiro',
        type: 'summary',
        items: [
          { label: 'Receita Total', value: 'R$ 125.450,00' },
          { label: 'Custos Operacionais', value: 'R$ 45.200,00' },
          { label: 'Lucro Bruto', value: 'R$ 80.250,00' },
          { label: 'Comissões Pagas', value: 'R$ 12.545,00' },
          { label: 'Lucro Líquido', value: 'R$ 67.705,00' },
        ],
      });
      sections.push({
        title: 'Receita por Categoria',
        type: 'table',
        headers: ['Categoria', 'Valor', 'Percentual'],
        rows: [
          ['Fretes Grãos', 'R$ 75.000,00', '59.8%'],
          ['Fretes Cargas Gerais', 'R$ 35.450,00', '28.3%'],
          ['Outros', 'R$ 15.000,00', '11.9%'],
        ],
      });
    } else {
      sections.push({
        title: 'Resumo Operacional',
        type: 'summary',
        items: [
          { label: 'KM Total Rodados', value: '45.670 km' },
          { label: 'Consumo de Combustível', value: '15.223 L' },
          { label: 'Média km/L', value: '3.0 km/L' },
          { label: 'Manutenções Realizadas', value: 5 },
          { label: 'Veículos Ativos', value: 12 },
        ],
      });
      sections.push({
        title: 'Consumo por Veículo',
        type: 'table',
        headers: ['Veículo', 'KM Rodados', 'Combustível (L)', 'Média'],
        rows: [
          ['ABC-1234', '8.540 km', '2.847 L', '3.0 km/L'],
          ['DEF-5678', '7.230 km', '2.410 L', '3.0 km/L'],
          ['GHI-9012', '6.890 km', '2.297 L', '3.0 km/L'],
        ],
      });
    }

    return {
      title: config.title,
      subtitle: `Período: ${dateRangeStr}`,
      generatedAt: format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }),
      dateRange: dateRangeStr,
      sections,
    };
  };

  // Export to PDF
  const exportToPDF = (data: ReportData) => {
    const doc = new jsPDF();
    let yPos = 20;

    // Title
    doc.setFontSize(18);
    doc.setTextColor(34, 139, 34);
    doc.text(data.title, 14, yPos);
    yPos += 10;

    // Subtitle
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(data.subtitle, 14, yPos);
    yPos += 8;
    doc.text(`Gerado em: ${data.generatedAt}`, 14, yPos);
    yPos += 15;

    // Sections
    data.sections.forEach(section => {
      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.text(section.title, 14, yPos);
      yPos += 8;

      if (section.type === 'summary' && section.items) {
        section.items.forEach(item => {
          doc.setFontSize(10);
          doc.text(`${item.label}: ${item.value}`, 20, yPos);
          yPos += 6;
        });
        yPos += 5;
      } else if (section.type === 'table' && section.headers && section.rows) {
        autoTable(doc, {
          startY: yPos,
          head: [section.headers],
          body: section.rows,
          theme: 'striped',
          headStyles: { fillColor: [34, 139, 34] },
          margin: { left: 14 },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }
    });

    doc.save(`${data.title.toLowerCase().replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  // Export to Excel
  const exportToExcel = (data: ReportData) => {
    const sheets = data.sections.map((section) => {
      let sheetData: (string | number)[][] = [];
      
      if (section.type === 'summary' && section.items) {
        sheetData = section.items.map(item => [item.label, typeof item.value === 'number' ? item.value : String(item.value)]);
      } else if (section.type === 'table' && section.headers && section.rows) {
        sheetData = [section.headers, ...section.rows];
      }

      return {
        name: section.title.substring(0, 31), // Excel limit
        data: sheetData,
        columnWidths: [30, 20, 20, 20]
      };
    });

    exportToXlsx({
      fileName: `${data.title.toLowerCase().replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`,
      sheets
    });
  };

  // Export to CSV
  const exportToCSV = (data: ReportData) => {
    let csvContent = '';

    data.sections.forEach(section => {
      csvContent += `\n${section.title}\n`;
      
      if (section.type === 'summary' && section.items) {
        section.items.forEach(item => {
          csvContent += `${item.label},${item.value}\n`;
        });
      } else if (section.type === 'table' && section.headers && section.rows) {
        csvContent += section.headers.join(',') + '\n';
        section.rows.forEach(row => {
          csvContent += row.join(',') + '\n';
        });
      }
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    saveAs(blob, `${data.title.toLowerCase().replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.csv`);
  };

  const handleExport = async () => {
    if (formats.length === 0) {
      toast({ title: 'Erro', description: 'Selecione ao menos um formato', variant: 'destructive' });
      return;
    }

    setIsGenerating(true);

    try {
      const data = generateReportData();

      if (formats.includes('pdf')) {
        exportToPDF(data);
      }
      if (formats.includes('excel')) {
        exportToExcel(data);
      }
      if (formats.includes('csv')) {
        exportToCSV(data);
      }

      toast({ 
        title: 'Sucesso', 
        description: `Relatório exportado em ${formats.join(', ').toUpperCase()}` 
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({ 
        title: 'Erro', 
        description: 'Falha ao gerar relatório', 
        variant: 'destructive' 
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const config = REPORT_CONFIGS[reportType];
  const Icon = config.icon;

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5 text-primary" />
          Exportar Relatórios
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Report Type Selection */}
        <div className="space-y-2">
          <Label>Tipo de Relatório</Label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(Object.keys(REPORT_CONFIGS) as ReportType[]).map(type => {
              const cfg = REPORT_CONFIGS[type];
              const TypeIcon = cfg.icon;
              return (
                <button
                  key={type}
                  onClick={() => setReportType(type)}
                  className={cn(
                    'p-4 rounded-xl border-2 text-left transition-all',
                    reportType === type
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  <TypeIcon className={cn(
                    'h-6 w-6 mb-2',
                    reportType === type ? 'text-primary' : 'text-muted-foreground'
                  )} />
                  <div className="font-medium text-sm">{cfg.title}</div>
                  <div className="text-xs text-muted-foreground mt-1">{cfg.description}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Date Range */}
        <div className="space-y-2">
          <Label>Período</Label>
          <div className="flex flex-wrap gap-2">
            {PERIOD_PRESETS.map(preset => (
              <Button
                key={preset.label}
                variant={periodPreset === preset.label ? 'default' : 'outline'}
                size="sm"
                onClick={() => applyPreset(preset.label)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
            <CalendarIcon className="h-4 w-4" />
            {format(dateRange.from, 'dd/MM/yyyy')} - {format(dateRange.to, 'dd/MM/yyyy')}
          </div>
        </div>

        {/* Export Formats */}
        <div className="space-y-2">
          <Label>Formatos de Exportação</Label>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={formats.includes('pdf')}
                onCheckedChange={() => toggleFormat('pdf')}
              />
              <FileText className="h-4 w-4 text-red-500" />
              <span className="text-sm">PDF</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={formats.includes('excel')}
                onCheckedChange={() => toggleFormat('excel')}
              />
              <FileSpreadsheet className="h-4 w-4 text-green-600" />
              <span className="text-sm">Excel</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={formats.includes('csv')}
                onCheckedChange={() => toggleFormat('csv')}
              />
              <FileSpreadsheet className="h-4 w-4 text-blue-500" />
              <span className="text-sm">CSV</span>
            </label>
          </div>
        </div>

        {/* Export Button */}
        <Button
          onClick={handleExport}
          disabled={isGenerating || formats.length === 0}
          className="w-full"
          size="lg"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Gerando...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Exportar {config.title}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
});

export default UnifiedReportExporter;
