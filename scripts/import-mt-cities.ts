/**
 * Script para importar todas as 141 cidades do Mato Grosso
 * 
 * Como usar:
 * 1. Certifique-se de que as variáveis de ambiente estão configuradas
 * 2. Execute: npx tsx scripts/import-mt-cities.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://shnvtxejjecbnztdbbbl.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY não encontrada nas variáveis de ambiente');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function importMTCities() {
  console.log('🚀 Iniciando importação de cidades do Mato Grosso...\n');
  
  try {
    // Chamar a edge function de importação
    const { data, error } = await supabase.functions.invoke('import-cities', {
      body: { state: 'MT' }
    });
    
    if (error) {
      throw error;
    }
    
    console.log('\n✨ Importação concluída com sucesso!');
    console.log(`📊 Total de cidades no IBGE: ${data.total}`);
    console.log(`✅ Cidades importadas: ${data.imported}`);
    console.log(`❌ Erros: ${data.errors}`);
    console.log(`🏛️ Estado: ${data.state}`);
    
    // Verificar total de cidades do MT na base
    const { count, error: countError } = await supabase
      .from('cities')
      .select('*', { count: 'exact', head: true })
      .eq('state', 'MT');
    
    if (!countError && count) {
      console.log(`\n📍 Total de cidades do MT na base de dados: ${count}`);
    }
    
  } catch (error) {
    console.error('\n❌ Erro ao importar cidades:', error);
    process.exit(1);
  }
}

// Estados disponíveis para importação
const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

async function importAllStates() {
  console.log('🚀 Iniciando importação de TODAS as cidades do Brasil...\n');
  
  let totalImported = 0;
  let totalErrors = 0;
  
  for (const state of BRAZILIAN_STATES) {
    try {
      console.log(`\n📍 Importando ${state}...`);
      
      const { data, error } = await supabase.functions.invoke('import-cities', {
        body: { state }
      });
      
      if (error) {
        console.error(`❌ Erro em ${state}:`, error);
        totalErrors += 1;
        continue;
      }
      
      console.log(`✅ ${state}: ${data.imported} cidades importadas`);
      totalImported += data.imported;
      
      // Pequeno delay para não sobrecarregar
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`❌ Erro ao importar ${state}:`, error);
      totalErrors += 1;
    }
  }
  
  console.log('\n✨ Importação completa!');
  console.log(`📊 Total importado: ${totalImported} cidades`);
  console.log(`❌ Estados com erro: ${totalErrors}`);
}

// Verificar argumento da linha de comando
const args = process.argv.slice(2);

if (args.includes('--all')) {
  importAllStates();
} else {
  importMTCities();
}
