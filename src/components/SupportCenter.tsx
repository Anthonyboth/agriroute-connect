import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MessageSquare, Plus, Send, AlertTriangle, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SupportTicket {
  id: string;
  subject: string;
  description: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  category: 'GENERAL' | 'TECHNICAL' | 'BILLING' | 'REPORT';
  created_at: string;
  updated_at: string;
}

interface SupportMessage {
  id: string;
  message: string;
  is_admin: boolean;
  profiles?: { full_name: string };
  created_at: string;
}

export const SupportCenter = () => {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const [newTicket, setNewTicket] = useState({
    subject: '',
    description: '',
    priority: 'MEDIUM' as const,
    category: 'GENERAL' as const
  });

  const statusColors = {
    OPEN: 'bg-blue-500',
    IN_PROGRESS: 'bg-yellow-500',
    RESOLVED: 'bg-green-500',
    CLOSED: 'bg-gray-500'
  };

  const priorityColors = {
    LOW: 'bg-gray-500',
    MEDIUM: 'bg-blue-500',
    HIGH: 'bg-orange-500',
    URGENT: 'bg-red-500'
  };

  const fetchTickets = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!profile) return;

      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTickets((data || []) as SupportTicket[]);
    } catch (error) {
      console.error('Error fetching tickets:', error);
    }
  };

  const fetchMessages = async (ticketId: string) => {
    try {
      const { data, error } = await supabase
        .from('support_messages')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages((data || []) as SupportMessage[]);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const createTicket = async () => {
    if (!newTicket.subject.trim() || !newTicket.description.trim()) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!profile) throw new Error('Perfil não encontrado');

      const { error } = await supabase
        .from('support_tickets')
        .insert([{
          user_id: profile.id,
          subject: newTicket.subject,
          description: newTicket.description,
          priority: newTicket.priority,
          category: newTicket.category
        }]);

      if (error) throw error;

      setNewTicket({
        subject: '',
        description: '',
        priority: 'MEDIUM',
        category: 'GENERAL'
      });
      setIsCreateModalOpen(false);
      fetchTickets();
      
      toast({
        title: "Sucesso",
        description: "Ticket criado com sucesso",
      });
    } catch (error) {
      console.error('Error creating ticket:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar ticket",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedTicket) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!profile) throw new Error('Perfil não encontrado');

      const { error } = await supabase
        .from('support_messages')
        .insert([{
          ticket_id: selectedTicket.id,
          user_id: profile.id,
          message: newMessage,
          is_admin: false
        }]);

      if (error) throw error;

      setNewMessage('');
      fetchMessages(selectedTicket.id);
      
      toast({
        title: "Sucesso",
        description: "Mensagem enviada com sucesso",
      });
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Erro",
        description: "Erro ao enviar mensagem",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  useEffect(() => {
    if (selectedTicket) {
      fetchMessages(selectedTicket.id);
    }
  }, [selectedTicket]);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Central de Suporte</h1>
        </div>
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Ticket
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Criar Novo Ticket</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Assunto *</label>
                <Input
                  value={newTicket.subject}
                  onChange={(e) => setNewTicket(prev => ({ ...prev, subject: e.target.value }))}
                  placeholder="Descreva brevemente o problema"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Categoria</label>
                  <Select 
                    value={newTicket.category} 
                    onValueChange={(value) => setNewTicket(prev => ({ ...prev, category: value as any }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GENERAL">Geral</SelectItem>
                      <SelectItem value="TECHNICAL">Técnico</SelectItem>
                      <SelectItem value="BILLING">Financeiro</SelectItem>
                      <SelectItem value="REPORT">Denúncia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Prioridade</label>
                  <Select 
                    value={newTicket.priority} 
                    onValueChange={(value) => setNewTicket(prev => ({ ...prev, priority: value as any }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Baixa</SelectItem>
                      <SelectItem value="MEDIUM">Média</SelectItem>
                      <SelectItem value="HIGH">Alta</SelectItem>
                      <SelectItem value="URGENT">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Descrição *</label>
                <Textarea
                  value={newTicket.description}
                  onChange={(e) => setNewTicket(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descreva detalhadamente o problema ou solicitação"
                  rows={4}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={createTicket} disabled={loading}>
                  {loading ? 'Criando...' : 'Criar Ticket'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de Tickets */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Meus Tickets
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-96 overflow-y-auto">
                {tickets.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    Nenhum ticket encontrado
                  </div>
                ) : (
                  tickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      className={`p-4 border-b cursor-pointer hover:bg-muted/50 transition-colors ${
                        selectedTicket?.id === ticket.id ? 'bg-muted' : ''
                      }`}
                      onClick={() => setSelectedTicket(ticket)}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium text-sm line-clamp-1">
                            {ticket.subject}
                          </h3>
                          <Badge 
                            className={`${statusColors[ticket.status]} text-white text-xs`}
                          >
                            {ticket.status === 'OPEN' ? 'Aberto' : 
                             ticket.status === 'IN_PROGRESS' ? 'Em Andamento' :
                             ticket.status === 'RESOLVED' ? 'Resolvido' : 'Fechado'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant="outline" 
                            className={`${priorityColors[ticket.priority]} text-white text-xs`}
                          >
                            {ticket.priority === 'LOW' ? 'Baixa' :
                             ticket.priority === 'MEDIUM' ? 'Média' :
                             ticket.priority === 'HIGH' ? 'Alta' : 'Urgente'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(ticket.created_at), {
                              addSuffix: true,
                              locale: ptBR
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Chat do Ticket */}
        <div className="lg:col-span-2">
          {selectedTicket ? (
            <Card className="h-[600px] flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg line-clamp-1">
                    {selectedTicket.subject}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Badge className={`${statusColors[selectedTicket.status]} text-white`}>
                      {selectedTicket.status === 'OPEN' ? 'Aberto' : 
                       selectedTicket.status === 'IN_PROGRESS' ? 'Em Andamento' :
                       selectedTicket.status === 'RESOLVED' ? 'Resolvido' : 'Fechado'}
                    </Badge>
                    <Badge className={`${priorityColors[selectedTicket.priority]} text-white`}>
                      {selectedTicket.priority === 'LOW' ? 'Baixa' :
                       selectedTicket.priority === 'MEDIUM' ? 'Média' :
                       selectedTicket.priority === 'HIGH' ? 'Alta' : 'Urgente'}
                    </Badge>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {selectedTicket.description}
                </p>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col p-0">
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.is_admin ? 'justify-start' : 'justify-end'}`}
                    >
                      <div
                        className={`max-w-[70%] p-3 rounded-lg ${
                          message.is_admin
                            ? 'bg-muted text-foreground'
                            : 'bg-primary text-primary-foreground'
                        }`}
                      >
                        <p className="text-sm">{message.message}</p>
                        <p className="text-xs opacity-70 mt-1">
                          {formatDistanceToNow(new Date(message.created_at), {
                            addSuffix: true,
                            locale: ptBR
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                {selectedTicket.status !== 'CLOSED' && (
                  <div className="p-4 border-t">
                    <div className="flex gap-2">
                      <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Digite sua mensagem..."
                        onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                      />
                      <Button onClick={sendMessage} disabled={!newMessage.trim()}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="h-[600px] flex items-center justify-center">
              <div className="text-center space-y-2">
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground" />
                <p className="text-muted-foreground">
                  Selecione um ticket para ver as conversas
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};