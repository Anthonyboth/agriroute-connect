import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Phone, Mail, FileText, Calendar, MapPin } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface DriverInfoTabProps {
  driverProfileId: string;
}

export const DriverInfoTab = ({ driverProfileId }: DriverInfoTabProps) => {
  const { data: driver, isLoading } = useQuery({
    queryKey: ['driver-info', driverProfileId],
    queryFn: async () => {
      console.log('🔍 Buscando motorista:', driverProfileId);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', driverProfileId)
        .single();

      if (error) {
        console.error('❌ Erro ao buscar motorista:', error);
        throw error;
      }
      
      console.log('✅ Motorista encontrado:', data);
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!driver) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold mb-2">Motorista não encontrado</h3>
            <p className="text-sm text-muted-foreground">
              Este motorista pode ter sido removido ou os dados estão indisponíveis.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              ID buscado: {driverProfileId}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Informações Pessoais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={driver.profile_photo_url || driver.selfie_url} />
              <AvatarFallback className="text-2xl bg-primary/10">
                {driver.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="text-2xl font-semibold">{driver.full_name}</h3>
              <Badge variant={driver.status === 'APPROVED' ? 'default' : 'secondary'} className="mt-2">
                {driver.status}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Telefone</p>
                <p className="font-medium">{driver.phone || 'Não informado'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{driver.email || 'Não informado'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Documento</p>
                <p className="font-medium">{driver.id || 'Não informado'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Cadastrado em</p>
                <p className="font-medium">
                  {driver.created_at 
                    ? new Date(driver.created_at).toLocaleDateString('pt-BR')
                    : 'Não informado'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Cidade</p>
                <p className="font-medium">{driver.address_city && driver.address_state ? `${driver.address_city}, ${driver.address_state}` : 'Não informado'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Tipo</p>
                <p className="font-medium">{driver.role || 'Não informado'}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {driver.address_complement && (
        <Card>
          <CardHeader>
            <CardTitle>Observações</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{driver.address_complement}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
