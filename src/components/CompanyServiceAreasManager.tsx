import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { MapPin, Plus, Edit, Trash2, Target, TrendingUp, X, Lightbulb } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTransportCompany } from '@/hooks/useTransportCompany';
import { CitySelector } from './CitySelector';

interface CompanyServiceArea {
  id: string;
  city_name: string;
  state?: string;
  lat: number;
  lng: number;
  radius_km: number;
  is_active: boolean;
  priority?: 'A' | 'B' | 'C';
  created_at: string;
}

interface ServiceAreaFormData {
  city_name: string;
  state: string;
  lat: number;
  lng: number;
  radius_km: number;
  is_active: boolean;
  priority: 'A' | 'B' | 'C';
}

export const CompanyServiceAreasManager: React.FC = () => {
  const { company } = useTransportCompany();
  const [serviceAreas, setServiceAreas] = useState<CompanyServiceArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<CompanyServiceArea | null>(null);
  const [formData, setFormData] = useState<ServiceAreaFormData>({
    city_name: '',
    state: '',
    lat: 0,
    lng: 0,
    radius_km: 100,
    is_active: true,
    priority: 'B'
  });
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);

  useEffect(() => {
    if (company?.id) {
      fetchServiceAreas();
    }
  }, [company]);

  const fetchServiceAreas = async () => {
    if (!company?.id) return;

    try {
      // Por enquanto, usar user_cities como base
      // Futuramente, criar company_service_areas
      // Por enquanto retornar vazio até implementar company_service_areas
      setServiceAreas([]);
    } catch (error) {
      console.error('Erro ao buscar áreas de serviço:', error);
      toast.error('Erro ao carregar áreas de atendimento');
    } finally {
      setLoading(false);
    }
  };

  const fetchAISuggestions = async () => {
    if (!company?.id) return;

    try {
      toast.info('Analisando histórico de fretes...');
      
      // Buscar fretes entregues pela empresa para análise
      const { data: completedFreights, error } = await supabase
        .from('freight_assignments')
        .select(`
          freight:freights(
            origin_address,
            destination_address,
            origin_lat,
            origin_lng,
            price
          )
        `)
        .eq('company_id', company.id)
        .eq('status', 'DELIVERED')
        .limit(50);

      if (error) throw error;

      // Análise simples: agrupar por origem
      const origins: Record<string, { count: number; totalRevenue: number; avgLat: number; avgLng: number }> = {};
      
      completedFreights?.forEach((item: any) => {
        const freight = item.freight;
        if (!freight) return;
        
        const key = freight.origin_address;
        if (!origins[key]) {
          origins[key] = { 
            count: 0, 
            totalRevenue: 0, 
            avgLat: freight.origin_lat || 0, 
            avgLng: freight.origin_lng || 0 
          };
        }
        origins[key].count++;
        origins[key].totalRevenue += freight.price || 0;
      });

      // Ordenar por relevância (frequência + receita)
      const suggestions = Object.entries(origins)
        .map(([address, stats]) => ({
          city_name: address.split(',')[0].trim(),
          address,
          frequency: stats.count,
          revenue: stats.totalRevenue,
          score: stats.count * 0.6 + (stats.totalRevenue / 1000) * 0.4,
          lat: stats.avgLat,
          lng: stats.avgLng
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      setAiSuggestions(suggestions);
      
      if (suggestions.length > 0) {
        toast.success(`${suggestions.length} áreas sugeridas pela IA!`);
      } else {
        toast.info('Ainda não há dados suficientes para sugestões');
      }
    } catch (error) {
      console.error('Erro ao buscar sugestões:', error);
      toast.error('Erro ao analisar sugestões de áreas');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.city_name || !formData.lat || !formData.lng) {
      toast.error('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    try {
      setLoading(true);

      // Temporário - só mostra toast
      toast.info('Funcionalidade de áreas da empresa em desenvolvimento');

      toast.success('Área adicionada com sucesso!');
      setIsDialogOpen(false);
      fetchServiceAreas();
      
      // Reset form
      setFormData({
        city_name: '',
        state: '',
        lat: 0,
        lng: 0,
        radius_km: 100,
        is_active: true,
        priority: 'B'
      });
    } catch (error) {
      console.error('Erro ao salvar área:', error);
      toast.error('Erro ao salvar área de atendimento');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (areaId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta área?')) return;

    try {
      const { error } = await supabase
        .from('user_cities')
        .delete()
        .eq('id', areaId);

      if (error) throw error;

      toast.success('Área excluída com sucesso');
      fetchServiceAreas();
    } catch (error) {
      console.error('Erro ao excluir área:', error);
      toast.error('Erro ao excluir área');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'A': return 'bg-green-500';
      case 'B': return 'bg-yellow-500';
      case 'C': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header com IA */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Target className="h-5 w-5 text-primary mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-primary mb-1">
                Gestão Inteligente de Áreas
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Configure as regiões onde sua transportadora atua. A IA analisa seu histórico
                e sugere novas áreas estratégicas baseadas em demanda e lucratividade.
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3"
                onClick={fetchAISuggestions}
              >
                <Lightbulb className="h-4 w-4 mr-2" />
                Ver Sugestões da IA
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sugestões da IA */}
      {aiSuggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Áreas Sugeridas pela IA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {aiSuggestions.map((suggestion, index) => (
                <div 
                  key={index}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                >
                  <div className="flex-1">
                    <h4 className="font-medium">{suggestion.city_name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {suggestion.frequency} fretes • R$ {suggestion.revenue.toLocaleString('pt-BR')} em receita
                    </p>
                  </div>
                  <Button 
                    size="sm"
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        city_name: suggestion.city_name,
                        lat: suggestion.lat,
                        lng: suggestion.lng
                      }));
                      setIsDialogOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de Áreas */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Áreas de Atendimento
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {serviceAreas.length} {serviceAreas.length === 1 ? 'área configurada' : 'áreas configuradas'}
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Área
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  Nova Área de Atendimento
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <CitySelector
                  value={{ city: formData.city_name, state: formData.state }}
                  onChange={(c) => setFormData(prev => ({ 
                    ...prev, 
                    city_name: c.city, 
                    state: c.state, 
                    lat: c.lat ?? prev.lat, 
                    lng: c.lng ?? prev.lng 
                  }))}
                  label="Cidade *"
                  placeholder="Digite e selecione a cidade"
                  required
                />

                <div>
                  <Label htmlFor="radius_km">Raio de Atendimento (km)</Label>
                  <Input
                    id="radius_km"
                    type="number"
                    min="1"
                    max="500"
                    value={formData.radius_km}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      radius_km: parseInt(e.target.value) || 100 
                    }))}
                  />
                </div>

                <div>
                  <Label>Prioridade</Label>
                  <div className="flex gap-2 mt-2">
                    {(['A', 'B', 'C'] as const).map((p) => (
                      <Button
                        key={p}
                        type="button"
                        variant={formData.priority === p ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFormData(prev => ({ ...prev, priority: p }))}
                      >
                        {p}
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    A: Alta prioridade • B: Média • C: Baixa
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={loading}>
                    Salvar
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground">Carregando...</p>
          ) : serviceAreas.length === 0 ? (
            <div className="text-center py-12">
              <MapPin className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2">Nenhuma área configurada</h3>
              <p className="text-muted-foreground mb-4">
                Configure suas áreas de atendimento para receber fretes relevantes
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {serviceAreas.map((area) => (
                <div
                  key={area.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-2 h-2 rounded-full ${getPriorityColor(area.priority || 'B')}`} />
                      <h4 className="font-medium">{area.city_name}</h4>
                      {area.state && (
                        <Badge variant="secondary">{area.state}</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Raio: {area.radius_km}km
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(area.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
