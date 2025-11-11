import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useDriverAffiliations } from '@/hooks/useDriverAffiliations';
import { Building2, MapPin, CheckCircle, XCircle, LogOut, LogIn, AlertCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Componente para motoristas gerenciarem suas afiliações a transportadoras.
 * Permite ver afiliações ativas, sair de transportadoras, e reativar afiliações anteriores.
 */
export const DriverAffiliationsManager: React.FC = () => {
  const {
    activeAffiliations,
    inactiveAffiliations,
    allActiveCities,
    allActiveStates,
    isLoading,
    isLeaving,
    isRejoining,
    leaveCompany,
    rejoinCompany,
    canAcceptIndependentFreights,
  } = useDriverAffiliations();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      {/* Seção: Informações de Permissões */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Suas Permissões como Motorista</AlertTitle>
        <AlertDescription>
          <ul className="text-sm space-y-1 mt-2">
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>Você pode aceitar fretes independentes a qualquer momento</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>Você pode estar em múltiplas transportadoras simultaneamente</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>Você pode sair de transportadoras quando quiser</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>Você pode voltar a transportadoras anteriormente deixadas</span>
            </li>
          </ul>
        </AlertDescription>
      </Alert>

      {/* Seção: Afiliações Ativas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-green-600" />
            Transportadoras Ativas ({activeAffiliations.length})
          </CardTitle>
          <CardDescription>
            Transportadoras às quais você está atualmente afiliado
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeAffiliations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Você não está afiliado a nenhuma transportadora no momento.</p>
              <p className="text-sm mt-1">Você pode aceitar fretes independentes livremente.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeAffiliations.map((affiliation: any) => (
                <Card key={affiliation.id} className="border-green-200 bg-green-50/50">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-lg">
                            {affiliation.company?.company_name || 'Nome não disponível'}
                          </h4>
                          <Badge variant="default" className="bg-green-600">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Ativo
                          </Badge>
                        </div>
                        
                        {affiliation.company?.company_cnpj && (
                          <p className="text-sm text-muted-foreground">
                            CNPJ: {affiliation.company.company_cnpj}
                          </p>
                        )}
                        
                        {affiliation.company?.city && affiliation.company?.state && (
                          <div className="flex items-center gap-1 text-sm">
                            <MapPin className="h-4 w-4" />
                            <span>{affiliation.company.city}, {affiliation.company.state}</span>
                          </div>
                        )}
                        
                        <div className="flex flex-wrap gap-2 text-xs">
                          {affiliation.can_accept_freights && (
                            <Badge variant="secondary">Pode aceitar fretes</Badge>
                          )}
                          {affiliation.can_manage_vehicles && (
                            <Badge variant="secondary">Pode gerenciar veículos</Badge>
                          )}
                        </div>
                        
                        <p className="text-xs text-muted-foreground">
                          Afiliado desde {format(new Date(affiliation.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                        </p>
                      </div>
                      
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => leaveCompany(affiliation.company_id)}
                        disabled={isLeaving}
                      >
                        {isLeaving ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            Saindo...
                          </>
                        ) : (
                          <>
                            <LogOut className="h-4 w-4 mr-1" />
                            Sair
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Seção: Cidades de Atuação */}
      {allActiveCities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Suas Cidades de Atuação
            </CardTitle>
            <CardDescription>
              Você verá fretes que começam ou terminam nestas cidades ou estados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium mb-2">Cidades:</p>
                <div className="flex flex-wrap gap-2">
                  {allActiveCities.map((city, index) => (
                    <Badge key={index} variant="secondary">
                      {city}
                    </Badge>
                  ))}
                </div>
              </div>
              
              {allActiveStates.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Estados ativos:</p>
                  <div className="flex flex-wrap gap-2">
                    {allActiveStates.map((state, index) => (
                      <Badge key={index} variant="outline">
                        {state}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Seção: Afiliações Anteriores */}
      {inactiveAffiliations.length > 0 && (
        <>
          <Separator />
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-muted-foreground" />
                Afiliações Anteriores ({inactiveAffiliations.length})
              </CardTitle>
              <CardDescription>
                Transportadoras das quais você saiu - você pode voltar a qualquer momento
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {inactiveAffiliations.map((affiliation: any) => (
                  <Card key={affiliation.id} className="border-muted">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">
                              {affiliation.company?.company_name || 'Nome não disponível'}
                            </h4>
                            <Badge variant="secondary">
                              Inativo
                            </Badge>
                          </div>
                          
                          {affiliation.company?.city && affiliation.company?.state && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <MapPin className="h-4 w-4" />
                              <span>{affiliation.company.city}, {affiliation.company.state}</span>
                            </div>
                          )}
                          
                          {affiliation.left_at && (
                            <p className="text-xs text-muted-foreground">
                              Você saiu em {format(new Date(affiliation.left_at), 'dd/MM/yyyy', { locale: ptBR })}
                            </p>
                          )}
                        </div>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => rejoinCompany(affiliation.company_id)}
                          disabled={isRejoining}
                        >
                          {isRejoining ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              Voltando...
                            </>
                          ) : (
                            <>
                              <LogIn className="h-4 w-4 mr-1" />
                              Voltar
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
