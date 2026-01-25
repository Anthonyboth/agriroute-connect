import { supabase } from '@/integrations/supabase/client';

/**
 * Busca contagem de checkins para múltiplos fretes em uma única query
 * Evita o padrão N+1 de fazer uma query por frete
 */
export async function fetchBatchCheckins(
  freightIds: string[],
  userId: string
): Promise<Record<string, number>> {
  if (!freightIds.length || !userId) {
    return {};
  }

  try {
    // Query única para todos os fretes usando .in()
    const { data, error } = await supabase
      .from('driver_checkins')
      .select('freight_id')
      .in('freight_id', freightIds)
      .eq('driver_profile_id', userId);

    if (error) {
      console.error('Error fetching batch checkins:', error);
      return {};
    }

    // Contar checkins por freight_id
    const checkinCounts: Record<string, number> = {};
    
    // Inicializar todos com 0
    freightIds.forEach(id => {
      checkinCounts[id] = 0;
    });
    
    // Contar os existentes
    data?.forEach(checkin => {
      if (checkin.freight_id) {
        checkinCounts[checkin.freight_id] = (checkinCounts[checkin.freight_id] || 0) + 1;
      }
    });

    return checkinCounts;
  } catch (error) {
    console.error('Error in fetchBatchCheckins:', error);
    return {};
  }
}

/**
 * Busca dados de múltiplos profiles em uma única query
 * Evita o padrão N+1 de fazer uma query por profile
 */
export async function fetchBatchProfiles(
  profileIds: string[]
): Promise<Record<string, any>> {
  if (!profileIds.length) {
    return {};
  }

  // Remover duplicatas
  const uniqueIds = [...new Set(profileIds)];

  try {
    // Usar view segura para mascarar PII de outros usuários
    const { data, error } = await (supabase as any)
      .from('profiles_secure')
      .select('id, full_name, phone, rating')
      .in('id', uniqueIds);

    if (error) {
      console.error('Error fetching batch profiles:', error);
      return {};
    }

    // Indexar por id
    const profilesMap: Record<string, any> = {};
    data?.forEach(profile => {
      profilesMap[profile.id] = profile;
    });

    return profilesMap;
  } catch (error) {
    console.error('Error in fetchBatchProfiles:', error);
    return {};
  }
}

/**
 * Busca assignments de múltiplos fretes em uma única query
 */
export async function fetchBatchAssignments(
  freightIds: string[]
): Promise<Record<string, any[]>> {
  if (!freightIds.length) {
    return {};
  }

  try {
    const { data, error } = await supabase
      .from('freight_assignments')
      .select(`
        id,
        freight_id,
        driver_id,
        agreed_price,
        status,
        pickup_date,
        delivery_date
      `)
      .in('freight_id', freightIds)
      .neq('status', 'CANCELLED');

    if (error) {
      console.error('Error fetching batch assignments:', error);
      return {};
    }

    // Agrupar por freight_id
    const assignmentsMap: Record<string, any[]> = {};
    
    freightIds.forEach(id => {
      assignmentsMap[id] = [];
    });
    
    data?.forEach(assignment => {
      if (assignment.freight_id) {
        if (!assignmentsMap[assignment.freight_id]) {
          assignmentsMap[assignment.freight_id] = [];
        }
        assignmentsMap[assignment.freight_id].push(assignment);
      }
    });

    return assignmentsMap;
  } catch (error) {
    console.error('Error in fetchBatchAssignments:', error);
    return {};
  }
}
