import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, Upload, FileJson, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { downloadTemplatesJSON } from '@/lib/template-export';
import { validateImportJSON, readFileAsText, deduplicateTemplateTitle } from '@/lib/template-import';

interface TemplateImportExportProps {
  templates: any[];
  existingTitles: string[];
  onImport: (templates: Array<{ title: string; payload: any }>) => Promise<void>;
}

export const TemplateImportExport: React.FC<TemplateImportExportProps> = ({
  templates,
  existingTitles,
  onImport,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const handleExport = () => {
    if (templates.length === 0) {
      toast.error('Nenhum modelo para exportar');
      return;
    }

    try {
      downloadTemplatesJSON(templates);
      toast.success(`${templates.length} modelos exportados com sucesso`);
    } catch (error) {
      console.error('Erro ao exportar modelos:', error);
      toast.error('Erro ao exportar modelos');
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      toast.error('Por favor, selecione um arquivo JSON válido');
      return;
    }

    setImporting(true);
    try {
      const text = await readFileAsText(file);
      const importData = validateImportJSON(text);

      // Deduplicate titles
      const templatesWithUniqueTitles = importData.templates.map(t => ({
        title: deduplicateTemplateTitle(t.title, existingTitles),
        payload: t.payload,
      }));

      await onImport(templatesWithUniqueTitles);
      toast.success(`${templatesWithUniqueTitles.length} modelos importados com sucesso`);
    } catch (error) {
      console.error('Erro ao importar modelos:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao importar modelos');
    } finally {
      setImporting(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileSelect}
        className="hidden"
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={importing}>
            {importing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <FileJson className="mr-2 h-4 w-4" />
                Import/Export
              </>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleExport} disabled={templates.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Exportar Todos ({templates.length})
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleImportClick} disabled={importing}>
            <Upload className="mr-2 h-4 w-4" />
            Importar Modelos
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};
