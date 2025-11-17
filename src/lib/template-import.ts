interface ImportedTemplate {
  title: string;
  payload: any;
}

interface ImportData {
  version: string;
  exported_at: string;
  templates: ImportedTemplate[];
}

export const validateImportJSON = (jsonString: string): ImportData => {
  try {
    const data = JSON.parse(jsonString);
    
    if (!data.version || !data.templates || !Array.isArray(data.templates)) {
      throw new Error('Formato de arquivo inválido');
    }

    if (data.version !== '1.0') {
      throw new Error(`Versão não suportada: ${data.version}`);
    }

    // Validar que cada template tem title e payload
    for (const template of data.templates) {
      if (!template.title || !template.payload) {
        throw new Error('Template com dados incompletos');
      }
    }

    return data;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Arquivo JSON inválido');
    }
    throw error;
  }
};

export const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      resolve(text);
    };
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsText(file);
  });
};

export const deduplicateTemplateTitle = (title: string, existingTitles: string[]): string => {
  let newTitle = title;
  let counter = 1;

  while (existingTitles.includes(newTitle)) {
    newTitle = `${title} (Importado ${counter})`;
    counter++;
  }

  return newTitle;
};
