import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Info,
  FileSearch,
  Users,
  TrendingUp
} from 'lucide-react';
import { 
  computePanelCapabilities, 
  type PanelKey, 
  type ActionKey,
  type PanelCapabilities 
} from '@/lib/panel-capabilities';
import { Separator } from '@/components/ui/separator';

interface PermissionAuditResult {
  panel: PanelKey;
  capabilities: PanelCapabilities;
  allowedCount: number;
  deniedCount: number;
  issues: AuditIssue[];
}

interface AuditIssue {
  severity: 'critical' | 'warning' | 'info';
  category: string;
  message: string;
  suggestion?: string;
}

export const AdminPermissionsAudit: React.FC = () => {
  const [auditResults, setAuditResults] = useState<PermissionAuditResult[]>([]);
  const [globalIssues, setGlobalIssues] = useState<AuditIssue[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const runAudit = () => {
    setIsRunning(true);
    const results: PermissionAuditResult[] = [];
    const issues: AuditIssue[] = [];

    const panels: PanelKey[] = ['ADMIN', 'PRODUTOR', 'DRIVER', 'COMPANY', 'SERVICE_PROVIDER'];

    panels.forEach(panel => {
      const capabilities = computePanelCapabilities({
        panel,
        profile: { role: panel } as any,
        companyDriver: {
          isCompanyDriver: false,
          canAcceptFreights: true,
          canManageVehicles: true,
          isAffiliated: false,
        },
        context: {
          hasActiveAssignment: false,
          hasANTTPrice: false,
        }
      });

      const allowedCount = Object.values(capabilities).filter(c => c.allowed).length;
      const deniedCount = Object.values(capabilities).filter(c => !c.allowed).length;
      const panelIssues: AuditIssue[] = [];

      // Análise específica por painel
      if (panel === 'PRODUTOR') {
        // Verificar se produtor tem permissões críticas
        if (!capabilities.create_freight.allowed) {
          panelIssues.push({
            severity: 'critical',
            category: 'Missing Permission',
            message: 'Produtor não pode criar fretes',
            suggestion: 'Adicionar capabilities.create_freight = { allowed: true }'
          });
        }
        if (!capabilities.accept_driver_proposal.allowed) {
          panelIssues.push({
            severity: 'critical',
            category: 'Missing Permission',
            message: 'Produtor não pode aceitar propostas',
            suggestion: 'Adicionar capabilities.accept_driver_proposal = { allowed: true }'
          });
        }
        if (!capabilities.chat.allowed) {
          panelIssues.push({
            severity: 'warning',
            category: 'Missing Permission',
            message: 'Produtor não pode usar chat',
            suggestion: 'Adicionar capabilities.chat = { allowed: true }'
          });
        }
        // Verificar permissões extras que produtor NÃO deveria ter
        if (capabilities.submit_freight_proposal.allowed) {
          panelIssues.push({
            severity: 'warning',
            category: 'Unnecessary Permission',
            message: 'Produtor tem permissão de enviar propostas (deveria ser só motorista)',
            suggestion: 'Remover esta permissão do painel PRODUTOR'
          });
        }
      }

      if (panel === 'DRIVER') {
        // Verificar permissões críticas de motorista
        if (!capabilities.view_platform_freights.allowed) {
          panelIssues.push({
            severity: 'warning',
            category: 'Context-Dependent',
            message: 'Motorista não pode ver fretes da plataforma (pode ser devido a contexto)',
            suggestion: 'Verificar lógica de isCompanyDriver e canAcceptFreights'
          });
        }
        if (!capabilities.chat.allowed) {
          panelIssues.push({
            severity: 'critical',
            category: 'Missing Permission',
            message: 'Motorista não pode usar chat',
            suggestion: 'Adicionar capabilities.chat = { allowed: true }'
          });
        }
        // Verificar se motorista pode criar frete (não deveria)
        if (capabilities.create_freight.allowed) {
          panelIssues.push({
            severity: 'critical',
            category: 'Security Risk',
            message: 'Motorista tem permissão de criar fretes (privilégio elevado)',
            suggestion: 'Remover esta permissão do painel DRIVER'
          });
        }
      }

      if (panel === 'COMPANY') {
        // Verificar permissões críticas de transportadora
        if (!capabilities.manage_company_freights.allowed) {
          panelIssues.push({
            severity: 'critical',
            category: 'Missing Permission',
            message: 'Transportadora não pode gerenciar seus fretes',
            suggestion: 'Adicionar capabilities.manage_company_freights = { allowed: true }'
          });
        }
        if (!capabilities.submit_freight_proposal.allowed) {
          panelIssues.push({
            severity: 'critical',
            category: 'Missing Permission',
            message: 'Transportadora não pode enviar propostas',
            suggestion: 'Adicionar capabilities.submit_freight_proposal = { allowed: true }'
          });
        }
        if (!capabilities.assign_driver.allowed) {
          panelIssues.push({
            severity: 'critical',
            category: 'Missing Permission',
            message: 'Transportadora não pode atribuir motoristas',
            suggestion: 'Adicionar capabilities.assign_driver = { allowed: true }'
          });
        }
        if (!capabilities.chat.allowed) {
          panelIssues.push({
            severity: 'warning',
            category: 'Missing Permission',
            message: 'Transportadora não pode usar chat',
            suggestion: 'Adicionar capabilities.chat = { allowed: true }'
          });
        }
      }

      if (panel === 'SERVICE_PROVIDER') {
        // Verificar permissões de prestador de serviço
        if (!capabilities.view_service_requests.allowed) {
          panelIssues.push({
            severity: 'critical',
            category: 'Missing Permission',
            message: 'Prestador não pode ver solicitações de serviço',
            suggestion: 'Adicionar capabilities.view_service_requests = { allowed: true }'
          });
        }
        if (!capabilities.submit_service_proposal_sp.allowed) {
          panelIssues.push({
            severity: 'critical',
            category: 'Missing Permission',
            message: 'Prestador não pode enviar propostas',
            suggestion: 'Adicionar capabilities.submit_service_proposal_sp = { allowed: true }'
          });
        }
      }

      results.push({
        panel,
        capabilities,
        allowedCount,
        deniedCount,
        issues: panelIssues
      });
    });

    // Análise global
    // Verificar se há capacidades não utilizadas
    const allCapabilities: ActionKey[] = [
      'view_platform_freights',
      'view_company_freights',
      'submit_freight_proposal',
      'submit_service_proposal',
      'manage_own_vehicles',
      'checkin',
      'withdraw',
      'chat',
      'create_freight',
      'edit_own_freight',
      'cancel_own_freight',
      'accept_driver_proposal',
      'rate_driver',
      'manage_company_freights',
      'assign_driver',
      'see_company_drivers',
      'manage_company_vehicles',
      'approve_affiliation',
      'rate_company_driver',
      'view_service_requests',
      'submit_service_proposal_sp',
      'complete_service',
      'service_chat',
      'view_antt_breakdown',
      'receive_notifications',
    ];

    // Verificar capacidades órfãs (não usadas por nenhum painel exceto ADMIN)
    allCapabilities.forEach(capability => {
      const usedByNonAdmin = results
        .filter(r => r.panel !== 'ADMIN')
        .some(r => r.capabilities[capability].allowed);
      
      if (!usedByNonAdmin) {
        issues.push({
          severity: 'info',
          category: 'Unused Capability',
          message: `Capacidade "${capability}" não é usada por nenhum painel (exceto ADMIN)`,
          suggestion: 'Considerar remover se não for necessária ou adicionar aos painéis relevantes'
        });
      }
    });

    // Verificar se ADMIN tem todas as permissões
    const adminResult = results.find(r => r.panel === 'ADMIN');
    if (adminResult && adminResult.deniedCount > 0) {
      issues.push({
        severity: 'critical',
        category: 'Admin Restrictions',
        message: `ADMIN tem ${adminResult.deniedCount} permissões negadas (admin deve ter tudo)`,
        suggestion: 'Verificar lógica de computePanelCapabilities para painel ADMIN'
      });
    }

    setAuditResults(results);
    setGlobalIssues(issues);
    setIsRunning(false);
  };

  useEffect(() => {
    runAudit();
  }, []);

  const getSeverityBadge = (severity: AuditIssue['severity']) => {
    switch (severity) {
      case 'critical':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Crítico</Badge>;
      case 'warning':
        return <Badge variant="secondary" className="gap-1"><AlertTriangle className="h-3 w-3" />Aviso</Badge>;
      case 'info':
        return <Badge variant="outline" className="gap-1"><Info className="h-3 w-3" />Info</Badge>;
    }
  };

  const totalIssues = auditResults.reduce((sum, r) => sum + r.issues.length, 0) + globalIssues.length;
  const criticalIssues = [...auditResults.flatMap(r => r.issues), ...globalIssues].filter(i => i.severity === 'critical').length;
  const warningIssues = [...auditResults.flatMap(r => r.issues), ...globalIssues].filter(i => i.severity === 'warning').length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Auditoria de Permissões do Sistema
          </CardTitle>
          <CardDescription>
            Análise completa das capacidades e permissões de todos os painéis de usuário
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total de Issues</p>
                    <p className="text-2xl font-bold">{totalIssues}</p>
                  </div>
                  <FileSearch className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Críticos</p>
                    <p className="text-2xl font-bold text-destructive">{criticalIssues}</p>
                  </div>
                  <XCircle className="h-8 w-8 text-destructive" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Avisos</p>
                    <p className="text-2xl font-bold text-orange-500">{warningIssues}</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Painéis</p>
                    <p className="text-2xl font-bold">{auditResults.length}</p>
                  </div>
                  <Users className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Button onClick={runAudit} disabled={isRunning} className="mb-4">
            {isRunning ? 'Executando...' : 'Executar Auditoria Novamente'}
          </Button>

          <Tabs defaultValue="summary" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="summary">Resumo</TabsTrigger>
              <TabsTrigger value="panels">Por Painel</TabsTrigger>
              <TabsTrigger value="global">Issues Globais</TabsTrigger>
            </TabsList>

            <TabsContent value="summary" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Resumo da Auditoria</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {auditResults.map(result => (
                      <div key={result.panel} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <Badge variant="outline" className="text-lg px-4 py-2">
                            {result.panel}
                          </Badge>
                          <div>
                            <p className="text-sm text-muted-foreground">
                              {result.allowedCount} permitidas • {result.deniedCount} negadas
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {result.issues.length > 0 ? (
                            <>
                              <Badge variant="destructive">{result.issues.filter(i => i.severity === 'critical').length} críticos</Badge>
                              <Badge variant="secondary">{result.issues.filter(i => i.severity === 'warning').length} avisos</Badge>
                            </>
                          ) : (
                            <Badge variant="outline" className="gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Sem issues
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="panels" className="space-y-4">
              {auditResults.map(result => (
                <Card key={result.panel}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Painel: {result.panel}</span>
                      <div className="flex gap-2">
                        <Badge variant="outline">{result.allowedCount} ✓</Badge>
                        <Badge variant="secondary">{result.deniedCount} ✗</Badge>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {result.issues.length > 0 ? (
                      <div className="space-y-3">
                        <h4 className="font-semibold text-sm">Issues Encontradas:</h4>
                        {result.issues.map((issue, idx) => (
                          <Alert key={idx} variant={issue.severity === 'critical' ? 'destructive' : 'default'}>
                            <AlertDescription>
                              <div className="space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      {getSeverityBadge(issue.severity)}
                                      <Badge variant="outline">{issue.category}</Badge>
                                    </div>
                                    <p className="font-medium">{issue.message}</p>
                                  </div>
                                </div>
                                {issue.suggestion && (
                                  <p className="text-sm text-muted-foreground mt-2">
                                    💡 Sugestão: {issue.suggestion}
                                  </p>
                                )}
                              </div>
                            </AlertDescription>
                          </Alert>
                        ))}
                      </div>
                    ) : (
                      <Alert>
                        <CheckCircle2 className="h-4 w-4" />
                        <AlertDescription>
                          Nenhuma issue detectada para este painel.
                        </AlertDescription>
                      </Alert>
                    )}

                    <Separator className="my-4" />

                    <div>
                      <h4 className="font-semibold text-sm mb-3">Todas as Capacidades:</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {(Object.keys(result.capabilities) as ActionKey[]).map(capability => {
                          const cap = result.capabilities[capability];
                          return (
                            <div key={capability} className="flex items-center justify-between p-2 border rounded text-sm">
                              <span className="font-mono text-xs">{capability}</span>
                              {cap.allowed ? (
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-500" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="global" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Issues Globais do Sistema</CardTitle>
                  <CardDescription>
                    Problemas que afetam múltiplos painéis ou a arquitetura geral
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {globalIssues.length > 0 ? (
                    <div className="space-y-3">
                      {globalIssues.map((issue, idx) => (
                        <Alert key={idx} variant={issue.severity === 'critical' ? 'destructive' : 'default'}>
                          <AlertDescription>
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 mb-1">
                                {getSeverityBadge(issue.severity)}
                                <Badge variant="outline">{issue.category}</Badge>
                              </div>
                              <p className="font-medium">{issue.message}</p>
                              {issue.suggestion && (
                                <p className="text-sm text-muted-foreground mt-2">
                                  💡 Sugestão: {issue.suggestion}
                                </p>
                              )}
                            </div>
                          </AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  ) : (
                    <Alert>
                      <CheckCircle2 className="h-4 w-4" />
                      <AlertDescription>
                        Nenhuma issue global detectada.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
