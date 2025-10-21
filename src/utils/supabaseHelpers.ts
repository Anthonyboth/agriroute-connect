import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Centraliza chamadas ao Supabase e exibe toasts amigáveis em caso de erro.
 * Motivo: evita uso direto do REST que pode gerar 406/400 no console e uniformiza tratamento.
 */

export async function safeSelect<T = any>(table: string, builder: (q: any) => Promise<{ data: T; error: any }>) {
  try {
    const q = (supabase as any).from(table);
    const { data, error } = await builder(q);
    if (error) {
      console.error(`Supabase select error on ${table}`, error);
      toast.error('Erro ao comunicar com o servidor');
      return { data: null, error };
    }
    return { data, error: null };
  } catch (err) {
    console.error('safeSelect exception', err);
    toast.error('Erro inesperado de comunicação');
    return { data: null, error: err as any };
  }
}

export async function safeRpc(fnName: string, params?: any) {
  try {
    const { data, error } = await (supabase.rpc as any)(fnName, params || {});
    if (error) {
      console.error(`Supabase rpc error: ${fnName}`, error);
      toast.error('Erro ao executar operação no servidor');
      return { data: null, error };
    }
    return { data, error: null };
  } catch (err) {
    console.error('safeRpc exception', err);
    toast.error('Erro inesperado no servidor');
    return { data: null, error: err as any };
  }
}

export async function safeUpsert(table: string, payload: any, opts?: any) {
  try {
    const { data, error } = await (supabase as any).from(table).upsert(payload, opts || {});
    if (error) {
      console.error(`Supabase upsert error on ${table}`, error);
      toast.error('Erro ao salvar dados');
      return { data: null, error };
    }
    return { data, error: null };
  } catch (err) {
    console.error('safeUpsert exception', err);
    toast.error('Erro inesperado ao salvar');
    return { data: null, error: err as any };
  }
}