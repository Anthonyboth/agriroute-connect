import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, MapPin, Plus, Trash2, Edit } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { formatDateLong } from '@/lib/formatters';

interface Availability {
  id: string;
  available_date: string;
  city: string;
  state: string;
  notes?: string;
  available_until_date?: string;
}

interface ScheduledFreight {
  freight_id: string;
  producer_name: string;
  origin_address: string;
  destination_address: string;
  scheduled_date: string;
  pickup_date?: string;
  weight: number;
  price: number;
  cargo_type: string;
  flexible_dates: boolean;
}

export const DriverAvailabilityCalendar: React.FC = () => {
  const { profile } = useAuth();
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [scheduledFreights, setScheduledFreights] = useState<ScheduledFreight[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAvailability, setEditingAvailability] = useState<Availability | null>(null);

  // Form states
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [notes, setNotes] = useState('');
  const [availableUntil, setAvailableUntil] = useState<Date>();

  useEffect(() => {
    if (profile) {
      fetchAvailabilities();
    }
  }, [profile]);

  useEffect(() => {
    if (selectedDate) {
      fetchScheduledFreights(selectedDate);
    }
  }, [selectedDate]);

  const fetchAvailabilities = async () => {
    if (!profile) return;

    try {
      const { data, error } = await supabase
        .from('driver_availability')
        .select('*')
        .eq('driver_id', profile.id)
        .order('available_date', { ascending: true });

      if (error) throw error;
      setAvailabilities(data || []);
    } catch (error) {
      console.error('Erro ao buscar disponibilidades:', error);
    }
  };

  const fetchScheduledFreights = async (date: Date) => {
    try {
      const formattedDate = format(date, 'yyyy-MM-dd');
      const city = getCurrentDateAvailability(date)?.city;
      
      if (!city) return;

      const { data, error } = await supabase.rpc(
        'get_scheduled_freights_by_location_and_date',
        {
          p_city: city,
          p_date: formattedDate,
          p_days_range: 3
        }
      );

      if (error) throw error;
      setScheduledFreights(data || []);
    } catch (error) {
      console.error('Erro ao buscar fretes agendados:', error);
    }
  };

  const handleSaveAvailability = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !selectedDate) return;

    setLoading(true);
    try {
      const availabilityData = {
        driver_id: profile.id,
        available_date: format(selectedDate, 'yyyy-MM-dd'),
        city: city.trim(),
        state: state.trim(),
        notes: notes.trim() || null,
        available_until_date: availableUntil ? format(availableUntil, 'yyyy-MM-dd') : null
      };

      if (editingAvailability) {
        const { error } = await supabase
          .from('driver_availability')
          .update(availabilityData)
          .eq('id', editingAvailability.id);

        if (error) throw error;
        toast.success('Disponibilidade atualizada!');
      } else {
        const { error } = await supabase
          .from('driver_availability')
          .insert([availabilityData]);

        if (error) throw error;
        toast.success('Disponibilidade adicionada!');
      }

      resetForm();
      setModalOpen(false);
      fetchAvailabilities();
    } catch (error: any) {
      console.error('Erro ao salvar disponibilidade:', error);
      toast.error('Erro ao salvar disponibilidade. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAvailability = async (id: string) => {
    try {
      const { error } = await supabase
        .from('driver_availability')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Disponibilidade removida!');
      fetchAvailabilities();
    } catch (error: any) {
      console.error('Erro ao deletar disponibilidade:', error);
      toast.error('Erro ao deletar disponibilidade. Tente novamente.');
    }
  };

  const resetForm = () => {
    setCity('');
    setState('');
    setNotes('');
    setAvailableUntil(undefined);
    setEditingAvailability(null);
  };

  const openEditModal = (availability: Availability) => {
    setEditingAvailability(availability);
    setCity(availability.city);
    setState(availability.state);
    setNotes(availability.notes || '');
    setAvailableUntil(availability.available_until_date ? new Date(availability.available_until_date) : undefined);
    setSelectedDate(new Date(availability.available_date));
    setModalOpen(true);
  };

  const openAddModal = (date: Date) => {
    resetForm();
    setSelectedDate(date);
    setModalOpen(true);
  };

  const getCurrentDateAvailability = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return availabilities.find(av => av.available_date === dateStr);
  };

  const getDateStatus = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const availability = availabilities.find(av => av.available_date === dateStr);
    return availability ? 'available' : 'unavailable';
  };

  const minDate = new Date();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Calendário de Disponibilidade
          </CardTitle>
          <CardDescription>
            Informe em quais cidades você estará disponível e encontre fretes agendados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Calendário */}
            <div className="space-y-4">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                disabled={(date) => date < minDate}
                modifiers={{
                  available: (date) => getDateStatus(date) === 'available'
                }}
                modifiersStyles={{
                  available: { backgroundColor: 'hsl(var(--primary))', color: 'white' }
                }}
                className="rounded-lg border"
              />
              
              <div className="flex gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-primary"></div>
                  <span>Disponível</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded border"></div>
                  <span>Não informado</span>
                </div>
              </div>
            </div>

            {/* Detalhes do Dia Selecionado */}
            <div className="space-y-4">
              {selectedDate && (
                <>
                  <div className="p-4 bg-secondary/30 rounded-lg">
                    <h3 className="font-semibold mb-2">
                      {format(selectedDate, 'PPPP', { locale: ptBR })}
                    </h3>
                    
                    {getCurrentDateAvailability(selectedDate) ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Badge variant="default">Disponível</Badge>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEditModal(getCurrentDateAvailability(selectedDate)!)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteAvailability(getCurrentDateAvailability(selectedDate)!.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="text-sm">
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            <span>{getCurrentDateAvailability(selectedDate)!.city}, {getCurrentDateAvailability(selectedDate)!.state}</span>
                          </div>
                          {getCurrentDateAvailability(selectedDate)!.notes && (
                            <p className="text-muted-foreground mt-1">
                              {getCurrentDateAvailability(selectedDate)!.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center">
                        <p className="text-muted-foreground mb-3">Disponibilidade não informada</p>
                        <Button onClick={() => openAddModal(selectedDate)}>
                          <Plus className="mr-2 h-4 w-4" />
                          Adicionar Disponibilidade
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Fretes Disponíveis */}
                  {scheduledFreights.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-semibold">Fretes Disponíveis na Região</h4>
                      {scheduledFreights.map((freight) => (
                        <Card key={freight.freight_id} className="p-4">
                          <div className="space-y-2">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium">{freight.producer_name}</p>
                                <p className="text-sm text-muted-foreground">{freight.cargo_type} - {(freight.weight / 1000).toFixed(1)}t</p>
                              </div>
                              <Badge variant="secondary">R$ {(freight.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</Badge>
                            </div>
                            
                            <div className="text-sm space-y-1">
                              <div className="flex items-center gap-2">
                                <MapPin className="h-3 w-3" />
                                <span>{freight.origin_address} → {freight.destination_address}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <CalendarIcon className="h-3 w-3" />
                                <span>{formatDateLong(freight.scheduled_date || freight.pickup_date)}</span>
                                {freight.flexible_dates && <Badge variant="outline" className="text-xs">Datas flexíveis</Badge>}
                              </div>
                            </div>
                            
                            <Button size="sm" className="w-full mt-2">
                              Ver Detalhes e Propor
                            </Button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Disponibilidades Marcadas */}
      {availabilities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Minhas Disponibilidades</CardTitle>
            <CardDescription>
              Datas que você marcou como disponível
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {availabilities.map((availability) => (
                <div 
                  key={availability.id}
                  className="p-4 border rounded-lg space-y-2 hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium">
                      {format(new Date(availability.available_date), 'PPP', { locale: ptBR })}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEditModal(availability)}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteAvailability(availability.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span>{availability.city}, {availability.state}</span>
                  </div>
                  
                  {availability.notes && (
                    <p className="text-sm text-muted-foreground">
                      {availability.notes}
                    </p>
                  )}
                  
                  {availability.available_until_date && (
                    <div className="text-xs text-muted-foreground">
                      Até: {format(new Date(availability.available_until_date), 'PPP', { locale: ptBR })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal de Disponibilidade */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingAvailability ? 'Editar' : 'Adicionar'} Disponibilidade
            </DialogTitle>
            <DialogDescription>
              Informe em qual cidade você estará disponível em{' '}
              {selectedDate && format(selectedDate, 'PPP', { locale: ptBR })}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveAvailability} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cidade *</Label>
                <Input
                  placeholder="Ex: Sorriso"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Estado *</Label>
                <Input
                  placeholder="Ex: MT"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  maxLength={2}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                placeholder="Horários disponíveis, tipo de carga preferida, etc."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};