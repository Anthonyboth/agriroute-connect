import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Loader2, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TrustedEntity {
  id: string;
  entity_type: string;
  entity_value: string;
  reason: string;
  added_at: string;
  expires_at: string | null;
  is_active: boolean;
}

export const WhitelistManager = () => {
  const [entities, setEntities] = useState<TrustedEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const { toast } = useToast();

  const [newEntity, setNewEntity] = useState({
    entity_type: 'IP' as const,
    entity_value: '',
    reason: '',
    expires_at: ''
  });

  useEffect(() => {
    loadEntities();
  }, []);

  const loadEntities = async () => {
    try {
      const { data, error } = await supabase
        .from('trusted_entities')
        .select('*')
        .order('added_at', { ascending: false });

      if (error) throw error;
      setEntities(data || []);
    } catch (error: any) {
      console.error('[WhitelistManager] Load error:', error);
      toast({
        title: 'Erro ao Carregar',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const addEntity = async () => {
    if (!newEntity.entity_value || !newEntity.reason) {
      toast({
        title: 'Campos Obrigatórios',
        description: 'Preencha o valor da entidade e a razão',
        variant: 'destructive'
      });
      return;
    }

    setAdding(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('trusted_entities')
        .insert([{
          entity_type: newEntity.entity_type,
          entity_value: newEntity.entity_value,
          reason: newEntity.reason,
          expires_at: newEntity.expires_at || null,
          added_by: user.id
        }]);

      if (error) throw error;

      toast({
        title: '✅ Entidade Adicionada',
        description: `${newEntity.entity_type} ${newEntity.entity_value} adicionado à whitelist`
      });

      setNewEntity({
        entity_type: 'IP',
        entity_value: '',
        reason: '',
        expires_at: ''
      });

      await loadEntities();
    } catch (error: any) {
      console.error('[WhitelistManager] Add error:', error);
      toast({
        title: 'Erro ao Adicionar',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setAdding(false);
    }
  };

  const removeEntity = async (id: string) => {
    try {
      const { error } = await supabase
        .from('trusted_entities')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: '🗑️ Entidade Removida',
        description: 'Entidade desativada com sucesso'
      });

      await loadEntities();
    } catch (error: any) {
      console.error('[WhitelistManager] Remove error:', error);
      toast({
        title: 'Erro ao Remover',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="space-y-2">
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Shield className="h-5 w-5" />
          Gerenciar Whitelist de Entidades Confiáveis
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Marque IPs e usuários como confiáveis para reduzir falsos positivos em alertas de segurança
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add New Entity Form */}
        <div className="space-y-4 border border-border rounded-lg p-4 bg-card">
          <h3 className="text-sm font-semibold text-foreground">Adicionar Nova Entidade</h3>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="entity_type">Tipo</Label>
              <Select 
                value={newEntity.entity_type} 
                onValueChange={(value: any) => setNewEntity({...newEntity, entity_type: value})}
              >
                <SelectTrigger id="entity_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IP">IP Individual</SelectItem>
                  <SelectItem value="IP_RANGE">Faixa de IPs (CIDR)</SelectItem>
                  <SelectItem value="USER">Usuário (UUID)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="entity_value">Valor</Label>
              <Input
                id="entity_value"
                placeholder="Ex: 192.168.1.1 ou user-uuid"
                value={newEntity.entity_value}
                onChange={(e) => setNewEntity({...newEntity, entity_value: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Razão/Justificativa</Label>
            <Textarea
              id="reason"
              placeholder="Por que esta entidade é confiável?"
              value={newEntity.reason}
              onChange={(e) => setNewEntity({...newEntity, reason: e.target.value})}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expires_at">Expiração (opcional)</Label>
            <Input
              id="expires_at"
              type="datetime-local"
              value={newEntity.expires_at}
              onChange={(e) => setNewEntity({...newEntity, expires_at: e.target.value})}
            />
          </div>

          <Button onClick={addEntity} disabled={adding} className="w-full">
            {adding ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adicionando...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar à Whitelist
              </>
            )}
          </Button>
        </div>

        {/* Entities Table */}
        <div className="border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Razão</TableHead>
                <TableHead>Adicionado</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entities.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhuma entidade na whitelist
                  </TableCell>
                </TableRow>
              ) : (
                entities.map((entity) => (
                  <TableRow key={entity.id}>
                    <TableCell>
                      <Badge variant="outline">{entity.entity_type}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{entity.entity_value}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">{entity.reason}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(entity.added_at), { 
                        addSuffix: true,
                        locale: ptBR 
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={entity.is_active ? 'default' : 'secondary'}>
                        {entity.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {entity.is_active && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeEntity(entity.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
