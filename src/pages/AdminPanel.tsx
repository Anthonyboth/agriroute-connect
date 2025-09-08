import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Users, Truck, Package, FileText } from 'lucide-react';
import Header from '@/components/Header';

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  document: string;
  role: 'PRODUTOR' | 'MOTORISTA' | 'ADMIN';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_at: string;
}

interface Freight {
  id: string;
  producer_id: string;
  cargo_type: string;
  weight: number;
  origin_address: string;
  destination_address: string;
  price: number;
  status: string;
  created_at: string;
  profiles: {
    full_name: string;
  };
}

const AdminPanel = () => {
  const [pendingUsers, setPendingUsers] = useState<Profile[]>([]);
  const [allFreights, setAllFreights] = useState<Freight[]>([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    pendingApprovals: 0,
    totalFreights: 0,
    activeFreights: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch pending users
      const { data: pending } = await supabase
        .from('profiles')
        .select('*')
        .eq('status', 'PENDING')
        .order('created_at', { ascending: false });

      // Fetch all freights with producer info
      const { data: freights } = await supabase
        .from('freights')
        .select(`
          *,
          profiles!producer_id(full_name)
        `)
        .order('created_at', { ascending: false });

      // Fetch stats
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      const { count: totalFreights } = await supabase
        .from('freights')
        .select('*', { count: 'exact', head: true });

      const { count: activeFreights } = await supabase
        .from('freights')
        .select('*', { count: 'exact', head: true })
        .in('status', ['OPEN', 'IN_NEGOTIATION', 'ACCEPTED', 'IN_TRANSIT']);

      setPendingUsers(pending || []);
      setAllFreights(freights || []);
      setStats({
        totalUsers: totalUsers || 0,
        pendingApprovals: pending?.length || 0,
        totalFreights: totalFreights || 0,
        activeFreights: activeFreights || 0
      });
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleUserApproval = async (userId: string, approve: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: approve ? 'APPROVED' : 'REJECTED' })
        .eq('id', userId);

      if (error) throw error;

      toast.success(`Usuário ${approve ? 'aprovado' : 'rejeitado'} com sucesso`);
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Error updating user status:', error);
      toast.error('Erro ao atualizar status do usuário');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header 
        user={{ name: 'Administrador', role: 'ADMIN' as any }}
        onLogout={handleLogout}
        onMenuClick={() => {}}
      />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Painel Administrativo</h1>
          <p className="text-muted-foreground">Gerencie usuários e fretes da plataforma</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendentes de Aprovação</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingApprovals}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Fretes</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalFreights}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Fretes Ativos</CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeFreights}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="users" className="space-y-4">
          <TabsList>
            <TabsTrigger value="users">Usuários Pendentes</TabsTrigger>
            <TabsTrigger value="freights">Todos os Fretes</TabsTrigger>
          </TabsList>
          
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>Usuários Aguardando Aprovação</CardTitle>
                <CardDescription>
                  Aprove ou rejeite novos cadastros de produtores e motoristas
                </CardDescription>
              </CardHeader>
              <CardContent>
                {pendingUsers.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum usuário pendente de aprovação
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Documento</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.full_name}</TableCell>
                          <TableCell>{user.user_id}</TableCell>
                          <TableCell>
                            <Badge variant={user.role === 'PRODUTOR' ? 'default' : 'secondary'}>
                              {user.role}
                            </Badge>
                          </TableCell>
                          <TableCell>{user.phone || '-'}</TableCell>
                          <TableCell>{user.document || '-'}</TableCell>
                          <TableCell>
                            {new Date(user.created_at).toLocaleDateString('pt-BR')}
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                onClick={() => handleUserApproval(user.id, true)}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleUserApproval(user.id, false)}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="freights">
            <Card>
              <CardHeader>
                <CardTitle>Todos os Fretes</CardTitle>
                <CardDescription>
                  Visualize e gerencie todos os fretes da plataforma
                </CardDescription>
              </CardHeader>
              <CardContent>
                {allFreights.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum frete cadastrado
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produtor</TableHead>
                        <TableHead>Carga</TableHead>
                        <TableHead>Peso</TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead>Destino</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allFreights.map((freight) => (
                        <TableRow key={freight.id}>
                          <TableCell className="font-medium">
                            {freight.profiles?.full_name}
                          </TableCell>
                          <TableCell>{freight.cargo_type}</TableCell>
                          <TableCell>{freight.weight} kg</TableCell>
                          <TableCell>{freight.origin_address}</TableCell>
                          <TableCell>{freight.destination_address}</TableCell>
                          <TableCell>
                            R$ {freight.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{freight.status}</Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(freight.created_at).toLocaleDateString('pt-BR')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminPanel;