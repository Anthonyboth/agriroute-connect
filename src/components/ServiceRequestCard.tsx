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
 
         {/* Location */}
         <div className="space-y-2 text-sm">
           <div className="flex items-start gap-2">
             <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
             <div className="flex-1 min-w-0">
               <p className="text-muted-foreground text-xs">Origem</p>
               <p className="font-medium line-clamp-2">{origin}</p>
             </div>
           </div>
           {destination && destination !== "Não informado" && (
             <div className="flex items-start gap-2">
               <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
               <div className="flex-1 min-w-0">
                 <p className="text-muted-foreground text-xs">Destino</p>
                 <p className="font-medium line-clamp-2">{destination}</p>
               </div>
             </div>
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
         <CardFooter className="pt-0 pb-4 flex gap-2">
           {canEdit && (
             <Button
               variant="outline"
               size="sm"
               onClick={onEdit}
               className="flex-1"
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
               className="flex-1 text-destructive hover:text-destructive"
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