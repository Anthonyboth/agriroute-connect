import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useTransportCompany } from '@/hooks/useTransportCompany';
import { useDriverValidation } from '@/hooks/useDriverValidation';
import { CompanyInviteModal } from './CompanyInviteModal';
import { DriverDetailsModal } from './driver-details/DriverDetailsModal';
import { Users, UserPlus, Trash2, Star, Truck, Phone, Mail, Search, Filter, Eye, Check, AlertCircle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export const CompanyDriverManager: React.FC = () => {
  const { 
    drivers, 
    isLoadingDrivers, 
    pendingDrivers, 
    isLoadingPending,
    removeDriver,
    approveDriver,
    rejectDriver,
    company 
  } = useTransportCompany();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [driverToRemove, setDriverToRemove] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);

  const handleRemoveDriver = async () => {
    if (!driverToRemove) return;
    await removeDriver(driverToRemove);
    setDriverToRemove(null);
  };

  // Filtrar motoristas
  const filteredDrivers = (drivers || []).filter((cd: any) => {
    const term = searchTerm.trim().toLowerCase();
    const name = cd.driver?.full_name?.toLowerCase() || '';
    const email = cd.driver?.email?.toLowerCase() || '';
    const phone = (cd.driver?.phone || cd.driver?.contact_phone || '').toLowerCase();
    
    const matchesSearch = term === '' || name.includes(term) || email.includes(term) || phone.includes(term);
    const matchesStatus = statusFilter === 'all' || cd.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-4">
      {/* Solicitações Pendentes */}
      {pendingDrivers && pendingDrivers.length > 0 && (
        <Card className="border-yellow-500/50 bg-yellow-50/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-700">
              <Users className="h-5 w-5" />
              Solicitações Pendentes ({pendingDrivers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingDrivers.map((driver: any) => {
                const validation = useDriverValidation(driver.driver);
                
                return (
                  <div 
                    key={driver.id} 
                    className="relative p-4 border-2 border-green-500 rounded-lg bg-background shadow-lg animate-pulse-border"
                  >
                    {/* Badge "NOVO" */}
                    <div className="absolute -top-2 -right-2 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold animate-bounce z-10">
                      NOVO
                    </div>

                    <div className="flex flex-col gap-4">
                      {/* Header com foto e info */}
                      <div className="flex items-center gap-4">
                        <Avatar className="h-16 w-16 border-2 border-green-500">
                          <AvatarImage src={driver.driver?.profile_photo_url || driver.driver?.selfie_url} />
                          <AvatarFallback className="bg-green-100 text-green-700 text-xl font-bold">
                            {driver.driver?.full_name?.charAt(0) || '?'}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1">
                          <p className="font-semibold text-lg">{driver.driver?.full_name}</p>
                          <p className="text-sm text-muted-foreground">{driver.driver?.email}</p>
                          <p className="text-sm text-muted-foreground">{driver.driver?.contact_phone}</p>
                          
                          {driver.driver?.rating > 0 && (
                            <div className="flex items-center gap-1 mt-1">
                              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                              <span className="text-sm">{driver.driver.rating.toFixed(1)}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Badges de validação */}
                      <div className="flex flex-wrap gap-2">
                        {driver.driver?.cnh_validation_status === 'APPROVED' && (
                          <Badge variant="outline" className="text-xs bg-green-50 border-green-500 text-green-700">
                            <Check className="h-3 w-3 mr-1" /> CNH Válida
                          </Badge>
                        )}
                        {driver.driver?.document_validation_status === 'APPROVED' && (
                          <Badge variant="outline" className="text-xs bg-green-50 border-green-500 text-green-700">
                            <Check className="h-3 w-3 mr-1" /> Documentos OK
                          </Badge>
                        )}
                        {!driver.driver?.cnh_photo_url && (
                          <Badge variant="destructive" className="text-xs">
                            <AlertCircle className="h-3 w-3 mr-1" /> Falta CNH
                          </Badge>
                        )}
                        {!driver.driver?.profile_photo_url && !driver.driver?.selfie_url && (
                          <Badge variant="destructive" className="text-xs">
                            <AlertCircle className="h-3 w-3 mr-1" /> Falta Foto
                          </Badge>
                        )}
                      </div>

                      {/* Barra de completude do perfil */}
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Completude do Perfil</span>
                          <span className="font-bold text-foreground">{validation.score}%</span>
                        </div>
                        <Progress value={validation.score} className="h-2" />
                      </div>

                      {/* Avisos de dados faltando */}
                      {validation.missingFields.length > 0 && (
                        <Alert variant="destructive" className="py-2">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription className="text-xs">
                            <strong>Dados faltando:</strong> {validation.missingFields.join(', ')}
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Avisos gerais */}
                      {validation.warnings.length > 0 && validation.missingFields.length === 0 && (
                        <Alert className="py-2">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription className="text-xs">
                            {validation.warnings.join('; ')}
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Botões de ação */}
                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => approveDriver.mutate(driver.driver_profile_id)}
                          disabled={!validation.isValid || approveDriver.isPending}
                          title={!validation.isValid ? 'Motorista com dados incompletos' : 'Aprovar motorista'}
                        >
                          Aprovar
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => rejectDriver.mutate(driver.driver_profile_id)}
                          disabled={rejectDriver.isPending}
                        >
                          Rejeitar
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cabeçalho com ações */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5" />
            Motoristas Afiliados
          </h3>
          <p className="text-sm text-muted-foreground">
            Gerencie os motoristas da sua transportadora
          </p>
        </div>
        
        <Button onClick={() => setShowInviteModal(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Convidar Motorista
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="ACTIVE">Ativos</SelectItem>
                <SelectItem value="INACTIVE">Inativos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Lista de motoristas */}
      {isLoadingDrivers ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Carregando motoristas...</p>
          </CardContent>
        </Card>
      ) : filteredDrivers.length > 0 ? (
        <div className="grid gap-4">
          {filteredDrivers.map((cd: any) => (
            <Card key={cd.id}>
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row justify-between gap-4">
                  <div className="space-y-3 flex-1">
                    {/* Nome e Status */}
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold text-lg">{cd.driver?.full_name}</h4>
                        <Badge variant={cd.status === 'ACTIVE' ? 'default' : 'secondary'} className="mt-1">
                          {cd.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </div>
                    </div>

                    {/* Informações de contato */}
                    <div className="space-y-2">
                      {cd.driver?.email && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="h-4 w-4" />
                          <span>{cd.driver.email}</span>
                        </div>
                      )}
                      {(cd.driver?.phone || cd.driver?.contact_phone) && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Phone className="h-4 w-4" />
                          <span>{cd.driver?.phone || cd.driver?.contact_phone}</span>
                        </div>
                      )}
                    </div>

                    {/* Avaliação */}
                    {cd.driver?.rating > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 text-sm">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          <span className="font-medium">{cd.driver.rating.toFixed(1)}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          ({cd.driver.total_ratings} avaliações)
                        </span>
                      </div>
                    )}

                    {/* Permissões */}
                    <div className="flex flex-wrap gap-2">
                      {cd.can_accept_freights && (
                        <Badge variant="outline" className="text-xs">
                          <Truck className="h-3 w-3 mr-1" />
                          Aceita fretes
                        </Badge>
                      )}
                      {cd.can_manage_vehicles && (
                        <Badge variant="outline" className="text-xs">
                          <Truck className="h-3 w-3 mr-1" />
                          Gerencia veículos
                        </Badge>
                      )}
                    </div>

                    {/* Notas */}
                    {cd.notes && (
                      <p className="text-sm text-muted-foreground italic">
                        {cd.notes}
                      </p>
                    )}
                  </div>

                  {/* Ações */}
                  <div className="flex sm:flex-col gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedDriver(cd.driver_profile_id)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Ver Detalhes
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDriverToRemove(cd.driver_profile_id)}
                      title="Remover motorista"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6 text-center space-y-4">
            <Users className="h-12 w-12 mx-auto opacity-50" />
            <div>
              <p className="text-muted-foreground mb-1">
                {searchTerm || statusFilter !== 'all' 
                  ? 'Nenhum motorista encontrado com os filtros aplicados' 
                  : 'Nenhum motorista afiliado ainda'}
              </p>
              {!searchTerm && statusFilter === 'all' && (
                <Button onClick={() => setShowInviteModal(true)} variant="outline" className="mt-4">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Convidar Primeiro Motorista
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modals */}
      <CompanyInviteModal open={showInviteModal} onOpenChange={setShowInviteModal} />

      {company && (
        <DriverDetailsModal
          driverProfileId={selectedDriver}
          companyId={company.id}
          open={!!selectedDriver}
          onOpenChange={(open) => !open && setSelectedDriver(null)}
        />
      )}

      <AlertDialog open={!!driverToRemove} onOpenChange={() => setDriverToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Motorista</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este motorista da sua transportadora?
              Ele não terá mais acesso aos fretes da empresa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveDriver} className="bg-destructive text-destructive-foreground">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};