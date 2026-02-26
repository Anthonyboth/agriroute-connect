/**
 * Service Dimension — dimensão analítica oficial para relatórios do PRESTADOR.
 * Cada serviço tem um ID canônico, label, canais e ordem de exibição.
 */

export type ServiceChannel = 'agricultural' | 'technical' | 'urban' | 'logistics';

export type ServiceDim = {
  id: string;
  label: string;
  channels: ServiceChannel[];
  order: number;
  isOther?: boolean;
};

export const CHANNEL_LABELS: Record<ServiceChannel, string> = {
  agricultural: 'Agrícola',
  technical: 'Técnico',
  urban: 'Urbano',
  logistics: 'Logística',
};

export const CHANNEL_ABBR: Record<ServiceChannel, string> = {
  agricultural: 'AGR',
  technical: 'TECH',
  urban: 'URB',
  logistics: 'LOG',
};

export const CHANNEL_COLORS: Record<ServiceChannel, string> = {
  agricultural: 'hsl(142,71%,45%)',
  technical: 'hsl(221,83%,53%)',
  urban: 'hsl(262,83%,58%)',
  logistics: 'hsl(25,95%,53%)',
};

export const SERVICE_DIM: Record<string, ServiceDim> = {
  AGRONOMO:                           { id: 'AGRONOMO',                           label: 'Agrônomo',                              channels: ['agricultural', 'technical'],                   order: 10  },
  ANALISE_SOLO:                       { id: 'ANALISE_SOLO',                       label: 'Análise de Solo',                       channels: ['agricultural', 'technical'],                   order: 20  },
  ARMAZENAGEM:                        { id: 'ARMAZENAGEM',                        label: 'Armazenagem',                           channels: ['agricultural', 'logistics'],                   order: 30  },
  ASSISTENCIA_TECNICA:                { id: 'ASSISTENCIA_TECNICA',                label: 'Técnico Agrícola',                      channels: ['agricultural', 'technical'],                   order: 40  },
  AUTO_ELETRICA:                      { id: 'AUTO_ELETRICA',                      label: 'Auto Elétrica',                         channels: ['agricultural', 'technical', 'urban'],          order: 50  },
  AUTOMACAO_INDUSTRIAL:               { id: 'AUTOMACAO_INDUSTRIAL',               label: 'Automação Industrial',                  channels: ['agricultural', 'technical'],                   order: 60  },
  BORRACHEIRO:                        { id: 'BORRACHEIRO',                        label: 'Borracharia',                           channels: ['agricultural', 'technical', 'urban'],          order: 70  },
  CARREGAMENTO_DESCARREGAMENTO:       { id: 'CARREGAMENTO_DESCARREGAMENTO',       label: 'Saqueiros / Ajudantes',                 channels: ['agricultural', 'urban'],                       order: 80  },
  CFTV_SEGURANCA:                     { id: 'CFTV_SEGURANCA',                     label: 'CFTV e Segurança',                      channels: ['agricultural', 'technical', 'urban'],          order: 90  },
  CHAVEIRO:                           { id: 'CHAVEIRO',                           label: 'Chaveiro',                              channels: ['agricultural', 'technical', 'urban'],          order: 100 },
  CLASSIFICACAO_GRAOS:                { id: 'CLASSIFICACAO_GRAOS',                label: 'Classificação de Grãos',                channels: ['agricultural', 'technical'],                   order: 110 },
  COLHEITA_PLANTIO_TERCEIRIZADA:      { id: 'COLHEITA_PLANTIO_TERCEIRIZADA',      label: 'Colheita e Plantio',                    channels: ['agricultural'],                                order: 120 },
  CONSTRUCAO_MANUTENCAO_CERCAS:       { id: 'CONSTRUCAO_MANUTENCAO_CERCAS',       label: 'Cercas',                                channels: ['agricultural', 'technical'],                   order: 130 },
  CONSULTORIA_TI:                     { id: 'CONSULTORIA_TI',                     label: 'Consultoria T.I',                       channels: ['agricultural', 'technical', 'urban'],          order: 140 },
  ENERGIA_SOLAR:                      { id: 'ENERGIA_SOLAR',                      label: 'Energia Solar',                         channels: ['agricultural', 'technical', 'urban'],          order: 150 },
  GUINDASTE:                          { id: 'GUINDASTE',                          label: 'Guindaste',                             channels: ['agricultural', 'logistics'],                   order: 160 },
  LIMPEZA_DESASSOREAMENTO_REPRESAS:   { id: 'LIMPEZA_DESASSOREAMENTO_REPRESAS',   label: 'Limpeza de Represas',                   channels: ['agricultural', 'technical'],                   order: 170 },
  MANUTENCAO_BALANCAS:                { id: 'MANUTENCAO_BALANCAS',                label: 'Manutenção de Balanças',                channels: ['agricultural', 'technical', 'urban'],          order: 180 },
  MANUTENCAO_REVISAO_GPS:             { id: 'MANUTENCAO_REVISAO_GPS',             label: 'Manutenção GPS',                        channels: ['agricultural', 'technical', 'urban'],          order: 190 },
  MECANICO:                           { id: 'MECANICO',                           label: 'Mecânico',                              channels: ['agricultural', 'technical', 'urban'],          order: 200 },
  MECANICO_INDUSTRIAL:                { id: 'MECANICO_INDUSTRIAL',                label: 'Mecânico Industrial',                   channels: ['agricultural', 'technical', 'urban'],          order: 210 },
  OPERADOR_MAQUINAS:                  { id: 'OPERADOR_MAQUINAS',                  label: 'Operador de Máquinas',                  channels: ['agricultural', 'technical'],                   order: 220 },
  PIVO_IRRIGACAO:                     { id: 'PIVO_IRRIGACAO',                     label: 'Pivô Irrigação',                        channels: ['agricultural', 'technical'],                   order: 230 },
  PULVERIZACAO_DRONE:                 { id: 'PULVERIZACAO_DRONE',                 label: 'Pulverização por Drone',                channels: ['agricultural', 'technical'],                   order: 240 },
  SECAGEM_GRAOS:                      { id: 'SECAGEM_GRAOS',                      label: 'Secagem de Grãos',                      channels: ['agricultural'],                                order: 250 },
  SERVICOS_VETERINARIOS:              { id: 'SERVICOS_VETERINARIOS',              label: 'Serviços Veterinários',                 channels: ['agricultural', 'technical', 'urban'],          order: 260 },
  TERRAPLENAGEM:                      { id: 'TERRAPLENAGEM',                      label: 'Terraplenagem',                         channels: ['agricultural', 'urban'],                       order: 270 },
  TOPOGRAFIA_RURAL:                   { id: 'TOPOGRAFIA_RURAL',                   label: 'Topografia',                            channels: ['agricultural', 'technical', 'urban'],          order: 280 },
  TORNEARIA_SOLDA_REPAROS:            { id: 'TORNEARIA_SOLDA_REPAROS',            label: 'Tornearia e Solda',                     channels: ['agricultural', 'technical', 'urban'],          order: 290 },
  OUTROS:                             { id: 'OUTROS',                             label: 'Outros',                                channels: ['agricultural', 'technical', 'urban', 'logistics'], order: 999, isOther: true },
};

/** Canonicalize ID (strip _TECH/_URB/_LOG/_FREIGHT suffixes) then look up dim */
export function resolveServiceDim(rawId: string): ServiceDim | undefined {
  if (!rawId) return undefined;
  const upper = rawId.toUpperCase().trim();
  if (SERVICE_DIM[upper]) return SERVICE_DIM[upper];
  const canonical = upper.replace(/_(TECH|URB|LOG|FREIGHT)$/, '');
  return SERVICE_DIM[canonical];
}

/** Get label for a service ID */
export function getServiceLabel(rawId: string): string {
  const dim = resolveServiceDim(rawId);
  if (dim) return dim.label;
  return rawId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/** Get channels for a service ID */
export function getServiceChannels(rawId: string): ServiceChannel[] {
  return resolveServiceDim(rawId)?.channels || [];
}

/** Get order for a service ID */
export function getServiceOrder(rawId: string): number {
  return resolveServiceDim(rawId)?.order || 500;
}
