import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ExternalLink, Info, Key, Globe, FileText, Printer } from 'lucide-react';

const SEFAZ_PORTAL_URL = 'https://www.sefaz.mt.gov.br/acesso/pages/login/login.xhtml';
const SEFAZ_SENHA_URL = 'https://www5.sefaz.mt.gov.br/servicos?c=6346394&e=6398811';

export const NfaPortalInstructions: React.FC = () => {
  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Emitir NFA-e no Portal SEFAZ-MT
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Alerta importante */}
          <Alert className="border-primary/30 bg-primary/5">
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Login = sua Inscrição Estadual (IE)</strong>, não o CNPJ!
              <br />
              <span className="text-sm text-muted-foreground">
                A senha é a senha de contribuinte criada no portal SEFAZ.
              </span>
            </AlertDescription>
          </Alert>

          {/* Passo a passo */}
          <ol className="space-y-4">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">1</span>
              <div>
                <p className="font-medium">Acesse o portal SEFAZ-MT</p>
                <p className="text-sm text-muted-foreground">
                  Faça login com sua <strong>IE</strong> e <strong>senha de contribuinte</strong>.
                </p>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">2</span>
              <div>
                <p className="font-medium">Navegue até "NFA-e → Emissão de NFA-e"</p>
                <p className="text-sm text-muted-foreground">
                  No menu do sistema fazendário, localize a opção de Nota Fiscal Avulsa.
                </p>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">3</span>
              <div>
                <p className="font-medium">Preencha os dados da nota</p>
                <p className="text-sm text-muted-foreground">
                  Use os dados que você copiou na etapa anterior (destinatário, descrição, valor).
                </p>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">4</span>
              <div>
                <p className="font-medium flex items-center gap-1">
                  <Printer className="h-4 w-4" />
                  Transmita e imprima o DANFA-e
                </p>
                <p className="text-sm text-muted-foreground">
                  Após transmitir, anote a <strong>chave de acesso</strong> (44 dígitos) e salve o PDF do DANFA-e.
                </p>
              </div>
            </li>
          </ol>

          {/* Botão de acesso */}
          <Button
            size="lg"
            className="w-full"
            onClick={() => window.open(SEFAZ_PORTAL_URL, '_blank')}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Abrir Portal SEFAZ-MT
          </Button>

          {/* Links auxiliares */}
          <div className="flex flex-col gap-2 pt-2 border-t">
            <p className="text-xs font-medium text-muted-foreground">Precisa de ajuda?</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(SEFAZ_SENHA_URL, '_blank')}
            >
              <Key className="h-3 w-3 mr-1" />
              Solicitar/Liberar Senha de Contribuinte
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open('https://www5.sefaz.mt.gov.br/portal-de-atendimento-ao-contribuinte', '_blank')}
            >
              <FileText className="h-3 w-3 mr-1" />
              Portal de Atendimento (e-PAC)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
