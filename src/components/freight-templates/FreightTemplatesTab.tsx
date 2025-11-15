import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileText, Trash2, Edit, Loader2 } from 'lucide-react';
import { getCargoTypeLabel } from '@/lib/cargo-types';

interface FreightTemplate {
  id: string;
  title: string;
  payload: any;
  created_at: string;
  updated_at: string;
}

interface FreightTemplatesTabProps {
  producerId: string;
  onUseTemplate: (templateData: any) => void;
}

export const FreightTemplatesTab: React.FC<FreightTemplatesTabProps> = ({
  producerId,
  onUseTemplate,
}) => {
  const [templates, setTemplates] = useState<FreightTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('freight_templates')
        .select('*')
        .eq('producer_id', producerId)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error: any) {
      console.error('Erro ao buscar modelos:', error);
      toast.error('Erro ao carregar modelos');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (templateId: string) => {
    if (deleting) return;
    
    setDeleting(templateId);
    try {
      const { error } = await supabase
        .from('freight_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;

      toast.success('Modelo excluído com sucesso');
      fetchTemplates();
    } catch (error: any) {
      console.error('Erro ao excluir modelo:', error);
      toast.error('Erro ao excluir modelo');
    } finally {
      setDeleting(null);
    }
  };

  useEffect(() => {
    if (producerId) {
      fetchTemplates();
    }
  }, [producerId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">
          Nenhum modelo salvo
        </h3>
        <p className="text-muted-foreground">
          Salve modelos de fretes para reutilizar configurações rapidamente
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {templates.length} {templates.length === 1 ? 'modelo salvo' : 'modelos salvos'}
      </p>
      
      <div className="grid gap-4 md:grid-cols-2">
        {templates.map((template) => {
          const payload = template.payload || {};
          
          return (
            <Card key={template.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base font-semibold truncate">
                      {template.title}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      Atualizado {format(new Date(template.updated_at), "d 'de' MMMM, HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                </div>
              </CardHeader>
              
              <CardContent className="space-y-3">
                <div className="space-y-2 text-sm">
                  {payload.cargo_type && (
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {getCargoTypeLabel(payload.cargo_type)}
                      </Badge>
                    </div>
                  )}
                  
                  {payload.weight && (
                    <p className="text-muted-foreground">
                      Peso: <span className="text-foreground font-medium">{payload.weight}</span>
                    </p>
                  )}
                  
                  {payload.origin_city && payload.destination_city && (
                    <p className="text-muted-foreground text-xs">
                      {payload.origin_city}/{payload.origin_state} → {payload.destination_city}/{payload.destination_state}
                    </p>
                  )}
                  
                  {payload.pricing_type && (
                    <p className="text-muted-foreground text-xs">
                      Tipo de preço: <span className="text-foreground">{payload.pricing_type === 'FIXED' ? 'Fixo' : 'Por KM'}</span>
                    </p>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="default"
                    size="sm"
                    className="flex-1"
                    onClick={() => onUseTemplate(template.payload)}
                  >
                    <Edit className="h-3.5 w-3.5 mr-1.5" />
                    Usar Modelo
                  </Button>
                  
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={deleting === template.id}
                    onClick={() => handleDelete(template.id)}
                  >
                    {deleting === template.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
