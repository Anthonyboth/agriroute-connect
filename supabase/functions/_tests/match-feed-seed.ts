/**
 * Match Feed Integration Test - Deterministic Seed
 * 
 * Cities (real coordinates):
 *   city_A: Goiânia, GO (-16.6869, -49.2648)
 *   city_B: Anápolis, GO (-16.3281, -48.9535) — ~55km from Goiânia (within 300km)
 *   city_C: Uberlândia, MG (-18.9186, -48.2772) — ~340km from Goiânia (outside 300km)
 * 
 * HOW TO RUN:
 *   deno test --allow-all supabase/functions/_tests/match-feed.test.ts
 */

// deno-lint-ignore-file no-explicit-any

export const SEED = {
  city_a_name: 'Goiânia',
  city_a_state: 'GO',
  city_a_lat: -16.6869,
  city_a_lng: -49.2648,
  city_a_ibge: '5208707',

  city_b_name: 'Anápolis',
  city_b_state: 'GO',
  city_b_lat: -16.3281,
  city_b_lng: -48.9535,
  city_b_ibge: '5201108',

  city_c_name: 'Uberlândia',
  city_c_state: 'MG',
  city_c_lat: -18.9186,
  city_c_lng: -48.2772,
  city_c_ibge: '3170206',

  driver1_email: 'test-match-driver1@agriroute-test.local',
  driver2_email: 'test-match-driver2@agriroute-test.local',
  provider1_email: 'test-match-provider1@agriroute-test.local',
  company1_email: 'test-match-company1@agriroute-test.local',
  producer1_email: 'test-match-producer1@agriroute-test.local',

  password: 'TestMatch123!@#',
} as const;

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || Deno.env.get('VITE_SUPABASE_URL') || 'http://localhost:54321';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('VITE_SUPABASE_PUBLISHABLE_KEY') || '';

export function requireCredentials(): void {
  if (!SERVICE_KEY) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY not set. These integration tests require real Supabase credentials.\n' +
      'Set: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY'
    );
  }
}

export function getServiceClient(): any {
  return createClient(SUPABASE_URL, SERVICE_KEY);
}

export function getAnonClient(): any {
  return createClient(SUPABASE_URL, ANON_KEY);
}

export async function loginAs(email: string, password: string) {
  const client: any = getAnonClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Login failed for ${email}: ${error.message}`);
  return { client, user: data.user!, session: data.session! };
}

async function ensureCity(
  supabase: any,
  name: string, state: string, lat: number, lng: number, ibge: string
): Promise<string> {
  const { data: existing } = await supabase
    .from('cities')
    .select('id')
    .eq('ibge_code', ibge)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data, error } = await supabase
    .from('cities')
    .insert({ name, state, lat, lng, ibge_code: ibge })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to create city ${name}: ${error.message}`);
  return data.id;
}

async function ensureUser(
  supabase: any,
  email: string,
  password: string,
  role: string,
  serviceTypes: string[],
  fullName: string
): Promise<{ userId: string; profileId: string }> {
  const { data: signupData, error: signupErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  let userId: string;
  if (signupErr) {
    const { data: listData } = await supabase.auth.admin.listUsers();
    const found = listData?.users?.find((u: any) => u.email === email);
    if (!found) throw new Error(`Cannot find or create user: ${email} - ${signupErr.message}`);
    userId = found.id;
  } else {
    userId = signupData.user.id;
  }

  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (existingProfile?.id) {
    await supabase
      .from('profiles')
      .update({ role, service_types: serviceTypes, active_mode: role, full_name: fullName })
      .eq('id', existingProfile.id);
    return { userId, profileId: existingProfile.id };
  }

  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .insert({
      user_id: userId,
      role,
      service_types: serviceTypes,
      active_mode: role,
      full_name: fullName,
    })
    .select('id')
    .single();

  if (profErr) throw new Error(`Failed to create profile: ${profErr.message}`);
  return { userId, profileId: profile.id };
}

export interface SeedResult {
  cityAId: string;
  cityBId: string;
  cityCId: string;
  driver1: { userId: string; profileId: string };
  driver2: { userId: string; profileId: string };
  provider1: { userId: string; profileId: string };
  company1: { userId: string; profileId: string };
  producer1: { userId: string; profileId: string };
  freightInScope: string;
  freightWrongType: string;
  freightOutsideRadius: string;
  freightNotOpen: string;
  serviceInScope: string;
  serviceWrongType: string;
  serviceOutsideRadius: string;
  serviceNotOpen: string;
}

export async function seedMatchTestData(): Promise<SeedResult> {
  const admin: any = getServiceClient();

  const [cityAId, cityBId, cityCId] = await Promise.all([
    ensureCity(admin, SEED.city_a_name, SEED.city_a_state, SEED.city_a_lat, SEED.city_a_lng, SEED.city_a_ibge),
    ensureCity(admin, SEED.city_b_name, SEED.city_b_state, SEED.city_b_lat, SEED.city_b_lng, SEED.city_b_ibge),
    ensureCity(admin, SEED.city_c_name, SEED.city_c_state, SEED.city_c_lat, SEED.city_c_lng, SEED.city_c_ibge),
  ]);

  const [driver1, driver2, provider1, company1, producer1] = await Promise.all([
    ensureUser(admin, SEED.driver1_email, SEED.password, 'MOTORISTA', ['CARGA', 'FRETE_URBANO', 'GUINCHO'], 'Driver One Test'),
    ensureUser(admin, SEED.driver2_email, SEED.password, 'MOTORISTA', ['CARGA'], 'Driver Two Test'),
    ensureUser(admin, SEED.provider1_email, SEED.password, 'PRESTADOR_SERVICOS', ['AGRONOMO', 'ELETRICISTA'], 'Provider One Test'),
    ensureUser(admin, SEED.company1_email, SEED.password, 'TRANSPORTADORA', ['CARGA'], 'Company One Test'),
    ensureUser(admin, SEED.producer1_email, SEED.password, 'PRODUTOR', [], 'Producer One Test'),
  ]);

  // User cities
  await admin.from('user_cities').delete().eq('user_id', driver1.userId);
  await admin.from('user_cities').insert({
    user_id: driver1.userId,
    city_id: cityAId,
    type: 'MOTORISTA_ORIGEM',
    radius_km: 300,
    is_active: true,
    service_types: ['CARGA', 'FRETE_URBANO', 'GUINCHO'],
  });

  await admin.from('user_cities').delete().eq('user_id', driver2.userId);
  await admin.from('user_cities').insert({
    user_id: driver2.userId,
    city_id: cityCId,
    type: 'MOTORISTA_ORIGEM',
    radius_km: 50,
    is_active: true,
    service_types: ['CARGA'],
  });

  await admin.from('user_cities').delete().eq('user_id', provider1.userId);
  await admin.from('user_cities').insert({
    user_id: provider1.userId,
    city_id: cityAId,
    type: 'PRESTADOR_SERVICO',
    radius_km: 300,
    is_active: true,
    service_types: ['AGRONOMO', 'ELETRICISTA'],
  });

  // Clean old test data
  await admin.from('freights').delete().ilike('origin_address', '%TEST_MATCH_SEED%');
  await admin.from('service_requests').delete().ilike('location_address', '%TEST_MATCH_SEED%');
  await admin.from('match_exposures').delete().eq('viewer_user_id', driver1.userId);
  await admin.from('match_exposures').delete().eq('viewer_user_id', driver2.userId);
  await admin.from('match_exposures').delete().eq('viewer_user_id', provider1.userId);

  // Freights
  const freightBase = {
    requester_id: producer1.profileId,
    origin_address: 'TEST_MATCH_SEED Rua A',
    destination_address: 'TEST_MATCH_SEED Rua B',
    destination_city: 'São Paulo',
    destination_state: 'SP',
    cargo_type: 'GRÃOS',
    weight: 1000,
    price: 5000,
  };

  const { data: fInScope } = await admin.from('freights').insert({
    ...freightBase,
    origin_city: SEED.city_b_name,
    origin_state: SEED.city_b_state,
    origin_city_id: cityBId,
    service_type: 'CARGA',
    status: 'OPEN',
  }).select('id').single();

  const { data: fWrongType } = await admin.from('freights').insert({
    ...freightBase,
    origin_city: SEED.city_b_name,
    origin_state: SEED.city_b_state,
    origin_city_id: cityBId,
    service_type: 'CONTAINER',
    status: 'OPEN',
  }).select('id').single();

  const { data: fOutside } = await admin.from('freights').insert({
    ...freightBase,
    origin_city: SEED.city_c_name,
    origin_state: SEED.city_c_state,
    origin_city_id: cityCId,
    service_type: 'CARGA',
    status: 'OPEN',
  }).select('id').single();

  const { data: fNotOpen } = await admin.from('freights').insert({
    ...freightBase,
    origin_city: SEED.city_b_name,
    origin_state: SEED.city_b_state,
    origin_city_id: cityBId,
    service_type: 'CARGA',
    status: 'CANCELLED',
  }).select('id').single();

  // Service requests
  const srBase = {
    client_id: producer1.profileId,
    location_address: 'TEST_MATCH_SEED Fazenda X',
    problem_description: 'Teste de match',
    urgency: 'MEDIA',
    contact_phone: '62999990000',
    contact_name: 'Produtor Teste',
  };

  const { data: sInScope } = await admin.from('service_requests').insert({
    ...srBase,
    service_type: 'AGRONOMO',
    city_name: SEED.city_b_name,
    state: SEED.city_b_state,
    city_id: cityBId,
    location_lat: SEED.city_b_lat,
    location_lng: SEED.city_b_lng,
    status: 'OPEN',
  }).select('id').single();

  const { data: sWrongType } = await admin.from('service_requests').insert({
    ...srBase,
    service_type: 'MECANICO',
    city_name: SEED.city_b_name,
    state: SEED.city_b_state,
    city_id: cityBId,
    location_lat: SEED.city_b_lat,
    location_lng: SEED.city_b_lng,
    status: 'OPEN',
  }).select('id').single();

  const { data: sOutside } = await admin.from('service_requests').insert({
    ...srBase,
    service_type: 'AGRONOMO',
    city_name: SEED.city_c_name,
    state: SEED.city_c_state,
    city_id: cityCId,
    location_lat: SEED.city_c_lat,
    location_lng: SEED.city_c_lng,
    status: 'OPEN',
  }).select('id').single();

  const { data: sNotOpen } = await admin.from('service_requests').insert({
    ...srBase,
    service_type: 'AGRONOMO',
    city_name: SEED.city_b_name,
    state: SEED.city_b_state,
    city_id: cityBId,
    location_lat: SEED.city_b_lat,
    location_lng: SEED.city_b_lng,
    status: 'COMPLETED',
  }).select('id').single();

  return {
    cityAId,
    cityBId,
    cityCId,
    driver1,
    driver2,
    provider1,
    company1,
    producer1,
    freightInScope: fInScope!.id,
    freightWrongType: fWrongType!.id,
    freightOutsideRadius: fOutside!.id,
    freightNotOpen: fNotOpen!.id,
    serviceInScope: sInScope!.id,
    serviceWrongType: sWrongType!.id,
    serviceOutsideRadius: sOutside!.id,
    serviceNotOpen: sNotOpen!.id,
  };
}

export async function cleanupSeed(): Promise<void> {
  const admin: any = getServiceClient();
  await admin.from('freights').delete().ilike('origin_address', '%TEST_MATCH_SEED%');
  await admin.from('service_requests').delete().ilike('location_address', '%TEST_MATCH_SEED%');

  for (const email of [SEED.driver1_email, SEED.driver2_email, SEED.provider1_email, SEED.company1_email, SEED.producer1_email]) {
    const { data: listData } = await admin.auth.admin.listUsers();
    const found = listData?.users?.find((u: any) => u.email === email);
    if (found) {
      await admin.from('match_exposures').delete().eq('viewer_user_id', found.id);
      await admin.from('match_debug_logs').delete().eq('viewer_user_id', found.id);
    }
  }
}
