import { format } from 'date-fns';

interface FreightTemplate {
  id: string;
  title: string;
  payload: any;
  created_at: string;
  updated_at: string;
}

interface ExportData {
  version: string;
  exported_at: string;
  templates: Array<{
    title: string;
    payload: any;
  }>;
}

export const exportTemplatesToJSON = (templates: FreightTemplate[]): string => {
  const exportData: ExportData = {
    version: '1.0',
    exported_at: new Date().toISOString(),
    templates: templates.map(t => ({
      title: t.title,
      payload: t.payload,
    })),
  };

  return JSON.stringify(exportData, null, 2);
};

export const downloadTemplatesJSON = (templates: FreightTemplate[]) => {
  const json = exportTemplatesToJSON(templates);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `agriroute-modelos-${format(new Date(), 'yyyy-MM-dd-HHmm')}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
