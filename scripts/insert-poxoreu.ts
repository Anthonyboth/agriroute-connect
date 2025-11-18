/**
 * Script para inserir a cidade de Poxoréu - MT
 * Como usar:
 * 1. Configure as variáveis de ambiente: VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
 * 2. Execute: npx tsx scripts/insert-poxoreu.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://shnvtxejjecbnztdbbbl.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY não encontrada nas variáveis de ambiente');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function run() {
  try {
    const name = 'Poxoréu';
    const state = 'MT';

    // Verificar se já existe
    const { data: existing, error: checkError } = await supabase
      .from('cities')
      .select('id, name, state')
      .eq('name', name)
      .eq('state', state)
      .maybeSingle();

    if (checkError && (checkError as any).code !== 'PGRST116') {
      throw checkError;
    }

    if (existing) {
      console.log('✅ Cidade já existe na base:', existing);
      return;
    }

    const { data, error } = await supabase
      .from('cities')
      .insert({
        name,
        state,
        lat: -15.8294,
        lng: -54.3889,
      })
      .select()
      .single();

    if (error) throw error;
    console.log('✨ Cidade inserida com sucesso:', data);
  } catch (e) {
    console.error('❌ Erro ao inserir Poxoréu-MT:', e);
    process.exit(1);
  }
}

run();
