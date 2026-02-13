import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { FileText, Shield, X } from 'lucide-react';

type DocumentType = 'terms' | 'privacy';

interface LegalDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentType: DocumentType;
}

const termsContent = [
  {
    title: 'Aceitação dos Termos',
    items: [
      'Ao se cadastrar e utilizar a plataforma AgriRoute, você declara ter lido, compreendido e aceito integralmente estes Termos de Uso.',
      'Se você não concordar com qualquer parte destes termos, não deve utilizar nossos serviços.',
      'Estes termos constituem um acordo legal entre você e a AgriRoute.',
      'A utilização continuada da plataforma implica na aceitação de eventuais alterações nos termos.',
    ],
  },
  {
    title: 'Definições e Serviços',
    items: [
      'A AgriRoute é uma plataforma digital que conecta produtores rurais e transportadores.',
      'Produtores: pessoas físicas ou jurídicas que necessitam transportar produtos agrícolas.',
      'Motoristas: pessoas físicas ou jurídicas especializadas no transporte de cargas agrícolas.',
      'Frete: serviço de transporte de cargas acordado entre produtor e motorista através da plataforma.',
      'A AgriRoute atua como intermediadora, facilitando a conexão entre as partes.',
    ],
  },
  {
    title: 'Responsabilidades dos Usuários',
    items: [
      'Fornecer informações verdadeiras, atuais e completas durante o cadastro.',
      'Manter a confidencialidade de suas credenciais de acesso.',
      'Cumprir todas as leis e regulamentos aplicáveis ao transporte de cargas.',
      'Respeitar os acordos firmados através da plataforma.',
      'Não utilizar a plataforma para atividades ilegais ou fraudulentas.',
      'Comunicar imediatamente qualquer uso não autorizado de sua conta.',
    ],
  },
  {
    title: 'Limitações e Isenções',
    items: [
      'A AgriRoute não é responsável por danos ou perdas decorrentes do transporte das cargas.',
      'Não garantimos a disponibilidade ininterrupta da plataforma.',
      'Não nos responsabilizamos por disputas entre produtores e motoristas.',
      'A plataforma é fornecida "como está", sem garantias expressas ou implícitas.',
      'Nossa responsabilidade é limitada ao valor das taxas pagas pelos serviços.',
      'Recomendamos a contratação de seguros apropriados para as cargas.',
    ],
  },
  {
    title: 'Atividades Proibidas',
    items: [
      'Criar múltiplas contas com dados falsos.',
      'Utilizar a plataforma para atividades ilegais.',
      'Publicar conteúdo ofensivo ou inadequado.',
      'Tentar hackear ou interferir no funcionamento da plataforma.',
      'Reproduzir, distribuir ou modificar o conteúdo da plataforma.',
      'Utilizar bots ou scripts automatizados sem autorização.',
      'Assediar ou ameaçar outros usuários.',
      'Violar direitos de propriedade intelectual.',
    ],
  },
  {
    title: 'Pagamentos e Taxas',
    items: [
      'Taxa de Serviço: A AgriRoute cobra uma taxa de intermediação de 3% sobre o valor do frete.',
      'Processamento de Pagamentos: Os pagamentos são processados através de parceiros seguros e podem estar sujeitos a taxas adicionais.',
      'Política de Reembolso: Reembolsos são analisados caso a caso.',
      'Impostos: Todos os valores são acrescidos de impostos conforme legislação vigente.',
    ],
  },
  {
    title: 'Disposições Legais',
    items: [
      'Lei Aplicável: Estes termos são regidos pela legislação brasileira, especialmente pelo Código de Defesa do Consumidor e Marco Civil da Internet.',
      'Foro: Fica eleito o foro da comarca de São Paulo, SP, para dirimir quaisquer controvérsias.',
      'Alterações: A AgriRoute se reserva o direito de modificar estes termos a qualquer momento, notificando os usuários.',
      'Vigência: Estes termos permanecem em vigor enquanto você utilizar a plataforma AgriRoute.',
    ],
  },
];

const privacyContent = [
  {
    title: '1. Quem Somos',
    items: [
      'A AgriRoute Connect é uma plataforma digital de logística agrícola que conecta produtores rurais e motoristas de caminhão para transporte de cargas.',
      'Operamos como intermediários tecnológicos, fornecendo ferramentas para negociação, rastreamento GPS e gestão de fretes.',
      'Respeitamos sua privacidade e tratamos seus dados com responsabilidade, conforme a legislação brasileira.',
    ],
  },
  {
    title: '2. Quais Dados Coletamos',
    items: [
      'Nome completo, CPF/CNPJ, e-mail, telefone e endereço para identificação e contato.',
      'Documentos: CNH, RNTRC, comprovante de propriedade do veículo (motoristas).',
      'Coordenadas GPS durante o transporte (apenas com consentimento explícito).',
      'Histórico de fretes, avaliações e mensagens trocadas no chat.',
      'Endereço IP, tipo de navegador e cookies essenciais.',
    ],
  },
  {
    title: '3. Como Utilizamos Seus Dados',
    items: [
      'Criar e gerenciar sua conta na plataforma AgriRoute.',
      'Conectar produtores e motoristas de forma inteligente (matching).',
      'Processar pagamentos e transferências via Stripe/PIX.',
      'Emitir documentos fiscais obrigatórios (MDF-e, CT-e).',
      'Rastrear cargas em tempo real durante o transporte.',
      'Prevenir fraudes e garantir a segurança da plataforma.',
    ],
  },
  {
    title: '4. Segurança e Proteção dos Dados',
    items: [
      'Criptografia TLS/SSL em todas as comunicações.',
      'Senhas armazenadas com hash bcrypt (nunca em texto plano).',
      'Row Level Security (RLS) no banco de dados garantindo isolamento de dados.',
      'Backups automáticos diários com retenção de 30 dias.',
      'Monitoramento 24/7 para detectar e prevenir acessos não autorizados.',
    ],
  },
  {
    title: '5. Compartilhamento de Dados',
    items: [
      'Nunca vendemos seus dados pessoais para terceiros.',
      'Compartilhamos informações necessárias entre produtores e motoristas apenas para viabilizar o frete.',
      'Processadores de pagamento (Stripe) recebem dados financeiros necessários para transações.',
      'Autoridades competentes quando exigido por lei ou ordem judicial.',
    ],
  },
  {
    title: '6. Seus Direitos (LGPD)',
    items: [
      'Acesso: Solicitar cópia de todos os seus dados pessoais armazenados.',
      'Retificação: Corrigir dados incorretos, incompletos ou desatualizados.',
      'Exclusão: Solicitar a exclusão dos seus dados (direito ao esquecimento).',
      'Portabilidade: Receber seus dados em formato estruturado e legível.',
      'Oposição: Se opor ao processamento dos seus dados para fins específicos.',
      'Revogação: Retirar o consentimento dado anteriormente a qualquer momento.',
    ],
  },
  {
    title: '7. Contato',
    items: [
      'Responsável: Equipe AgriRoute Connect',
      'Email: agrirouteconnect@gmail.com',
      'WhatsApp: +55 15 66 9 9942-6656',
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
      <DialogContent className="max-w-lg max-h-[85vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="px-6 pb-6 max-h-[65vh]">
          <div className="space-y-6 pr-4">
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
        </ScrollArea>
        <div className="px-6 pb-4 border-t pt-3">
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
