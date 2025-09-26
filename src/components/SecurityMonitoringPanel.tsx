import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Shield, AlertTriangle, Eye, Users, Activity, Ban } from "lucide-react";

interface AuditLog {
  id: string;
  user_id: string;
  table_name: string;
  operation: string;
  timestamp: string;
  new_data?: any;
  old_data?: any;
}

interface RateLimitViolation {
  id: string;
  user_id: string | null;
  ip_address: string | null;
  endpoint: string;
  violation_count: number;
  first_violation_at: string;
  last_violation_at: string;
}

interface SecurityBlacklist {
  id: string;
  ip_address?: string | null;
  user_id?: string | null;
  reason: string;
  blocked_at: string;
  blocked_until?: string | null;
  is_permanent: boolean;
}

export const SecurityMonitoringPanel: React.FC = () => {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [rateLimitViolations, setRateLimitViolations] = useState<RateLimitViolation[]>([]);
  const [securityBlacklist, setSecurityBlacklist] = useState<SecurityBlacklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalAudits: 0,
    totalViolations: 0,
    totalBlocked: 0,
    suspiciousActivity: 0
  });
  const { toast } = useToast();

  useEffect(() => {
    loadSecurityData();
  }, []);

  const loadSecurityData = async () => {
    try {
      setLoading(true);

      // Carregar logs de auditoria (últimas 100 entradas)
      const { data: audits, error: auditError } = await supabase
        .from('audit_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100);

      if (auditError) throw auditError;

      // Carregar violações de rate limit
      const { data: violations, error: violationError } = await supabase
        .from('rate_limit_violations')
        .select('*')
        .order('last_violation_at', { ascending: false })
        .limit(50);

      if (violationError) throw violationError;

      // Carregar blacklist de segurança
      const { data: blacklist, error: blacklistError } = await supabase
        .from('security_blacklist')
        .select('*')
        .order('blocked_at', { ascending: false });

      if (blacklistError) throw blacklistError;

      setAuditLogs(audits || []);
      setRateLimitViolations((violations as RateLimitViolation[]) || []);
      setSecurityBlacklist((blacklist as SecurityBlacklist[]) || []);

      // Calcular estatísticas
      const suspiciousCount = audits?.filter(log => 
        log.operation === 'SUSPICIOUS_ACCESS' || 
        log.table_name === 'security_alerts'
      ).length || 0;

      setStats({
        totalAudits: audits?.length || 0,
        totalViolations: violations?.length || 0,
        totalBlocked: blacklist?.length || 0,
        suspiciousActivity: suspiciousCount
      });

    } catch (error: any) {
      console.error('Error loading security data:', error);
      toast({
        variant: "destructive",
        title: "Erro ao carregar dados de segurança",
        description: "Não foi possível carregar os dados. Tente novamente."
      });
    } finally {
      setLoading(false);
    }
  };

  const blockIP = async (ipAddress: string, reason: string, permanent: boolean = false) => {
    try {
      const { error } = await supabase
        .from('security_blacklist')
        .insert({
          ip_address: ipAddress,
          reason: reason,
          is_permanent: permanent,
          blocked_until: permanent ? null : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        });

      if (error) throw error;

      toast({
        title: "IP Bloqueado",
        description: `IP ${ipAddress} foi bloqueado com sucesso.`
      });

      loadSecurityData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao bloquear IP",
        description: "Não foi possível bloquear o IP. Tente novamente."
      });
    }
  };

  const unblockIP = async (blacklistId: string) => {
    try {
      const { error } = await supabase
        .from('security_blacklist')
        .delete()
        .eq('id', blacklistId);

      if (error) throw error;

      toast({
        title: "IP Desbloqueado",
        description: "IP foi removido da blacklist com sucesso."
      });

      loadSecurityData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao desbloquear IP",
        description: "Não foi possível desbloquear o IP. Tente novamente."
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <Shield className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Monitoramento de Segurança</h1>
      </div>

      {/* Estatísticas de Segurança */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Eye className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Total de Auditorias</p>
                <p className="text-2xl font-bold">{stats.totalAudits}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <div>
                <p className="text-sm text-muted-foreground">Violações Rate Limit</p>
                <p className="text-2xl font-bold">{stats.totalViolations}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Ban className="h-4 w-4 text-red-600" />
              <div>
                <p className="text-sm text-muted-foreground">IPs Bloqueados</p>
                <p className="text-2xl font-bold">{stats.totalBlocked}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Activity className="h-4 w-4 text-orange-600" />
              <div>
                <p className="text-sm text-muted-foreground">Atividades Suspeitas</p>
                <p className="text-2xl font-bold">{stats.suspiciousActivity}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="audit" className="w-full">
        <TabsList>
          <TabsTrigger value="audit">Logs de Auditoria</TabsTrigger>
          <TabsTrigger value="violations">Violações Rate Limit</TabsTrigger>
          <TabsTrigger value="blacklist">Blacklist de Segurança</TabsTrigger>
        </TabsList>

        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Logs de Auditoria Recentes</CardTitle>
              <CardDescription>
                Monitoramento de todas as ações críticas no sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {auditLogs.map((log) => (
                  <div 
                    key={log.id} 
                    className="flex items-center justify-between p-2 border rounded"
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <Badge variant={
                          log.operation === 'SUSPICIOUS_ACCESS' ? 'destructive' :
                          log.operation === 'DELETE' ? 'destructive' :
                          log.operation === 'UPDATE' ? 'default' : 'secondary'
                        }>
                          {log.operation}
                        </Badge>
                        <span className="font-medium">{log.table_name}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {new Date(log.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      User: {log.user_id?.slice(0, 8)}...
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="violations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Violações de Rate Limit</CardTitle>
              <CardDescription>
                Usuários e IPs que excederam limites de requisições
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {rateLimitViolations.map((violation) => (
                  <div 
                    key={violation.id} 
                    className="flex items-center justify-between p-3 border rounded"
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        <span className="font-medium">{violation.ip_address}</span>
                        <Badge variant="outline">{violation.endpoint}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {violation.violation_count} violações - 
                        Última: {new Date(violation.last_violation_at).toLocaleString()}
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => blockIP(violation.ip_address, `Rate limit exceeded: ${violation.violation_count} times`)}
                    >
                      Bloquear IP
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="blacklist" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Blacklist de Segurança</CardTitle>
              <CardDescription>
                IPs e usuários bloqueados por atividade suspeita
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {securityBlacklist.map((entry) => (
                  <div 
                    key={entry.id} 
                    className="flex items-center justify-between p-3 border rounded"
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <Ban className="h-4 w-4 text-red-600" />
                        <span className="font-medium">
                          {entry.ip_address || `User: ${entry.user_id?.slice(0, 8)}...`}
                        </span>
                        <Badge variant={entry.is_permanent ? "destructive" : "secondary"}>
                          {entry.is_permanent ? "Permanente" : "Temporário"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Razão: {entry.reason}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Bloqueado em: {new Date(entry.blocked_at).toLocaleString()}
                        {entry.blocked_until && !entry.is_permanent && 
                          ` - Até: ${new Date(entry.blocked_until).toLocaleString()}`
                        }
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => unblockIP(entry.id)}
                    >
                      Desbloquear
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Alert>
        <Shield className="h-4 w-4" />
        <AlertTitle>Sistema de Proteção Ativo</AlertTitle>
        <AlertDescription>
          Monitoramento Zero-Trust ativo com auditoria completa, rate limiting, 
          criptografia de dados sensíveis e detecção de atividades suspeitas.
        </AlertDescription>
      </Alert>
    </div>
  );
};