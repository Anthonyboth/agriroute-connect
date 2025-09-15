import React from 'react';
import { BackButton } from '@/components/BackButton';
import { FunctionalityTester } from '@/components/FunctionalityTester';
import { SystemHealthCheck } from '@/components/SystemHealthCheck';

const SystemTest = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <BackButton />
        </div>
        
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-foreground mb-4">
            Verificação do Sistema AgriRoute
          </h1>
          <p className="text-muted-foreground">
            Esta página executa testes automáticos para verificar se todas as funcionalidades estão operacionais.
          </p>
        </div>

        <div className="mb-8">
          <SystemHealthCheck />
        </div>

        <FunctionalityTester />
        
        <div className="mt-8 p-6 bg-muted/30 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Funcionalidades Verificadas</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div className="space-y-2">
              <h3 className="font-medium">Navegação</h3>
              <ul className="text-muted-foreground space-y-1">
                <li>• Botões de navegação</li>
                <li>• Links do menu</li>
                <li>• Rotas da aplicação</li>
                <li>• Modal de contato</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium">Serviços</h3>
              <ul className="text-muted-foreground space-y-1">
                <li>• Modal de guincho</li>
                <li>• Modal de mudança</li>
                <li>• Modal de serviços</li>
                <li>• Localização GPS</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium">Backend</h3>
              <ul className="text-muted-foreground space-y-1">
                <li>• Conexão Supabase</li>
                <li>• Autenticação</li>
                <li>• Estatísticas reais</li>
                <li>• Base de dados</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemTest;