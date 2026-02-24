import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAdminApi } from '@/hooks/useAdminApi';
import { AppSpinner } from '@/components/ui/AppSpinner';
import { Menu, Save } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { toast } from 'sonner';

const SETTING_LABELS: Record<string, { title: string; description: string }> = {
  rejection_categories: { title: 'Categorias de Reprovação', description: 'Lista de motivos para reprovar cadastros' },
  required_documents: { title: 'Documentos Obrigatórios', description: 'Documentos exigidos por tipo de perfil' },
  needs_fix_templates: { title: 'Templates de Correção', description: 'Mensagens pré-definidas para solicitar correção' },
  rejection_templates: { title: 'Templates de Reprovação', description: 'Mensagens pré-definidas para reprovação' },
};

const AdminSettingsPage = () => {
  const { callApi } = useAdminApi();
  const [settings, setSettings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await callApi<any>('settings');
      if (data) {
        setSettings(data.data || []);
        const vals: Record<string, string> = {};
        data.data?.forEach((s: any) => {
          vals[s.setting_key] = JSON.stringify(s.setting_value, null, 2);
        });
        setEditValues(vals);
      }
      setLoading(false);
    };
    fetchSettings();
  }, []);

  const handleSave = async (key: string) => {
    try {
      const parsed = JSON.parse(editValues[key]);
      setSaving(key);
      const { error } = await callApi('settings', {
        method: 'PUT',
        body: { action: 'update', setting_key: key, setting_value: parsed },
      });
      if (error) {
        toast.error(`Erro: ${error}`);
      } else {
        toast.success('Configuração salva');
      }
    } catch {
      toast.error('JSON inválido');
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <div className="flex-1 flex items-center justify-center"><AppSpinner /></div>;

  return (
    <div className="flex-1 bg-muted/30">
      <header className="bg-card border-b border-border px-6 py-4 flex items-center gap-4">
        <SidebarTrigger className="p-2 hover:bg-muted rounded-md">
          <Menu className="h-5 w-5" />
        </SidebarTrigger>
        <h1 className="text-xl font-semibold text-foreground">Configurações</h1>
      </header>

      <div className="p-6 space-y-6">
        {settings.map((setting: any) => {
          const info = SETTING_LABELS[setting.setting_key] || { title: setting.setting_key, description: setting.description };
          return (
            <Card key={setting.id}>
              <CardHeader>
                <CardTitle className="text-lg">{info.title}</CardTitle>
                <p className="text-sm text-muted-foreground">{info.description}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={editValues[setting.setting_key] || ''}
                  onChange={(e) => setEditValues(prev => ({ ...prev, [setting.setting_key]: e.target.value }))}
                  rows={6}
                  className="font-mono text-sm"
                />
                <Button
                  size="sm"
                  onClick={() => handleSave(setting.setting_key)}
                  disabled={saving === setting.setting_key}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving === setting.setting_key ? 'Salvando...' : 'Salvar'}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default AdminSettingsPage;
