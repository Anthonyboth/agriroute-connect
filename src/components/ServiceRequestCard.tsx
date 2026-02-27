 import React from 'react';
 import { Card, CardContent, CardFooter } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Badge } from '@/components/ui/badge';
 import { 
   Wrench, 
   MapPin, 
   Calendar, 
   Phone, 
   Mail, 
   User,
   Edit,
   X,
   AlertCircle
 } from 'lucide-react';
 import { format } from 'date-fns';
 import { ptBR } from 'date-fns/locale';
 import { toUF, formatCityDisplay } from '@/utils/city-deduplication';
 
 interface ServiceRequestCardProps {
   serviceRequest: any;
   onEdit?: () => void;
   onCancel?: () => void;
 }
 
 export const ServiceRequestCard: React.FC<ServiceRequestCardProps> = ({
   serviceRequest,
   onEdit,
   onCancel,
 }) => {
   const sr = serviceRequest;

   // Safe field extraction - SEMPRE retorna "Cidade — UF"
   const safeParseLocation = (value: any, fallback: string = "Não informado"): string => {
     if (!value) return fallback;
     if (typeof value === "string") {
       if (value.trim().startsWith("{") || value.trim().startsWith("[")) {
         try {
           const parsed = JSON.parse(value);
           if (parsed.address) return parsed.address;
           if (parsed.city && parsed.state) {
             const uf = toUF(parsed.state) || parsed.state;
             return formatCityDisplay(parsed.city, uf);
           }
           if (parsed.city) return parsed.city;
           return fallback;
         } catch {
           return value;
         }
       }
       return value;
     }
     if (typeof value === "object" && value !== null) {
       if (value.address) return value.address;
       if (value.city && value.state) {
         const uf = toUF(value.state) || value.state;
         return formatCityDisplay(value.city, uf);
       }
       if (value.city) return value.city;
     }
     return fallback;
   };
 
    const origin = safeParseLocation(sr.location_address || sr.origin);
    const destination = safeParseLocation(sr.destination_address || sr.destination);
    
    const serviceTypeLabels: Record<string, string> = {
      GUINCHO: "Guincho",
      MUDANCA_RESIDENCIAL: "Mudança Residencial",
      MUDANCA_COMERCIAL: "Mudança Comercial",
      SERVICO_AGRICOLA: "Serviço Agrícola",
      SERVICO_TECNICO: "Serviço Técnico",
      FRETE_URBANO: "Frete Urbano",
      FRETE_MOTO: "Frete Moto",
      TRANSPORTE_PET: "Transporte de Pet",
      ENTREGA_PACOTES: "Entrega de Pacotes",
      MECANICO: "Mecânico",
      BORRACHEIRO: "Borracheiro",
      ELETRICISTA: "Eletricista",
      SOCORRO_MECANICO: "Socorro Mecânico",
    };

    const serviceTypeLabel = serviceTypeLabels[sr.service_type] || sr.service_type;
    const cargoTitle = sr.problem_description || (serviceTypeLabel ? `Solicitação de ${serviceTypeLabel}` : sr.service_type) || "Serviço solicitado";
 
   const statusLabels: Record<string, { label: string; color: string }> = {
     OPEN: { label: "Aberto", color: "bg-blue-100 text-blue-800" },
     ABERTO: { label: "Aberto", color: "bg-blue-100 text-blue-800" },
     AGUARDANDO: { label: "Aguardando", color: "bg-yellow-100 text-yellow-800" },
     EM_ANDAMENTO: { label: "Em Andamento", color: "bg-green-100 text-green-800" },
     CONCLUIDO: { label: "Concluído", color: "bg-gray-100 text-gray-800" },
     CANCELADO: { label: "Cancelado", color: "bg-red-100 text-red-800" },
   };
 
   const statusInfo = statusLabels[sr.status] || { label: sr.status, color: "bg-gray-100 text-gray-800" };
 
   const urgencyLabels: Record<string, { label: string; color: string; icon: typeof AlertCircle }> = {
     LOW: { label: "Baixa", color: "text-green-600", icon: AlertCircle },
     MEDIUM: { label: "Média", color: "text-yellow-600", icon: AlertCircle },
     HIGH: { label: "Alta", color: "text-red-600", icon: AlertCircle },
   };
 
   const urgencyInfo = sr.urgency ? urgencyLabels[sr.urgency] : null;
 
   const canEdit = (sr.status === "OPEN" || sr.status === "ABERTO") && onEdit;
   const canCancel = (sr.status === "OPEN" || sr.status === "ABERTO") && onCancel;
 
   return (
     <Card className="hover:shadow-md transition-shadow">
       <CardContent className="pt-6 space-y-4">
         {/* Header */}
         <div className="flex items-start justify-between gap-4">
           <div className="flex items-start gap-3 flex-1">
             <div className="p-2 rounded-lg bg-primary/10">
               <Wrench className="h-5 w-5 text-primary" />
             </div>
             <div className="flex-1 min-w-0">
               <h3 className="font-semibold text-base line-clamp-2 mb-1">
                 {cargoTitle}
               </h3>
               <Badge variant="outline" className="text-xs">
                 {serviceTypeLabel}
               </Badge>
             </div>
           </div>
           <Badge className={statusInfo.color}>
             {statusInfo.label}
           </Badge>
         </div>
 
         {/* Urgency */}
         {urgencyInfo && (
           <div className="flex items-center gap-2">
             <urgencyInfo.icon className={`h-4 w-4 ${urgencyInfo.color}`} />
             <span className={`text-sm font-medium ${urgencyInfo.color}`}>
               Urgência: {urgencyInfo.label}
             </span>
           </div>
         )}
 
          {/* Location — endereço completo */}
          <div className="space-y-0">
            {/* 📍 ORIGEM */}
            <div className="p-2.5 rounded-t-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-2 mb-1">
                <div className="h-3 w-3 rounded-full border-2 border-primary/60 bg-card shrink-0" />
                <p className="text-[11px] font-bold text-primary uppercase tracking-wider">📍 Origem</p>
              </div>
              <p className="text-sm font-semibold text-foreground ml-5">{origin}</p>
              {(sr.origin_neighborhood || sr.origin_street || sr.origin_number || sr.origin_complement || sr.origin_zip_code) && (
                <div className="ml-5 mt-1 space-y-0.5 text-[11px] text-muted-foreground">
                  {sr.origin_neighborhood && (
                    <p><span className="font-medium text-foreground/70">Bairro/Local:</span> {sr.origin_neighborhood}</p>
                  )}
                  {(sr.origin_street || sr.origin_number) && (
                    <p>
                      <span className="font-medium text-foreground/70">Endereço:</span>{' '}
                      {[sr.origin_street, sr.origin_number && `nº ${sr.origin_number}`].filter(Boolean).join(', ')}
                    </p>
                  )}
                  {sr.origin_complement && (
                    <p><span className="font-medium text-foreground/70">Complemento:</span> {sr.origin_complement}</p>
                  )}
                  {sr.origin_zip_code && (
                    <p><span className="font-medium text-foreground/70">CEP:</span> {sr.origin_zip_code}</p>
                  )}
                </div>
              )}
            </div>

            {/* Divider */}
            {destination && destination !== "Não informado" && (
              <>
                <div className="flex justify-center -my-px">
                  <div className="w-0.5 h-3 bg-gradient-to-b from-primary/40 to-accent/40" />
                </div>

                {/* 🏁 DESTINO */}
                <div className="p-2.5 rounded-b-lg bg-accent/5 border border-accent/20">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="h-3 w-3 rounded-full bg-accent shrink-0" />
                    <p className="text-[11px] font-bold text-accent uppercase tracking-wider">🏁 Destino</p>
                  </div>
                  <p className="text-sm font-semibold text-foreground ml-5">{destination}</p>
                  {(sr.destination_neighborhood || sr.destination_street || sr.destination_number || sr.destination_complement || sr.destination_zip_code) && (
                    <div className="ml-5 mt-1 space-y-0.5 text-[11px] text-muted-foreground">
                      {sr.destination_neighborhood && (
                        <p><span className="font-medium text-foreground/70">Bairro/Local:</span> {sr.destination_neighborhood}</p>
                      )}
                      {(sr.destination_street || sr.destination_number) && (
                        <p>
                          <span className="font-medium text-foreground/70">Endereço:</span>{' '}
                          {[sr.destination_street, sr.destination_number && `nº ${sr.destination_number}`].filter(Boolean).join(', ')}
                        </p>
                      )}
                      {sr.destination_complement && (
                        <p><span className="font-medium text-foreground/70">Complemento:</span> {sr.destination_complement}</p>
                      )}
                      {sr.destination_zip_code && (
                        <p><span className="font-medium text-foreground/70">CEP:</span> {sr.destination_zip_code}</p>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
 
         {/* Date */}
         {sr.preferred_date && (
           <div className="flex items-center gap-2 text-sm">
             <Calendar className="h-4 w-4 text-muted-foreground" />
             <span>
               {format(new Date(sr.preferred_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
             </span>
           </div>
         )}
 
         {/* Contact Info */}
         {(sr.contact_name || sr.contact_phone || sr.contact_email) && (
           <div className="pt-3 border-t space-y-2 text-sm">
             {sr.contact_name && (
               <div className="flex items-center gap-2">
                 <User className="h-4 w-4 text-muted-foreground" />
                 <span className="truncate">{sr.contact_name}</span>
               </div>
             )}
             {sr.contact_phone && (
               <div className="flex items-center gap-2">
                 <Phone className="h-4 w-4 text-muted-foreground" />
                 <span>{sr.contact_phone}</span>
               </div>
             )}
             {sr.contact_email && (
               <div className="flex items-center gap-2">
                 <Mail className="h-4 w-4 text-muted-foreground" />
                 <span className="truncate">{sr.contact_email}</span>
               </div>
             )}
           </div>
         )}
       </CardContent>
 
       {/* Actions */}
       {(canEdit || canCancel) && (
      <CardFooter className="pt-2 pb-4 flex gap-3">
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={onEdit}
                className="flex-1 h-10 rounded-xl border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground hover:border-primary shadow-sm transition-all duration-200 font-medium"
              >
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </Button>
            )}
            {canCancel && (
              <Button
                variant="outline"
                size="sm"
                onClick={onCancel}
                className="flex-1 h-10 rounded-xl border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground hover:border-destructive shadow-sm transition-all duration-200 font-medium"
              >
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
            )}
         </CardFooter>
       )}
     </Card>
   );
 };