import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAdminApi } from '@/hooks/useAdminApi';
import { AppSpinner } from '@/components/ui/AppSpinner';
import { Menu, Info, Shield, Code } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Superadmin',
  reviewer: 'Revisor',
  support: 'Suporte',
  finance: 'Financeiro',
  ops: 'Operações',
};

const AdminUsersManager = () => {
  const { callApi } = useAdminApi();
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSqlDialog, setShowSqlDialog] = useState(false);

  const fetchAdmins = async () => {
    setLoading(true);
    const { data } = await callApi<any>('admin-users');
    if (data) setAdmins(data.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchAdmins(); }, []);

  const toggleActive = async (adminId: string, currentActive: boolean) => {
    const { error } = await callApi('admin-users', {
      method: 'PATCH',
      entityId: adminId,
      body: { action: 'update', id: adminId, is_active: !currentActive },
    });
    if (error) {
      toast.error(`Erro: ${error}`);
    } else {
      toast.success(currentActive ? 'Admin desativado' : 'Admin ativado');
      fetchAdmins();
    }
  };

  const changeRole = async (adminId: string, newRole: string) => {
    const { error } = await callApi('admin-users', {
      method: 'PATCH',
      entityId: adminId,
      body: { action: 'update', id: adminId, role: newRole },
    });
    if (error) {
      toast.error(`Erro: ${error}`);
    } else {
      toast.success('Role atualizado');
      fetchAdmins();
    }
  };

  const sqlInstructions = `-- Para adicionar um novo admin, execute no SQL Editor do Supabase:
-- (Substitua os valores abaixo pelos dados reais)

INSERT INTO public.admin_users (user_id, email, role, full_name, is_active)
VALUES (
  'UUID_DO_USUARIO_AUTH',  -- auth.users.id do usuário
  'email@exemplo.com',     -- email do admin
  'reviewer',              -- role: superadmin, reviewer, support, finance, ops
  'Nome Completo',
  true
);

-- Para encontrar o user_id de um email:
-- SELECT id FROM auth.users WHERE email = 'email@exemplo.com';`;

  return (
    <div className="flex-1">
      <header className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <SidebarTrigger className="p-2 hover:bg-gray-100 rounded-md">
          <Menu className="h-5 w-5" />
        </SidebarTrigger>
        <h1 className="text-xl font-semibold text-gray-800">Administradores</h1>
      </header>

      <div className="p-6 space-y-4">
        {/* Info Banner */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-800">Admins são gerenciados via banco de dados</p>
                <p className="text-xs text-blue-600 mt-1">
                  Por segurança, novos administradores só podem ser adicionados diretamente no banco de dados (SQL Editor do Supabase).
                </p>
                <Button size="sm" variant="outline" className="mt-2" onClick={() => setShowSqlDialog(true)}>
                  <Code className="h-4 w-4 mr-2" /> Ver instruções SQL
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Admin Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12"><AppSpinner /></div>
            ) : (
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Ativo</TableHead>
                    <TableHead>Desde</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {admins.map((admin: any) => (
                    <TableRow key={admin.id}>
                      <TableCell className="font-medium">{admin.full_name || '—'}</TableCell>
                      <TableCell>{admin.email}</TableCell>
                      <TableCell>
                        <Select value={admin.role} onValueChange={(v) => changeRole(admin.id, v)}>
                          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="superadmin">Superadmin</SelectItem>
                            <SelectItem value="reviewer">Revisor</SelectItem>
                            <SelectItem value="support">Suporte</SelectItem>
                            <SelectItem value="finance">Financeiro</SelectItem>
                            <SelectItem value="ops">Operações</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={admin.is_active}
                          onCheckedChange={() => toggleActive(admin.id, admin.is_active)}
                        />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(admin.created_at).toLocaleDateString('pt-BR')}
                      </TableCell>
                    </TableRow>
                  ))}
                  {admins.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Nenhum admin cadastrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* SQL Instructions Dialog */}
      <Dialog open={showSqlDialog} onOpenChange={setShowSqlDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Instruções para adicionar admin</DialogTitle>
            <DialogDescription>
              Execute o SQL abaixo no SQL Editor do Supabase Dashboard.
            </DialogDescription>
          </DialogHeader>
          <pre className="bg-slate-900 text-green-400 p-4 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap">
            {sqlInstructions}
          </pre>
          <DialogFooter>
            <Button onClick={() => {
              navigator.clipboard.writeText(sqlInstructions);
              toast.success('SQL copiado!');
            }}>
              Copiar SQL
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUsersManager;
