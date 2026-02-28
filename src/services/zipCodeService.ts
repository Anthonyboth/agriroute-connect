import { supabase } from '@/integrations/supabase/client';

export interface ZipCodeResult {
  zipCode: string;
  city: string;
  state: string;
  neighborhood?: string;
  street?: string;
  cityId?: string;
  lat?: number;
  lng?: number;
  source: 'cache' | 'viacep' | 'brasilapi';
}

interface CacheEntry extends ZipCodeResult {
  expiresAt: string;
}

const CACHE_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias
const CACHE_KEY_PREFIX = 'zipcode_';

export class ZipCodeService {
  /**
   * Busca CEP com cache local + cache Supabase + APIs externas
   */
  static async searchZipCode(zipCode: string): Promise<ZipCodeResult | null> {
    const normalizedZip = this.normalizeZipCode(zipCode);
    
    if (!this.validateZipFormat(normalizedZip)) {
      return null;
    }

    // 1. Buscar no cache local
    const cachedResult = await this.getFromLocalCache(normalizedZip);
    if (cachedResult) {
      if (import.meta.env.DEV) console.log('✅ CEP encontrado no cache local:', normalizedZip);
      return cachedResult;
    }

    // 2. Buscar no cache Supabase
    const supabaseCached = await this.getFromSupabaseCache(normalizedZip);
    if (supabaseCached) {
      if (import.meta.env.DEV) console.log('✅ CEP encontrado no cache Supabase:', normalizedZip);
      await this.saveToLocalCache(supabaseCached);
      return supabaseCached;
    }

    // 3. Buscar nas APIs externas
    const apiResult = await this.fetchFromAPIs(normalizedZip);
    if (apiResult) {
      // Salvar em ambos os caches
      await this.saveToLocalCache(apiResult);
      await this.saveToSupabaseCache(apiResult);
      
      // Tentar associar city_id
      if (!apiResult.cityId) {
        apiResult.cityId = await this.findCityId(apiResult.city, apiResult.state);
      }
      
      return apiResult;
    }

    return null;
  }

  /**
   * Busca nas APIs externas (ViaCEP + BrasilAPI)
   */
  private static async fetchFromAPIs(zipCode: string): Promise<ZipCodeResult | null> {
    // Tentar ViaCEP primeiro
    try {
      const viaCepResult = await this.fetchViaCEP(zipCode);
      if (viaCepResult) return viaCepResult;
    } catch (error) {
      console.warn('ViaCEP falhou, tentando BrasilAPI:', error);
    }

    // Fallback para BrasilAPI
    try {
      const brasilApiResult = await this.fetchBrasilAPI(zipCode);
      if (brasilApiResult) return brasilApiResult;
    } catch (error) {
      console.error('BrasilAPI também falhou:', error);
    }

    return null;
  }

  /**
   * ViaCEP API
   */
  private static async fetchViaCEP(zipCode: string): Promise<ZipCodeResult | null> {
    const response = await fetch(`https://viacep.com.br/ws/${zipCode}/json/`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) throw new Error(`ViaCEP HTTP ${response.status}`);

    const data = await response.json();
    
    if (data.erro) return null;

    return {
      zipCode: data.cep.replace('-', ''),
      city: data.localidade,
      state: data.uf,
      neighborhood: data.bairro || undefined,
      street: data.logradouro || undefined,
      source: 'viacep'
    };
  }

  /**
   * BrasilAPI (fallback)
   */
  private static async fetchBrasilAPI(zipCode: string): Promise<ZipCodeResult | null> {
    const response = await fetch(`https://brasilapi.com.br/api/cep/v1/${zipCode}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) throw new Error(`BrasilAPI HTTP ${response.status}`);

    const data = await response.json();

    return {
      zipCode: data.cep.replace('-', ''),
      city: data.city,
      state: data.state,
      neighborhood: data.neighborhood || undefined,
      street: data.street || undefined,
      source: 'brasilapi'
    };
  }

  /**
   * Cache local (localStorage)
   */
  private static async getFromLocalCache(zipCode: string): Promise<ZipCodeResult | null> {
    try {
      const key = `${CACHE_KEY_PREFIX}${zipCode}`;
      const cached = localStorage.getItem(key);
      
      if (!cached) return null;
      
      const entry: CacheEntry = JSON.parse(cached);
      
      // Verificar expiração
      if (new Date(entry.expiresAt) < new Date()) {
        localStorage.removeItem(key);
        return null;
      }
      
      return entry;
    } catch {
      return null;
    }
  }

  private static async saveToLocalCache(result: ZipCodeResult): Promise<void> {
    try {
      const key = `${CACHE_KEY_PREFIX}${result.zipCode}`;
      const entry: CacheEntry = {
        ...result,
        expiresAt: new Date(Date.now() + CACHE_DURATION_MS).toISOString()
      };
      localStorage.setItem(key, JSON.stringify(entry));
    } catch (error) {
      console.warn('Falha ao salvar no cache local:', error);
    }
  }

  /**
   * Cache Supabase
   */
  private static async getFromSupabaseCache(zipCode: string): Promise<ZipCodeResult | null> {
    try {
      const { data, error } = await supabase.rpc('search_city_by_zip' as any, {
        p_zip_code: zipCode
      } as any) as any;

      if (error || !data || !Array.isArray(data) || data.length === 0) return null;

      const row = data[0] as any;
      return {
        zipCode,
        city: row.city_name,
        state: row.state,
        neighborhood: row.neighborhood,
        street: row.street,
        cityId: row.city_id,
        lat: row.lat,
        lng: row.lng,
        source: 'cache'
      };
    } catch {
      return null;
    }
  }

  private static async saveToSupabaseCache(result: ZipCodeResult): Promise<void> {
    try {
      await supabase.rpc('save_zip_to_cache' as any, {
        p_zip_code: result.zipCode,
        p_city_name: result.city,
        p_state: result.state,
        p_neighborhood: result.neighborhood,
        p_street: result.street,
        p_city_id: result.cityId,
        p_lat: result.lat,
        p_lng: result.lng,
        p_source: result.source
      } as any);
    } catch (error) {
      console.warn('Falha ao salvar no cache Supabase:', error);
    }
  }

  /**
   * Utilitários
   */
  static normalizeZipCode(zip: string): string {
    return zip.replace(/\D/g, '');
  }

  static validateZipFormat(zip: string): boolean {
    return /^\d{8}$/.test(zip);
  }

  static formatZipCode(zip: string): string {
    const clean = this.normalizeZipCode(zip);
    if (clean.length !== 8) return zip;
    return `${clean.slice(0, 5)}-${clean.slice(5)}`;
  }

  /**
   * Buscar city_id no banco
   */
  private static async findCityId(cityName: string, state: string): Promise<string | undefined> {
    try {
      const { data } = await supabase
        .from('cities')
        .select('id')
        .ilike('name', cityName)
        .eq('state', state.toUpperCase().trim())
        .limit(1)
        .maybeSingle();
      
      return data?.id;
    } catch {
      return undefined;
    }
  }

  /**
   * Sincronização automática ao reconectar
   */
  static async syncOnReconnect(): Promise<void> {
    if (import.meta.env.DEV) console.log('🔄 Sincronizando cache de CEPs...');
    
    const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_KEY_PREFIX));
    
    for (const key of keys) {
      try {
        const cached = localStorage.getItem(key);
        if (!cached) continue;
        
        const entry: CacheEntry = JSON.parse(cached);
        const daysSinceExpiry = (Date.now() - new Date(entry.expiresAt).getTime()) / (24 * 60 * 60 * 1000);
        
        if (daysSinceExpiry > 0) {
          const fresh = await this.searchZipCode(entry.zipCode);
          if (fresh) {
            if (import.meta.env.DEV) console.log(`✅ CEP ${entry.zipCode} atualizado`);
          }
        }
      } catch (error) {
        console.warn(`Erro ao sincronizar ${key}:`, error);
      }
    }
    
    if (import.meta.env.DEV) console.log('✅ Sincronização concluída');
  }

  /**
   * Autocompletar CEPs (sugestões)
   */
  static async autocompleteZipCode(partial: string): Promise<ZipCodeResult[]> {
    const normalized = this.normalizeZipCode(partial);
    
    if (normalized.length < 3) return [];

    const localMatches: ZipCodeResult[] = [];
    const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_KEY_PREFIX));
    
    for (const key of keys) {
      try {
        const cached = localStorage.getItem(key);
        if (!cached) continue;
        
        const entry: CacheEntry = JSON.parse(cached);
        
        if (entry.zipCode.startsWith(normalized) && new Date(entry.expiresAt) > new Date()) {
          localMatches.push(entry);
        }
      } catch {}
    }

    return localMatches.slice(0, 10); // Limitar a 10 sugestões
  }
}
