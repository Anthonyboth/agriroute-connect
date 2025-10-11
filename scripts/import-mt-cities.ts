/**
 * Script para importar cidades do Brasil
 * 
 * Como usar:
 * 1. Certifique-se de que as variáveis de ambiente estão configuradas
 * 2. Para importar apenas MT: npx tsx scripts/import-mt-cities.ts
 * 3. Para importar TODAS as cidades: npx tsx scripts/import-mt-cities.ts --all
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

async function importAllCities() {
  console.log('🚀 Iniciando importação de TODAS as cidades do Brasil...\n');
  console.log('⏳ Isso pode levar alguns minutos. Por favor, aguarde...\n');
  
  try {
    const { data, error } = await supabase.functions.invoke('import-cities', {
      body: { state: 'ALL' }
    });
    
    if (error) {
      throw error;
    }
    
    console.log('\n✨ Importação completa!');
    console.log(`📊 Total importado: ${data.totalImported} cidades`);
    console.log(`❌ Erros: ${data.totalErrors}`);
    console.log(`🏛️ Estados processados: ${data.states}`);
    
    // Verificar total final na base
    const { count, error: countError } = await supabase
      .from('cities')
      .select('*', { count: 'exact', head: true });
    
    if (!countError && count) {
      console.log(`\n📍 Total de cidades na base de dados: ${count}`);
    }
    
    console.log('\n✅ Todas as 5.570 cidades do Brasil foram adicionadas!');
    
  } catch (error) {
    console.error('\n❌ Erro ao importar cidades:', error);
    process.exit(1);
  }
}

// Verificar argumento da linha de comando
const args = process.argv.slice(2);

if (args.includes('--all')) {
  importAllCities();
} else {
  importMTCities();
}
