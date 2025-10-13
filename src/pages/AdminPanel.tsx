import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Users, Truck, Package, FileText, Eye, Search, LayoutDashboard, Building2, HelpCircle, UserPlus, Folder, TrendingUp, DollarSign, CreditCard, Menu, Building, Wrench } from 'lucide-react';
import { AdminValidationPanel } from '@/components/AdminValidationPanel';
import { AdminReportsPanel } from '@/components/AdminReportsPanel';
import { AdminServiceProviderValidation } from '@/components/AdminServiceProviderValidation';

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  cpf_cnpj: string;
  role: 'PRODUTOR' | 'MOTORISTA' | 'ADMIN' | 'PRESTADOR_SERVICOS' | 'TRANSPORTADORA';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_at: string;
  document_validation_status?: string;
  cnh_validation_status?: string;
}

// Sidebar Menu Items
const sidebarItems = [
  { title: "Dashboard", icon: LayoutDashboard, id: "dashboard" },
  { title: "Administrador", icon: Users, id: "admin" },
  { title: "Franquias", icon: Building2, id: "franchises" },
  { title: "Empresa", icon: Building2, id: "company" },
  { title: "Help Desk", icon: HelpCircle, id: "help" },
  { title: "Cadastro", icon: UserPlus, id: "register" },
];

const approvalItems = [
  { title: "Motoristas", icon: Truck, id: "drivers" },
  { title: "Passageiros", icon: Users, id: "passengers" },
  { title: "Prestadores", icon: Wrench, id: "service-providers" },
];

const moduleItems = [
  { title: "Mobilidade urbana", icon: Truck, id: "urban-mobility" },
];

const financialItems = [
  { title: "Relatórios", icon: TrendingUp, id: "reports" },
  { title: "Financeiro", icon: DollarSign, id: "financial" },
  { title: "Contas Digitais", icon: CreditCard, id: "digital-accounts" },
];

function AdminSidebar({ activeItem, setActiveItem }: { activeItem: string; setActiveItem: (item: string) => void }) {
  const [openGroup, setOpenGroup] = useState("approvals");

  return (
    <Sidebar className="bg-slate-800 text-white border-r-0">
      <SidebarContent className="bg-slate-800">
        {/* Main Menu Items */}
        <SidebarGroup>
          <SidebarMenu>
            {sidebarItems.map((item) => (
              <SidebarMenuItem key={item.id}>
                <SidebarMenuButton 
                  className="text-gray-300 hover:text-white hover:bg-slate-700 transition-colors"
                  onClick={() => setActiveItem(item.id)}
                >
                  <item.icon className="mr-3 h-4 w-4" />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        {/* Aprovações Group */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-red-400 font-medium px-3 py-2">
            <div 
              className="flex items-center cursor-pointer w-full"
              onClick={() => setOpenGroup(openGroup === "approvals" ? "" : "approvals")}
            >
              <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
              Aprovações
            </div>
          </SidebarGroupLabel>
          {openGroup === "approvals" && (
            <SidebarGroupContent>
              <SidebarMenu>
                {approvalItems.map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton 
                      className={`text-gray-300 hover:text-white hover:bg-slate-700 transition-colors ml-4 ${
                        activeItem === item.id ? 'bg-slate-700 text-white' : ''
                      }`}
                      onClick={() => setActiveItem(item.id)}
                    >
                      <item.icon className="mr-3 h-4 w-4" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          )}
        </SidebarGroup>

        {/* Módulos Group */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-gray-400 font-medium px-3 py-2">
            Módulos
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {moduleItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton 
                    className="text-gray-300 hover:text-white hover:bg-slate-700 transition-colors"
                    onClick={() => setActiveItem(item.id)}
                  >
                    <item.icon className="mr-3 h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Financeiro Group */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-gray-400 font-medium px-3 py-2">
            Financeiro
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {financialItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton 
                    className="text-gray-300 hover:text-white hover:bg-slate-700 transition-colors"
                    onClick={() => setActiveItem(item.id)}
                  >
                    <item.icon className="mr-3 h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

const AdminPanel = () => {
  const [pendingUsers, setPendingUsers] = useState<Profile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeItem, setActiveItem] = useState("drivers");
  
  // Filters
  const [nameFilter, setNameFilter] = useState('');
  const [emailFilter, setEmailFilter] = useState('');
  const [cpfFilter, setCpfFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchPendingUsers();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [pendingUsers, nameFilter, emailFilter, cpfFilter, statusFilter]);

  const fetchPendingUsers = async () => {
    setLoading(true);
    try {
      console.log('AdminPanel: Fetching users...');
      const { data: users, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('AdminPanel fetch error:', error);
        throw error;
      }
      
      console.log('AdminPanel: Users fetched successfully:', users?.length || 0);
      setPendingUsers(users || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = pendingUsers;

    if (nameFilter) {
      filtered = filtered.filter(user => 
        user.full_name.toLowerCase().includes(nameFilter.toLowerCase())
      );
    }

    if (cpfFilter) {
      filtered = filtered.filter(user => 
        user.cpf_cnpj?.toLowerCase().includes(cpfFilter.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(user => user.status === statusFilter);
    }

    setFilteredUsers(filtered);
  };

  const handleUserApproval = async (userId: string, approve: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: approve ? 'APPROVED' : 'REJECTED' })
        .eq('id', userId);

      if (error) throw error;

      toast.success(`Usuário ${approve ? 'aprovado' : 'rejeitado'} com sucesso`);
      fetchPendingUsers();
    } catch (error) {
      console.error('Error updating user status:', error);
      toast.error('Erro ao atualizar status do usuário');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">AGUARDANDO FINALIZAR CADASTRO</Badge>;
      case 'APPROVED':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">APROVADO</Badge>;
      case 'REJECTED':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">REJEITADO</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
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
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gray-50">
        <AdminSidebar activeItem={activeItem} setActiveItem={setActiveItem} />
        
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="p-2 hover:bg-gray-100 rounded-md">
                <Menu className="h-5 w-5" />
              </SidebarTrigger>
              <h1 className="text-xl font-semibold text-gray-800">Administrador</h1>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 p-6">
            {activeItem === "drivers" && (
              <div className="space-y-6">
                {/* Title */}
                <div className="flex items-center gap-2 mb-6">
                  <h2 className="text-2xl font-semibold text-gray-800">Aprovações de Motoristas</h2>
                  <div className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                    {filteredUsers.filter(u => u.status === 'PENDING').length}
                  </div>
                </div>

                {/* Filters */}
                <Card className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600 mb-1 block">Nome</label>
                      <Input
                        placeholder="Digite para pesquisar"
                        value={nameFilter}
                        onChange={(e) => setNameFilter(e.target.value)}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600 mb-1 block">E-mail</label>
                      <Input
                        placeholder="Digite para pesquisar"
                        value={emailFilter}
                        onChange={(e) => setEmailFilter(e.target.value)}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600 mb-1 block">CPF</label>
                      <Input
                        placeholder="Digite para pesquisar"
                        value={cpfFilter}
                        onChange={(e) => setCpfFilter(e.target.value)}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600 mb-1 block">Status</label>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          <SelectItem value="PENDING">Pendente</SelectItem>
                          <SelectItem value="APPROVED">Aprovado</SelectItem>
                          <SelectItem value="REJECTED">Rejeitado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </Card>

                {/* Results Table */}
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader className="bg-gray-50">
                        <TableRow>
                          <TableHead className="font-medium text-gray-700">Nome</TableHead>
                          <TableHead className="font-medium text-gray-700">CPF / NIF / CNPJ</TableHead>
                          <TableHead className="font-medium text-gray-700">Telefone</TableHead>
                          <TableHead className="font-medium text-gray-700">Status</TableHead>
                          <TableHead className="font-medium text-gray-700">Data Cadastro</TableHead>
                          <TableHead className="font-medium text-gray-700">Ação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                              Nenhum usuário encontrado com os filtros aplicados
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredUsers.map((user) => (
                            <TableRow key={user.id} className="hover:bg-gray-50">
                              <TableCell className="font-medium text-blue-600">
                                {user.full_name}
                              </TableCell>
                              <TableCell className="text-gray-600">
                                {user.cpf_cnpj || '-'}
                              </TableCell>
                              <TableCell className="text-gray-600">
                                {user.phone || '-'}
                              </TableCell>
                              <TableCell>
                                {getStatusBadge(user.status)}
                              </TableCell>
                              <TableCell className="text-gray-600">
                                {new Date(user.created_at).toLocaleDateString('pt-BR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  {user.status === 'PENDING' && (
                                    <>
                                      <Button
                                        size="sm"
                                        onClick={() => handleUserApproval(user.id, true)}
                                        className="h-8 w-8 p-0 bg-green-600 hover:bg-green-700"
                                      >
                                        <CheckCircle className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => handleUserApproval(user.id, false)}
                                        className="h-8 w-8 p-0"
                                      >
                                        <XCircle className="h-4 w-4" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Pagination Info */}
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <div>
                    Items per page: 20
                  </div>
                  <div>
                    1 – 1 of 1
                  </div>
                </div>
              </div>
            )}

            {activeItem === "service-providers" && <AdminServiceProviderValidation />}
            {activeItem === "passengers" && <AdminValidationPanel />}
            {activeItem === "reports" && <AdminReportsPanel />}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AdminPanel;