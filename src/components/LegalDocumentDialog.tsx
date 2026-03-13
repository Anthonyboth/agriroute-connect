import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileText, Shield } from 'lucide-react';

type DocumentType = 'terms' | 'privacy';

interface LegalDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentType: DocumentType;
}

const termsContent = [
  {
    title: '1. Aceitação dos Termos',
    items: [
      'Ao se cadastrar e utilizar a plataforma AgriRoute, você declara ter lido, compreendido e aceito integralmente estes Termos de Uso, que constituem um acordo legal vinculante entre você e a AgriRoute.',
      'Se você não concordar com qualquer parte destes termos, não deve utilizar nossos serviços.',
      'A AgriRoute poderá atualizar estes Termos periodicamente, notificando os usuários por meio da plataforma ou e-mail. A utilização continuada após a notificação implica aceitação das alterações.',
    ],
  },
  {
    title: '2. Definições e Serviços',
    items: [
      'AgriRoute: plataforma digital de intermediação tecnológica para logística agrícola.',
      'Produtor: pessoa física ou jurídica que necessita transportar produtos agrícolas.',
      'Motorista/Transportador: pessoa física ou jurídica que realiza o transporte de cargas agrícolas.',
      'Frete: serviço de transporte de cargas acordado entre produtor e motorista por meio da plataforma.',
      'A AgriRoute atua exclusivamente como intermediadora tecnológica, conectando produtores e transportadores para a contratação de serviços de transporte de cargas. A AgriRoute não é parte direta no contrato de transporte firmado entre as partes.',
    ],
  },
  {
    title: '3. Formalização e Vinculação Contratual',
    items: [
      'Uma vez aceito um frete ou serviço dentro da plataforma AgriRoute, considera-se formado um acordo contratual válido entre as partes, obrigando ambas ao cumprimento integral das condições acordadas.',
      'Sempre que um frete ou serviço tiver sido iniciado, negociado ou aceito através da plataforma AgriRoute, considera-se que a contratação teve origem na plataforma.',
      'A realização de acordos complementares ou ajustes realizados fora do sistema não descaracteriza a origem da contratação nem afasta a aplicação destes Termos de Uso.',
      'Mesmo que as partes optem por concluir o pagamento ou parte da negociação por meios externos, o acordo continuará sendo considerado vinculado à plataforma AgriRoute, permanecendo sujeito às obrigações aqui estabelecidas.',
      'A AgriRoute mantém registros eletrônicos das operações, incluindo histórico de propostas, aceitações, comunicações, dados de acesso, geolocalização (quando autorizada) e demais metadados, os quais possuem validade jurídica como meio de prova, nos termos do Marco Civil da Internet (Lei nº 12.965/2014).',
    ],
  },
  {
    title: '4. Responsabilidades dos Usuários',
    items: [
      'Fornecer informações verdadeiras, atuais e completas durante o cadastro e mantê-las atualizadas.',
      'Manter a confidencialidade de suas credenciais de acesso e responder por todas as atividades realizadas em sua conta.',
      'Cumprir todas as leis e regulamentos aplicáveis ao transporte de cargas, incluindo documentação, seguros e regularidade da operação.',
      'Respeitar integralmente os acordos firmados através da plataforma.',
      'Utilizar a plataforma de forma ética, legal e de boa-fé.',
      'Comunicar imediatamente qualquer uso não autorizado de sua conta ou suspeita de fraude.',
    ],
  },
  {
    title: '5. Limitações de Responsabilidade, Monitoramento e Cooperação Jurídica',
    items: [
      'A AgriRoute atua como plataforma digital de intermediação, conectando produtores e transportadores para a contratação de serviços de transporte de cargas.',
      'Embora não seja parte direta no contrato de transporte entre produtor e motorista, a AgriRoute mantém mecanismos de monitoramento, registro e auditoria das atividades realizadas dentro da plataforma, com o objetivo de aumentar a segurança das transações.',
      'A plataforma registra informações relevantes para a operação, incluindo histórico de propostas, aceitações, comunicações, dados de acesso, registros técnicos de uso do sistema e, quando autorizado pelo usuário, dados de localização durante a execução do transporte.',
      'Tais registros poderão ser utilizados para investigação de irregularidades, resolução de disputas e eventual responsabilização judicial das partes envolvidas, nos termos da legislação brasileira.',
      'Caso sejam identificados indícios de fraude, golpe, inadimplência, tentativa de vantagem indevida ou qualquer outra conduta ilícita, a AgriRoute poderá: suspender ou bloquear a conta do usuário responsável; preservar registros digitais e evidências da operação; comunicar autoridades competentes; cooperar com investigações policiais ou judiciais; fornecer dados mediante ordem judicial; adotar medidas legais cabíveis para responsabilização do infrator.',
      'A AgriRoute poderá auxiliar a parte prejudicada na preservação e apresentação de provas, incluindo registros da plataforma e informações técnicas que possam contribuir para a apuração dos fatos.',
      'Apesar das medidas de monitoramento e segurança adotadas, a AgriRoute não substitui as obrigações legais das partes envolvidas no transporte, sendo responsabilidade do produtor e do motorista cumprir a legislação aplicável.',
      'A plataforma não garante disponibilidade contínua e ininterrupta do sistema, podendo ocorrer interrupções por manutenção, atualizações, falhas técnicas ou fatores externos.',
      'Recomenda-se que os usuários adotem medidas adicionais de proteção, incluindo contratação de seguros adequados para as cargas transportadas, quando aplicável.',
    ],
  },
  {
    title: '6. Inadimplência e Execução de Obrigações',
    items: [
      'O não pagamento do valor acordado após a execução do serviço, bem como qualquer tentativa de obter vantagem indevida, caracterizará inadimplemento contratual.',
      'Em caso de inadimplemento, a parte infratora ficará sujeita às seguintes penalidades: pagamento integral do valor devido pelo serviço contratado; multa contratual de 20% sobre o valor total da operação; correção monetária e juros legais; indenização por eventuais danos materiais e morais causados à parte prejudicada.',
      'A responsabilidade será apurada independentemente da exclusão ou desativação da conta do usuário infrator.',
      'A exclusão ou bloqueio da conta não elimina responsabilidades contratuais ou obrigações financeiras existentes.',
    ],
  },
  {
    title: '7. Suspensão, Bloqueio e Encerramento de Conta',
    items: [
      'A AgriRoute poderá, a seu exclusivo critério e sem necessidade de aviso prévio, suspender, restringir ou encerrar definitivamente contas de usuários que violem estes Termos de Uso, pratiquem atividades ilícitas ou apresentem comportamento incompatível com a integridade da plataforma.',
      'Condutas que podem resultar em bloqueio permanente incluem: fraude ou tentativa de golpe; inadimplência intencional; fornecimento de informações falsas; uso da plataforma para atividades ilegais; tentativa de contornar sistemas de segurança; comportamento abusivo ou ameaças contra outros usuários.',
      'Em casos graves, a AgriRoute poderá impedir definitivamente o acesso do usuário à plataforma, inclusive bloqueando novos cadastros associados ao mesmo CPF, CNPJ, número de telefone, dispositivo utilizado, endereço IP e outros identificadores técnicos disponíveis.',
    ],
  },
  {
    title: '8. Verificação e Auditoria de Usuários',
    items: [
      'A AgriRoute poderá solicitar, a qualquer momento, documentos adicionais ou procedimentos de verificação de identidade para garantir a autenticidade das informações fornecidas pelos usuários.',
      'A plataforma poderá realizar verificações automatizadas ou manuais incluindo, quando aplicável: validação de CPF ou CNPJ; verificação de documentos pessoais ou empresariais; verificação de dados de veículos; análise de comportamento de uso da plataforma; verificação de dados técnicos de acesso.',
      'Caso sejam identificadas inconsistências, suspeita de fraude ou informações incorretas, a AgriRoute poderá suspender temporariamente a conta, restringir funcionalidades, solicitar documentação adicional ou cancelar definitivamente o cadastro.',
    ],
  },
  {
    title: '9. Sistema de Avaliação e Reputação',
    items: [
      'A AgriRoute mantém um sistema de reputação e avaliação entre usuários, permitindo que produtores e transportadores avaliem suas experiências após a conclusão de cada operação.',
      'O histórico de avaliações, desempenho e cumprimento de contratos poderá ser utilizado para: melhorar a segurança da plataforma; orientar decisões de contratação entre usuários; identificar comportamentos inadequados ou recorrentes; aplicar restrições operacionais quando necessário.',
      'A AgriRoute poderá considerar o histórico de comportamento do usuário para limitar funcionalidades, reduzir visibilidade ou suspender contas que apresentem risco ao ecossistema da plataforma.',
    ],
  },
  {
    title: '10. Responsabilidade por Uso Indevido',
    items: [
      'O usuário compromete-se a utilizar a plataforma AgriRoute de forma ética, legal e de boa-fé.',
      'Qualquer utilização da plataforma com finalidade fraudulenta, tentativa de obtenção de vantagem indevida, manipulação de negociações ou prática de golpes poderá resultar em: bloqueio permanente da conta; responsabilização civil pelos danos causados; comunicação às autoridades competentes; adoção das medidas judiciais cabíveis.',
    ],
  },
  {
    title: '11. Preservação de Provas Digitais',
    items: [
      'O usuário reconhece e concorda que os registros eletrônicos armazenados pela AgriRoute, incluindo histórico de negociações, mensagens, logs de acesso, endereços IP, geolocalização, registros de dispositivo e demais metadados, constituem meio de prova válido e admissível em processos judiciais ou administrativos, conforme o Marco Civil da Internet (Lei nº 12.965/2014).',
      'Havendo indícios de fraude ou inadimplemento, a plataforma poderá preservar dados pelo prazo legal aplicável e fornecê-los mediante ordem judicial ou às autoridades competentes.',
      'Conversas, comprovantes, registros de negociação e demais evidências mantidas pelas partes em seus dispositivos também poderão ser utilizadas como meios de prova em eventual procedimento judicial ou administrativo.',
    ],
  },
  {
    title: '12. Responsabilidade Penal',
    items: [
      'O usuário declara ciência de que fraudes eletrônicas, estelionato, apropriação indébita, falsidade ideológica, crimes contra a honra, dentre outros, constituem infrações penais previstas na legislação brasileira.',
      'A AgriRoute poderá colaborar integralmente com autoridades policiais e judiciais na apuração de eventual ilícito penal praticado por meio da plataforma.',
    ],
  },
  {
    title: '13. Atividades Proibidas',
    items: [
      'Criar múltiplas contas com dados falsos ou utilizar identidade de terceiros.',
      'Utilizar a plataforma para atividades ilegais ou que violem a legislação vigente.',
      'Publicar conteúdo ofensivo, discriminatório ou inadequado.',
      'Tentar hackear, interferir ou comprometer o funcionamento da plataforma.',
      'Reproduzir, distribuir ou modificar o conteúdo da plataforma sem autorização.',
      'Utilizar bots, scripts automatizados ou ferramentas de falsificação de dados.',
      'Assediar, intimidar ou ameaçar outros usuários.',
      'Violar direitos de propriedade intelectual da AgriRoute ou de terceiros.',
    ],
  },
  {
    title: '14. Pagamentos e Taxas',
    items: [
      'Taxa de Serviço: A AgriRoute cobra uma taxa de intermediação de 3% sobre o valor do frete.',
      'Processamento de Pagamentos: Os pagamentos são processados através de parceiros seguros (Stripe/PIX) e podem estar sujeitos a taxas adicionais do processador.',
      'Política de Reembolso: Reembolsos são analisados caso a caso, conforme as circunstâncias da operação.',
      'Impostos: Todos os valores são acrescidos de impostos conforme legislação vigente. É responsabilidade de cada parte cumprir suas obrigações tributárias.',
    ],
  },
  {
    title: '15. Disposições Gerais',
    items: [
      'Lei Aplicável: Estes termos são regidos pela legislação brasileira, especialmente o Código Civil, Código de Defesa do Consumidor, Marco Civil da Internet (Lei nº 12.965/2014) e a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).',
      'Foro: Fica eleito o foro da comarca de São Paulo, SP, para dirimir quaisquer controvérsias decorrentes destes Termos.',
      'Independência das Cláusulas: A nulidade ou invalidade de qualquer cláusula destes Termos não prejudicará a validade das demais.',
      'A tentativa de afastar a incidência destes Termos por meio de acordo externo entre as partes não produz efeitos jurídicos perante a AgriRoute.',
      'Vigência: Estes termos permanecem em vigor enquanto você utilizar a plataforma AgriRoute.',
      'Alterações: A AgriRoute se reserva o direito de modificar estes termos a qualquer momento, notificando os usuários com antecedência razoável.',
    ],
  },
];

const privacyContent = [
  {
    title: '1. Quem Somos',
    items: [
      'A AgriRoute é uma plataforma digital de intermediação tecnológica para logística agrícola, conectando produtores rurais e transportadores para a contratação de serviços de transporte de cargas.',
      'Operamos como intermediários tecnológicos, fornecendo ferramentas para negociação, acompanhamento de operações e gestão de fretes.',
      'Respeitamos sua privacidade e tratamos seus dados com responsabilidade, em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018) e demais legislações aplicáveis.',
    ],
  },
  {
    title: '2. Dados Coletados',
    items: [
      'Dados pessoais de identificação: nome completo, CPF/CNPJ, e-mail, telefone e endereço.',
      'Documentos profissionais (motoristas): CNH, RNTRC, comprovante de propriedade ou autorização de uso do veículo.',
      'Dados de localização GPS: coletados exclusivamente durante a execução de fretes ativos, mediante consentimento explícito do usuário.',
      'Dados de operação: histórico de fretes, avaliações, mensagens trocadas na plataforma e registros de negociações.',
      'Dados técnicos: endereço IP, tipo de navegador, sistema operacional, identificadores de dispositivo e cookies essenciais.',
    ],
  },
  {
    title: '3. Finalidades do Tratamento',
    items: [
      'Criar e gerenciar sua conta na plataforma AgriRoute.',
      'Conectar produtores e motoristas de forma inteligente (matching de fretes).',
      'Processar pagamentos e transferências financeiras.',
      'Emitir documentos fiscais obrigatórios (MDF-e, CT-e) quando aplicável.',
      'Acompanhar a execução de fretes mediante dados de localização autorizados pelo usuário.',
      'Prevenir fraudes, investigar irregularidades e garantir a segurança da plataforma.',
      'Realizar auditoria de operações e resolução de disputas entre usuários.',
      'Cooperar com autoridades competentes em investigações, quando exigido por lei ou ordem judicial.',
    ],
  },
  {
    title: '4. Base Legal para o Tratamento (LGPD, Art. 7)',
    items: [
      'Consentimento do titular (Art. 7, I): para coleta de dados de localização durante fretes e envio de comunicações.',
      'Execução de contrato (Art. 7, V): para prestação dos serviços contratados através da plataforma.',
      'Cumprimento de obrigação legal ou regulatória (Art. 7, II): para emissão de documentos fiscais e atendimento a requisições legais.',
      'Exercício regular de direitos (Art. 7, VI): para preservação de provas e defesa em processos judiciais ou administrativos.',
      'Legítimo interesse (Art. 7, IX): para prevenção de fraudes, segurança da plataforma e melhoria dos serviços.',
    ],
  },
  {
    title: '5. Rastreamento e Localização',
    items: [
      'A coleta de dados de localização GPS ocorre exclusivamente durante a execução de fretes ativos, nunca de forma contínua ou fora do contexto operacional.',
      'O rastreamento requer consentimento explícito do usuário antes do início de cada frete, por meio de termo específico apresentado na plataforma.',
      'A finalidade do rastreamento é garantir a segurança da carga e do motorista, fornecer informações ao embarcador e permitir assistência em caso de emergências.',
      'O usuário pode recusar o consentimento para rastreamento, ciente de que isso poderá impedir a execução do frete específico.',
      'Os dados de localização são armazenados com segurança e eliminados automaticamente após o período necessário para a finalidade contratual, conforme nossa política de retenção.',
      'O compartilhamento de dados de localização com terceiros ocorre apenas entre as partes do frete, ou mediante ordem judicial dirigida às autoridades competentes.',
    ],
  },
  {
    title: '6. Segurança e Proteção dos Dados',
    items: [
      'Criptografia TLS/SSL em todas as comunicações entre o aplicativo e nossos servidores.',
      'Senhas armazenadas com hash criptográfico seguro (bcrypt), nunca em texto plano.',
      'Row Level Security (RLS) no banco de dados, garantindo isolamento e controle de acesso por usuário.',
      'Backups automáticos com retenção controlada para recuperação de dados.',
      'Monitoramento contínuo para detectar e prevenir acessos não autorizados.',
      'Eliminação automática de dados sensíveis (coordenadas, endereços) de mensagens quando o frete atinge status terminal.',
    ],
  },
  {
    title: '7. Compartilhamento de Dados',
    items: [
      'A AgriRoute nunca vende seus dados pessoais para terceiros.',
      'Compartilhamos informações necessárias entre produtores e motoristas exclusivamente para viabilizar a execução do frete contratado.',
      'Processadores de pagamento (Stripe e parceiros) recebem apenas os dados financeiros estritamente necessários para processar transações.',
      'Autoridades competentes poderão receber dados quando exigido por lei, ordem judicial ou requisição legal válida, conforme previsto no Marco Civil da Internet.',
    ],
  },
  {
    title: '8. Retenção e Exclusão de Dados',
    items: [
      'Dados pessoais de conta são mantidos enquanto o cadastro estiver ativo na plataforma.',
      'Dados de localização de fretes são eliminados automaticamente após o encerramento da operação e cumprimento do prazo de retenção operacional.',
      'Registros de operações e transações financeiras são mantidos pelo prazo legal exigido pela legislação tributária e contábil.',
      'Dados sensíveis de mensagens (coordenadas, endereços) são eliminados automaticamente quando o frete atinge status terminal (entregue, concluído ou cancelado).',
      'Após solicitação de exclusão pelo titular, os dados serão removidos no prazo legal, ressalvadas as hipóteses de retenção obrigatória previstas em lei.',
    ],
  },
  {
    title: '9. Seus Direitos como Titular (LGPD)',
    items: [
      'Acesso: solicitar cópia de todos os seus dados pessoais armazenados pela plataforma.',
      'Retificação: corrigir dados incorretos, incompletos ou desatualizados.',
      'Exclusão: solicitar a eliminação dos seus dados pessoais (direito ao esquecimento), observadas as exceções legais.',
      'Portabilidade: receber seus dados em formato estruturado e legível por máquina.',
      'Oposição: se opor ao tratamento dos seus dados para finalidades específicas.',
      'Revogação: retirar o consentimento dado anteriormente a qualquer momento, sem prejuízo da legalidade do tratamento realizado até a revogação.',
      'Para exercer seus direitos, entre em contato conosco através dos canais indicados na seção "Contato" abaixo. Responderemos no prazo legal de até 15 dias.',
    ],
  },
  {
    title: '10. Cookies e Dados Técnicos',
    items: [
      'Utilizamos cookies essenciais para o funcionamento da plataforma, autenticação de sessão e preferências do usuário.',
      'Cookies de análise podem ser utilizados para melhorar a experiência do usuário, sempre de forma anonimizada.',
      'Você pode configurar seu navegador para recusar cookies, ciente de que isso pode afetar algumas funcionalidades da plataforma.',
    ],
  },
  {
    title: '11. Contato e Encarregado de Dados (DPO)',
    items: [
      'Responsável: Equipe AgriRoute Connect',
      'Email: agrirouteconnect@gmail.com',
      'WhatsApp: (66) 9 9273-4632',
      'Para questões relacionadas à proteção de dados pessoais, dúvidas sobre esta Política ou exercício de direitos previstos na LGPD, entre em contato pelos canais acima.',
    ],
  },
];

export const LegalDocumentDialog: React.FC<LegalDocumentDialogProps> = ({
  open,
  onOpenChange,
  documentType,
}) => {
  const isTerms = documentType === 'terms';
  const content = isTerms ? termsContent : privacyContent;
  const title = isTerms ? 'Termos de Uso' : 'Política de Privacidade';
  const Icon = isTerms ? FileText : Shield;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] p-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
        </DialogHeader>
        <div
          className="flex-1 min-h-0 px-6 pb-6 overflow-y-auto overscroll-contain"
          style={{ maxHeight: '65vh', WebkitOverflowScrolling: 'touch' }}
        >
          <div className="space-y-6 pr-1">
            {content.map((section) => (
              <div key={section.title}>
                <h3 className="font-semibold text-foreground mb-2">{section.title}</h3>
                <ul className="space-y-1.5">
                  {section.items.map((item, i) => (
                    <li key={i} className="text-sm text-muted-foreground leading-relaxed flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="px-6 pb-4 border-t pt-3 flex-shrink-0">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};