import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileText, Loader2, Check, X, Users } from 'lucide-react';
import { getCargoTypeLabel } from '@/lib/cargo-types';
import { TemplateCardActions } from './TemplateCardActions';
import { ShareTemplateDialog } from './ShareTemplateDialog';
import { TemplateImportExport } from './TemplateImportExport';

interface FreightTemplate {
  id: string;
  title: string;
  payload: any;
  created_at: string;
  updated_at: string;
  producer_id: string;
  shared_with_company: boolean;
  company_id: string | null;
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
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareTemplateId, setShareTemplateId] = useState<string | null>(null);
  const [userCompanyId, setUserCompanyId] = useState<string | null>(null);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      
      // Buscar modelos próprios primeiro
      const { data, error } = await supabase
        .from('freight_templates')
        .select('*')
        .eq('producer_id', producerId)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      
      // TODO: Para compartilhamento, precisaríamos buscar company_id do usuário
      // Por enquanto, mostrar apenas modelos próprios
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
    
    if (!confirm('Tem certeza que deseja excluir este modelo?')) return;
    
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

  const handleRename = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setEditingTemplateId(templateId);
      setEditingTitle(template.title);
    }
  };

  const handleSaveRename = async (templateId: string) => {
    if (!editingTitle.trim()) {
      toast.error('O título não pode estar vazio');
      return;
    }

    try {
      const { error } = await supabase
        .from('freight_templates')
        .update({ 
          title: editingTitle.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', templateId);

      if (error) throw error;

      toast.success('Modelo renomeado com sucesso');
      setEditingTemplateId(null);
      setEditingTitle('');
      fetchTemplates();
    } catch (error: any) {
      console.error('Erro ao renomear modelo:', error);
      toast.error('Erro ao renomear modelo');
    }
  };

  const handleCancelRename = () => {
    setEditingTemplateId(null);
    setEditingTitle('');
  };

  const handleDuplicate = async (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    try {
      const newTitle = `Cópia de ${template.title} - ${format(new Date(), 'dd/MM HH:mm')}`;
      
      const { error } = await supabase
        .from('freight_templates')
        .insert({
          producer_id: producerId,
          title: newTitle,
          payload: template.payload,
          shared_with_company: false,
          company_id: userCompanyId,
        });

      if (error) throw error;

      toast.success('Modelo duplicado com sucesso');
      fetchTemplates();
    } catch (error: any) {
      console.error('Erro ao duplicar modelo:', error);
      toast.error('Erro ao duplicar modelo');
    }
  };

  const handleShareClick = (templateId: string) => {
    setShareTemplateId(templateId);
    setShareDialogOpen(true);
  };

  const handleShareConfirm = async (share: boolean) => {
    if (!shareTemplateId || !userCompanyId) return;

    try {
      const { error } = await supabase
        .from('freight_templates')
        .update({
          shared_with_company: share,
          company_id: share ? userCompanyId : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', shareTemplateId);

      if (error) throw error;

      toast.success(
        share
          ? 'Modelo compartilhado com a empresa'
          : 'Compartilhamento revogado'
      );
      fetchTemplates();
    } catch (error: any) {
      console.error('Erro ao compartilhar modelo:', error);
      toast.error('Erro ao atualizar compartilhamento');
    }
  };

  const handleImportTemplates = async (importedTemplates: Array<{ title: string; payload: any }>) => {
    try {
      const templatesToInsert = importedTemplates.map(t => ({
        producer_id: producerId,
        title: t.title,
        payload: t.payload,
        shared_with_company: false,
        company_id: userCompanyId,
      }));

      const { error } = await supabase
        .from('freight_templates')
        .insert(templatesToInsert);

      if (error) throw error;

      fetchTemplates();
    } catch (error: any) {
      console.error('Erro ao importar modelos:', error);
      throw error;
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

  const shareTemplate = templates.find(t => t.id === shareTemplateId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {templates.length} {templates.length === 1 ? 'modelo salvo' : 'modelos salvos'}
        </p>
        <TemplateImportExport
          templates={templates}
          existingTitles={templates.map(t => t.title)}
          onImport={handleImportTemplates}
        />
      </div>
      
      <div className="grid gap-4 md:grid-cols-2">
        {templates.map((template) => {
          const payload = template.payload || {};
          const isOwner = template.producer_id === producerId;
          const isShared = template.shared_with_company && template.company_id;
          const isEditing = editingTemplateId === template.id;
          
          return (
            <Card key={template.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleSaveRename(template.id);
                            } else if (e.key === 'Escape') {
                              handleCancelRename();
                            }
                          }}
                          className="h-8"
                          autoFocus
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSaveRename(template.id)}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleCancelRename}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base font-semibold truncate">
                            {template.title}
                          </CardTitle>
                          {isShared && (
                            <Badge variant="secondary" className="text-xs flex-shrink-0">
                              <Users className="h-3 w-3 mr-1" />
                              Compartilhado
                            </Badge>
                          )}
                          {!isOwner && (
                            <Badge variant="outline" className="text-xs flex-shrink-0">
                              Empresa
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Atualizado {format(new Date(template.updated_at), "d 'de' MMMM, HH:mm", { locale: ptBR })}
                        </p>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <TemplateCardActions
                      templateId={template.id}
                      isOwner={isOwner}
                      isShared={!!isShared}
                      onRename={handleRename}
                      onDuplicate={handleDuplicate}
                      onDelete={handleDelete}
                      onShare={handleShareClick}
                      disabled={deleting === template.id}
                    />
                  </div>
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
                    disabled={isEditing}
                  >
                    Usar Modelo
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {shareTemplate && (
        <ShareTemplateDialog
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          templateTitle={shareTemplate.title}
          isCurrentlyShared={shareTemplate.shared_with_company}
          onConfirm={handleShareConfirm}
        />
      )}
    </div>
  );
};
