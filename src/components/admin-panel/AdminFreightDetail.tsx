import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AppSpinner } from '@/components/ui/AppSpinner';
import { useAdminApi } from '@/hooks/useAdminApi';
import {
  ArrowLeft, MapPin, Truck, User, DollarSign, Calendar, Package,
  Menu, Navigation, Clock, CheckCircle, Hash, Phone, Building2,
  Route, Weight, Gauge,
} from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  NEW: { label: 'Novo', className: 'bg-muted text-muted-foreground' },
  APPROVED: { label: 'Aprovado', className: 'bg-primary/15 text-primary' },
  OPEN: { label: 'Aberto', className: 'bg-primary/15 text-primary' },
  ACCEPTED: { label: 'Aceito', className: 'bg-accent/15 text-accent' },
  LOADING: { label: 'Carregando', className: 'bg-accent/15 text-accent' },
  LOADED: { label: 'Carregado', className: 'bg-accent/15 text-accent' },
  IN_TRANSIT: { label: 'Em Trânsito', className: 'bg-warning/15 text-warning' },
  DELIVERED: { label: 'Entregue', className: 'bg-success/15 text-success' },
  DELIVERED_PENDING_CONFIRMATION: { label: 'Entregue (Pend.)', className: 'bg-success/15 text-success' },
  COMPLETED: { label: 'Concluído', className: 'bg-success/20 text-success' },
  CANCELLED: { label: 'Cancelado', className: 'bg-destructive/15 text-destructive' },
  EXPIRED: { label: 'Expirado', className: 'bg-muted text-muted-foreground' },
};

const AdminFreightDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { callApi } = useAdminApi();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: result } = await callApi<any>(`freights/${id}`);
      if (result) setData(result);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="flex-1 flex items-center justify-center"><AppSpinner /></div>;
  if (!data?.freight) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <Truck className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-muted-foreground">Frete não encontrado</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/admin-v2/fretes')}>Voltar</Button>
      </div>
    </div>
  );

  const f = data.freight;
  const statusInfo = STATUS_BADGES[f.status] || { label: f.status, className: '' };
  const fmtDate = (d: string | null) => d ? format(new Date(d), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '—';
  const fmtCurrency = (v: number | null) => v ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—';

  return (
    <div className="flex-1 bg-muted/30">
      <header className="bg-card border-b border-border px-6 py-4 flex items-center gap-4">
        <SidebarTrigger className="p-2 hover:bg-muted rounded-md"><Menu className="h-5 w-5" /></SidebarTrigger>
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin-v2/fretes')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-foreground">
              Frete {f.reference_number ? `#${f.reference_number}` : f.id?.slice(0, 8)}
            </h1>
            <Badge className={statusInfo.className}>{statusInfo.label}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">Criado em {fmtDate(f.created_at)}</p>
        </div>
      </header>

      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        {/* Route Card */}
        <Card className="shadow-sm border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Route className="h-4 w-4 text-primary" /> Rota</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-success"><MapPin className="h-4 w-4" /><span className="font-medium">Origem</span></div>
                <p className="text-sm">{f.origin_city}/{f.origin_state}</p>
                {f.origin_address && <p className="text-xs text-muted-foreground">{f.origin_address}</p>}
                {f.origin_neighborhood && <p className="text-xs text-muted-foreground">{f.origin_neighborhood}, {f.origin_street} {f.origin_number}</p>}
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-destructive"><MapPin className="h-4 w-4" /><span className="font-medium">Destino</span></div>
                <p className="text-sm">{f.destination_city}/{f.destination_state}</p>
                {f.destination_address && <p className="text-xs text-muted-foreground">{f.destination_address}</p>}
                {f.destination_neighborhood && <p className="text-xs text-muted-foreground">{f.destination_neighborhood}, {f.destination_street} {f.destination_number}</p>}
              </div>
            </div>
            {f.distance_km && (
              <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><Navigation className="h-3 w-3" /> {Number(f.distance_km).toFixed(0)} km</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Cargo & Vehicle */}
          <Card className="shadow-sm border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4 text-accent" /> Carga & Veículo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <DetailRow icon={<Package className="h-4 w-4" />} label="Tipo de Carga" value={f.cargo_type || '—'} />
              <DetailRow icon={<Weight className="h-4 w-4" />} label="Peso" value={f.weight ? `${Number(f.weight).toLocaleString('pt-BR')} kg` : '—'} />
              <DetailRow icon={<Truck className="h-4 w-4" />} label="Veículo Requerido" value={f.vehicle_type_required || '—'} />
              <DetailRow icon={<Gauge className="h-4 w-4" />} label="Eixos" value={f.vehicle_axles_required ? `${f.vehicle_axles_required} eixos` : '—'} />
              <DetailRow icon={<Hash className="h-4 w-4" />} label="Caminhões" value={f.required_trucks ? `${f.accepted_trucks || 0}/${f.required_trucks}` : '1'} />
              {f.description && <div className="pt-2 border-t border-border"><p className="text-xs text-muted-foreground">{f.description}</p></div>}
            </CardContent>
          </Card>

          {/* Financial */}
          <Card className="shadow-sm border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><DollarSign className="h-4 w-4 text-success" /> Financeiro</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <DetailRow icon={<DollarSign className="h-4 w-4" />} label="Valor" value={fmtCurrency(f.price)} highlight />
              <DetailRow icon={<DollarSign className="h-4 w-4" />} label="Preço/km" value={f.price_per_km ? fmtCurrency(f.price_per_km) : '—'} />
              <DetailRow icon={<DollarSign className="h-4 w-4" />} label="Mínimo ANTT" value={fmtCurrency(f.minimum_antt_price)} />
              <DetailRow icon={<DollarSign className="h-4 w-4" />} label="Pedágio" value={fmtCurrency(f.toll_cost)} />
              <DetailRow icon={<DollarSign className="h-4 w-4" />} label="Taxas Extra" value={fmtCurrency(f.extra_fees)} />
              {f.extra_fees_description && <p className="text-xs text-muted-foreground">{f.extra_fees_description}</p>}
              <Separator />
              <DetailRow icon={<DollarSign className="h-4 w-4" />} label="Comissão" value={f.commission_rate ? `${f.commission_rate}% (${fmtCurrency(f.commission_amount)})` : '—'} />
              <DetailRow icon={<DollarSign className="h-4 w-4" />} label="Pagamento" value={f.payment_method || '—'} />
            </CardContent>
          </Card>
        </div>

        {/* Dates */}
        <Card className="shadow-sm border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Calendar className="h-4 w-4 text-warning" /> Datas & Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <DateItem label="Criado" value={fmtDate(f.created_at)} />
              <DateItem label="Coleta" value={fmtDate(f.pickup_date)} />
              <DateItem label="Entrega" value={fmtDate(f.delivery_date)} />
              <DateItem label="Atualizado" value={fmtDate(f.updated_at)} />
            </div>
            {f.cancelled_at && (
              <div className="mt-3 p-3 bg-destructive/10 rounded-lg">
                <p className="text-sm text-destructive font-medium">Cancelado em {fmtDate(f.cancelled_at)}</p>
                {f.cancellation_reason && <p className="text-xs text-destructive/80 mt-1">{f.cancellation_reason}</p>}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Participants */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {data.producer && (
            <Card className="shadow-sm border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4 text-primary" /> Produtor</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="font-medium">{data.producer.full_name || '—'}</p>
                {data.producer.phone && <p className="text-sm text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{data.producer.phone}</p>}
                {data.producer.base_city_name && <p className="text-sm text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{data.producer.base_city_name}/{data.producer.base_state}</p>}
                <Button size="sm" variant="outline" className="mt-2" onClick={() => navigate(`/admin-v2/cadastros/${data.producer.id}`)}>
                  Ver Perfil
                </Button>
              </CardContent>
            </Card>
          )}
          {data.driver && (
            <Card className="shadow-sm border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><Truck className="h-4 w-4 text-accent" /> Motorista</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="font-medium">{data.driver.full_name || '—'}</p>
                {data.driver.phone && <p className="text-sm text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{data.driver.phone}</p>}
                {data.driver.base_city_name && <p className="text-sm text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{data.driver.base_city_name}/{data.driver.base_state}</p>}
                <Button size="sm" variant="outline" className="mt-2" onClick={() => navigate(`/admin-v2/cadastros/${data.driver.id}`)}>
                  Ver Perfil
                </Button>
              </CardContent>
            </Card>
          )}
          {!data.producer && !data.driver && f.is_guest_freight && (
            <Card className="shadow-sm border-border/60 md:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4 text-warning" /> Frete de Visitante</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {f.guest_contact_name && <DetailRow icon={<User className="h-4 w-4" />} label="Nome" value={f.guest_contact_name} />}
                {f.guest_contact_phone && <DetailRow icon={<Phone className="h-4 w-4" />} label="Telefone" value={f.guest_contact_phone} />}
                {f.guest_contact_email && <DetailRow icon={<Building2 className="h-4 w-4" />} label="Email" value={f.guest_contact_email} />}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Assignments */}
        {data.assignments && data.assignments.length > 0 && (
          <Card className="shadow-sm border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Truck className="h-4 w-4 text-accent" /> Atribuições ({data.assignments.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.assignments.map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium">{a.driver?.full_name || 'Motorista'}</p>
                      {a.vehicle?.license_plate && <p className="text-xs text-muted-foreground">Placa: {a.vehicle.license_plate} • {a.vehicle.vehicle_type}</p>}
                      <p className="text-xs text-muted-foreground">Valor acordado: {fmtCurrency(a.agreed_price)}</p>
                    </div>
                    <Badge className="text-xs">{a.status}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Trip Progress */}
        {data.trip_progress && data.trip_progress.length > 0 && (
          <Card className="shadow-sm border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Navigation className="h-4 w-4 text-warning" /> Progresso da Viagem</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.trip_progress.slice(0, 10).map((tp: any, i: number) => (
                  <div key={tp.id || i} className="flex items-center gap-3 text-sm">
                    <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs text-muted-foreground w-32">{fmtDate(tp.created_at)}</span>
                    <Badge variant="outline" className="text-xs">{tp.status || tp.event_type || '—'}</Badge>
                    {tp.notes && <span className="text-xs text-muted-foreground truncate">{tp.notes}</span>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

function DetailRow({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">{icon}<span>{label}</span></div>
      <span className={`text-sm ${highlight ? 'font-bold text-foreground' : 'text-foreground/80'}`}>{value}</span>
    </div>
  );
}

function DateItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center p-3 bg-muted/50 rounded-lg">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium text-foreground mt-1">{value}</p>
    </div>
  );
}

export default AdminFreightDetail;
