import React from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { Button } from '@/components/ui/button';
import { formatBRL, formatKm, formatTons, formatDate } from '@/lib/formatters';
import { FileText, Table } from 'lucide-react';
import { ReportData } from '@/hooks/useFreightReportData';
import { UI_TEXTS } from '@/lib/ui-texts';

interface FreightReportExporterProps {
  data: ReportData;
  reportTitle: string;
}

export const FreightReportExporter: React.FC<FreightReportExporterProps> = ({ 
  data, 
  reportTitle 
}) => {
  
  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(18);
    doc.text(reportTitle, 14, 20);
    
    // Summary stats
    doc.setFontSize(12);
    let yPos = 35;
    doc.text(`Total de Fretes: ${data.summary.total}`, 14, yPos);
    yPos += 7;
    doc.text(`Valor Total: ${formatBRL(data.summary.totalValue)}`, 14, yPos);
    yPos += 7;
    doc.text(`Distância Total: ${formatKm(data.summary.totalDistance)}`, 14, yPos);
    yPos += 7;
    doc.text(`Peso Total: ${formatTons(data.summary.totalWeight)}`, 14, yPos);
    yPos += 7;
    doc.text(`Preço Médio: ${formatBRL(data.summary.avgPrice)}`, 14, yPos);
    yPos += 7;
    doc.text(`Distância Média: ${formatKm(data.summary.avgDistance)}`, 14, yPos);
    
    // Status breakdown
    yPos += 14;
    doc.text('Fretes por Status:', 14, yPos);
    yPos += 7;
    Object.entries(data.summary.byStatus).forEach(([status, count]) => {
      doc.text(`  ${status}: ${count}`, 14, yPos);
      yPos += 7;
    });
    
    // Freight table
    autoTable(doc, {
      startY: yPos + 10,
      head: [['ID', 'Carga', 'Origem', 'Destino', 'Data', 'Preço', 'Status']],
      body: data.freights.map(f => [
        f.id.substring(0, 8),
        f.cargo_type || 'N/A',
        f.origin_city || 'N/A',
        f.destination_city || 'N/A',
        formatDate(f.pickup_date),
        formatBRL(f.price),
        f.status
      ]),
      styles: { fontSize: 8 },
      theme: 'grid'
    });
    
    doc.save(`${reportTitle.toLowerCase().replace(/\s/g, '_')}_${Date.now()}.pdf`);
  };
  
  const exportToExcel = () => {
    // Summary sheet
    const summaryData = [
      ['Relatório', reportTitle],
      ['Data de Geração', new Date().toLocaleString('pt-BR')],
      [],
      ['Estatísticas Gerais'],
      ['Total de Fretes', data.summary.total],
      ['Valor Total (R$)', data.summary.totalValue],
      ['Distância Total (km)', data.summary.totalDistance],
      ['Peso Total (t)', data.summary.totalWeight],
      ['Preço Médio (R$)', data.summary.avgPrice],
      ['Distância Média (km)', data.summary.avgDistance],
      [],
      ['Fretes por Status'],
      ...Object.entries(data.summary.byStatus).map(([status, count]) => [status, count]),
      [],
      ['Fretes por Urgência'],
      ...Object.entries(data.summary.byUrgency).map(([urgency, count]) => [urgency, count])
    ];
    
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    
    // Freights sheet
    const freightsData = data.freights.map(f => ({
      'ID': f.id,
      'Tipo de Carga': f.cargo_type || 'N/A',
      'Peso (t)': f.weight || 0,
      'Origem Cidade': f.origin_city || 'N/A',
      'Origem Estado': f.origin_state || 'N/A',
      'Destino Cidade': f.destination_city || 'N/A',
      'Destino Estado': f.destination_state || 'N/A',
      'Data Coleta': formatDate(f.pickup_date),
      'Data Entrega': formatDate(f.delivery_date),
      'Distância (km)': f.distance_km || 0,
      'Preço (R$)': f.price || 0,
      'Status': f.status,
      'Urgência': f.urgency || 'LOW',
      'Motorista': f.profiles?.full_name || 'Aguardando'
    }));
    
    const freightsSheet = XLSX.utils.json_to_sheet(freightsData);
    
    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumo');
    XLSX.utils.book_append_sheet(workbook, freightsSheet, 'Fretes Detalhados');
    
    // Save file
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    saveAs(blob, `${reportTitle.toLowerCase().replace(/\s/g, '_')}_${Date.now()}.xlsx`);
  };
  
  return (
    <div className="flex gap-2" translate="no">
      <Button onClick={exportToPDF} variant="outline">
        <FileText className="mr-2 h-4 w-4" />
        {UI_TEXTS.EXPORTAR_PDF}
      </Button>
      <Button onClick={exportToExcel} variant="outline">
        <Table className="mr-2 h-4 w-4" />
        {UI_TEXTS.EXPORTAR_EXCEL}
      </Button>
    </div>
  );
};
