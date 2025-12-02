import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // SECURITY: Verify admin role before allowing user generation
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autenticado' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Autenticação inválida' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has admin role
    const { data: isAdmin } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!isAdmin) {
      console.warn(`Unauthorized generate-test-users attempt by user ${user.id}`);
      return new Response(
        JSON.stringify({ error: 'Acesso negado. Apenas administradores podem gerar usuários de teste.' }), 
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🚀 Iniciando geração de dados de teste...');

    const createdUsers: any[] = [];
    const password = 'Teste@2025';
    const tatinhaCompanyId = '76bc21ba-a7ba-48a7-8238-07a841de5759';

    // =============== PASSO 1: CRIAR PRODUTORES ===============
    console.log('📦 Criando 5 produtores...');
    for (let i = 1; i <= 5; i++) {
      const email = `produtor${i}@teste.com`;
      
      try {
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            full_name: `Produtor Teste ${i}`,
            role: 'PRODUTOR'
          }
        });

        if (authError) {
          console.error(`Erro ao criar auth user ${email}:`, authError);
          continue;
        }

        console.log(`✅ Auth user criado: ${email}, ID: ${authUser.user.id}`);

        const { data: profile, error: profileError } = await supabaseAdmin
          .from('profiles')
          .insert({
            user_id: authUser.user.id,
            email,
            full_name: `Produtor Teste ${i}`,
            phone: `11${90000 + i}0000`,
            document: `${10000000000 + i * 1000}`, // CPF único
            role: 'PRODUTOR',
            status: 'APPROVED',
            aprovado: true,
            document_validation_status: 'APPROVED',
            document_url: 'https://exemplo.com/doc-produtor.pdf',
            address_street: `Fazenda Rural ${i}`,
            address_city: i <= 2 ? 'Cuiabá' : i <= 4 ? 'Rondonópolis' : 'Sinop',
            address_state: 'MT',
            active_mode: 'PRODUTOR',
          })
          .select()
          .single();

        if (profileError) {
          console.error(`Erro ao criar profile produtor ${i}:`, profileError);
        } else {
          createdUsers.push({ email, role: 'PRODUTOR', profile_id: profile.id });
          console.log(`✅ Produtor ${i} criado: ${email}, Profile ID: ${profile.id}`);
        }
      } catch (e: any) {
        console.error(`Erro crítico ao criar produtor ${i}:`, e);
      }
    }

    // =============== PASSO 2: CRIAR MOTORISTAS AUTÔNOMOS ===============
    console.log('🚗 Criando 5 motoristas autônomos...');
    for (let i = 1; i <= 5; i++) {
      const email = `motorista${i}@teste.com`;
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (authError) {
        console.error(`Erro ao criar auth user ${email}:`, authError);
        continue;
      }

      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          user_id: authUser.user.id,
          email,
          full_name: `Motorista Autônomo ${i}`,
          phone: `11${91000 + i}0000`,
          document: `${23456789000 + i}`,
          role: 'MOTORISTA',
          status: 'APPROVED',
          aprovado: true,
          document_validation_status: 'APPROVED',
          cnh_validation_status: 'APPROVED',
          rntrc_validation_status: 'APPROVED',
          document_url: 'https://exemplo.com/doc-motorista.pdf',
          cnh_number: `${12345678900 + i}`,
          cnh_category: 'E',
          cnh_expiry: '2027-12-31',
          cnh_url: 'https://exemplo.com/cnh-motorista.pdf',
          rntrc_number: `${1000000 + i}`,
          rntrc_expiry: '2027-12-31',
          rntrc_url: 'https://exemplo.com/rntrc-motorista.pdf',
          address_street: `Rua do Motorista ${i}`,
          address_city: i <= 2 ? 'São Paulo' : i <= 4 ? 'Campinas' : 'Santos',
          address_state: 'SP',
          service_types: ['CARGA', 'MUDANCA', 'FRETE_MOTO'],
          active_mode: 'MOTORISTA',
        })
        .select()
        .single();

      if (profileError) {
        console.error(`Erro ao criar profile motorista ${i}:`, profileError);
      } else {
        createdUsers.push({ email, role: 'MOTORISTA', profile_id: profile.id });
        console.log(`✅ Motorista ${i} criado: ${email}`);
      }
    }

    // =============== PASSO 3: CRIAR PRESTADORES DE SERVIÇO ===============
    console.log('🔧 Criando 5 prestadores de serviço...');
    for (let i = 1; i <= 5; i++) {
      const email = `prestador${i}@teste.com`;
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (authError) {
        console.error(`Erro ao criar auth user ${email}:`, authError);
        continue;
      }

      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          user_id: authUser.user.id,
          email,
          full_name: `Prestador Serviço ${i}`,
          phone: `11${92000 + i}0000`,
          document: `${34567890000 + i}`,
          role: 'PRESTADOR_SERVICOS',
          status: 'APPROVED',
          aprovado: true,
          document_validation_status: 'APPROVED',
          document_url: 'https://exemplo.com/doc-prestador.pdf',
          address_street: `Rua do Prestador ${i}`,
          address_city: i <= 2 ? 'Rio de Janeiro' : i <= 4 ? 'Belo Horizonte' : 'Curitiba',
          address_state: i <= 2 ? 'RJ' : i <= 4 ? 'MG' : 'PR',
          service_types: ['GUINCHO', 'MECANICO', 'BORRACHEIRO'],
          active_mode: 'PRESTADOR_SERVICOS',
        })
        .select()
        .single();

      if (profileError) {
        console.error(`Erro ao criar profile prestador ${i}:`, profileError);
      } else {
        createdUsers.push({ email, role: 'PRESTADOR_SERVICOS', profile_id: profile.id });
        console.log(`✅ Prestador ${i} criado: ${email}`);
      }
    }

    // =============== PASSO 4: CRIAR MOTORISTAS AFILIADOS ===============
    console.log('🚛 Criando 5 motoristas afiliados à Tatinha Transportes...');
    const affiliatedDriverIds: string[] = [];
    
    for (let i = 1; i <= 5; i++) {
      const email = `afiliado${i}@teste.com`;
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (authError) {
        console.error(`Erro ao criar auth user ${email}:`, authError);
        continue;
      }

      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          user_id: authUser.user.id,
          email,
          full_name: `Motorista Afiliado Tatinha ${i}`,
          phone: `11${93000 + i}0000`,
          document: `${45678900000 + i}`,
          role: 'MOTORISTA_AFILIADO',
          status: 'APPROVED',
          aprovado: true,
          document_validation_status: 'APPROVED',
          cnh_validation_status: 'APPROVED',
          rntrc_validation_status: 'APPROVED',
          document_url: 'https://exemplo.com/doc-afiliado.pdf',
          cnh_number: `${22345678900 + i}`,
          cnh_category: 'E',
          cnh_expiry: '2027-12-31',
          cnh_url: 'https://exemplo.com/cnh-afiliado.pdf',
          rntrc_number: `${2000000 + i}`,
          rntrc_expiry: '2027-12-31',
          rntrc_url: 'https://exemplo.com/rntrc-afiliado.pdf',
          address_street: `Rua do Afiliado ${i}`,
          address_city: 'Cuiabá',
          address_state: 'MT',
          service_types: ['CARGA', 'MUDANCA'],
          active_mode: 'MOTORISTA_AFILIADO',
        })
        .select()
        .single();

      if (profileError) {
        console.error(`Erro ao criar profile afiliado ${i}:`, profileError);
        continue;
      }

      affiliatedDriverIds.push(profile.id);
      createdUsers.push({ email, role: 'MOTORISTA_AFILIADO', profile_id: profile.id });
      console.log(`✅ Motorista Afiliado ${i} criado: ${email}`);

      // Vincular à Tatinha Transportes
      const { error: companyDriverError } = await supabaseAdmin
        .from('company_drivers')
        .insert({
          company_id: tatinhaCompanyId,
          driver_profile_id: profile.id,
          status: 'ACTIVE',
          can_accept_freights: true,
          can_manage_vehicles: true,
          affiliation_type: 'AFFILIATED',
          accepted_at: new Date().toISOString(),
        });

      if (companyDriverError) {
        console.error(`Erro ao vincular afiliado ${i} à Tatinha:`, companyDriverError);
      } else {
        console.log(`✅ Afiliado ${i} vinculado à Tatinha Transportes`);
      }
    }

    // =============== PASSO 5: GERAR FRETES E SERVIÇOS ===============
    
    // Buscar IDs dos produtores criados
    const produtorProfiles = createdUsers.filter(u => u.role === 'PRODUTOR');
    
    console.log('🚚 Criando 3 serviços de GUINCHO...');
    for (let i = 0; i < 3; i++) {
      const { error } = await supabaseAdmin
        .from('service_requests')
        .insert({
          client_id: produtorProfiles[i]?.profile_id,
          service_type: 'GUINCHO',
          status: 'OPEN',
          urgency: 'HIGH',
          estimated_price: 500 + (i * 150),
          pickup_lat: -23.55 + (i * 0.1),
          pickup_lng: -46.63 + (i * 0.1),
          pickup_address: `Rodovia Teste ${i + 1}, SP`,
          destination_lat: -23.55 - (i * 0.1),
          destination_lng: -46.63 - (i * 0.1),
          destination_address: `Oficina Teste ${i + 1}, SP`,
        });

      if (error) {
        console.error(`Erro ao criar serviço guincho ${i + 1}:`, error);
      } else {
        console.log(`✅ Serviço GUINCHO ${i + 1} criado`);
      }
    }

    console.log('🌾 Criando 3 fretes RURAL (CARGA)...');
    const ruralCargos = ['Soja', 'Milho', 'Café'];
    const origins = [
      { city: 'Rondonópolis', state: 'MT', lat: -16.47, lng: -54.64 },
      { city: 'Sinop', state: 'MT', lat: -11.86, lng: -55.50 },
      { city: 'Rio Verde', state: 'GO', lat: -17.79, lng: -50.91 },
    ];
    const destinations = [
      { city: 'Santos', state: 'SP', lat: -23.96, lng: -46.33 },
      { city: 'Paranaguá', state: 'PR', lat: -25.52, lng: -48.51 },
      { city: 'São Paulo', state: 'SP', lat: -23.55, lng: -46.63 },
    ];

    for (let i = 0; i < 3; i++) {
      const { error } = await supabaseAdmin
        .from('freights')
        .insert({
          producer_id: produtorProfiles[i]?.profile_id,
          service_type: 'CARGA',
          cargo_type: ruralCargos[i],
          status: 'OPEN',
          weight: 25000 + (i * 2000),
          vehicle_type_required: i === 0 ? 'TRUCK' : i === 1 ? 'CARRETA' : 'RODOTREM',
          price: 8000 + (i * 2500),
          origin_city: origins[i].city,
          origin_state: origins[i].state,
          origin_lat: origins[i].lat,
          origin_lng: origins[i].lng,
          destination_city: destinations[i].city,
          destination_state: destinations[i].state,
          destination_lat: destinations[i].lat,
          destination_lng: destinations[i].lng,
          pickup_date: new Date(Date.now() + 86400000 * (i + 1)).toISOString().split('T')[0],
          delivery_date: new Date(Date.now() + 86400000 * (i + 7)).toISOString().split('T')[0],
          description: `Frete rural de ${ruralCargos[i]} - Teste ${i + 1}`,
        });

      if (error) {
        console.error(`Erro ao criar frete rural ${i + 1}:`, error);
      } else {
        console.log(`✅ Frete RURAL ${i + 1} criado (${ruralCargos[i]})`);
      }
    }

    console.log('📦 Criando 3 fretes MUDANÇA...');
    const movingRoutes = [
      { orig: 'São Paulo', dest: 'Rio de Janeiro', origLat: -23.55, origLng: -46.63, destLat: -22.91, destLng: -43.17 },
      { orig: 'Belo Horizonte', dest: 'São Paulo', origLat: -19.92, origLng: -43.94, destLat: -23.55, destLng: -46.63 },
      { orig: 'Curitiba', dest: 'Florianópolis', origLat: -25.43, origLng: -49.27, destLat: -27.59, destLng: -48.54 },
    ];

    for (let i = 0; i < 3; i++) {
      const { error } = await supabaseAdmin
        .from('freights')
        .insert({
          producer_id: produtorProfiles[2 + i]?.profile_id,
          service_type: 'MUDANCA',
          cargo_type: 'Móveis residenciais',
          status: 'OPEN',
          weight: 3000 + (i * 500),
          vehicle_type_required: i === 0 ? 'CARRETA_BAU' : i === 1 ? 'VUC' : 'CAMINHAO_TRUCK',
          price: 2000 + (i * 1000),
          origin_city: movingRoutes[i].orig,
          origin_state: 'SP',
          origin_lat: movingRoutes[i].origLat,
          origin_lng: movingRoutes[i].origLng,
          destination_city: movingRoutes[i].dest,
          destination_state: i === 0 ? 'RJ' : i === 1 ? 'SP' : 'SC',
          destination_lat: movingRoutes[i].destLat,
          destination_lng: movingRoutes[i].destLng,
          pickup_date: new Date(Date.now() + 86400000 * (i + 2)).toISOString().split('T')[0],
          delivery_date: new Date(Date.now() + 86400000 * (i + 5)).toISOString().split('T')[0],
          description: `Mudança residencial - Teste ${i + 1}`,
        });

      if (error) {
        console.error(`Erro ao criar frete mudança ${i + 1}:`, error);
      } else {
        console.log(`✅ Frete MUDANÇA ${i + 1} criado`);
      }
    }

    console.log('🏍️ Criando 3 fretes FRETE_MOTO...');
    for (let i = 0; i < 3; i++) {
      const { error } = await supabaseAdmin
        .from('freights')
        .insert({
          producer_id: produtorProfiles[3 + (i % 2)]?.profile_id,
          service_type: 'FRETE_MOTO',
          cargo_type: i === 0 ? 'Documentos' : i === 1 ? 'Encomenda pequena' : 'Medicamentos',
          status: 'OPEN',
          weight: 5 + (i * 5),
          vehicle_type_required: i === 0 ? 'CAMINHONETE' : i === 1 ? 'PICKUP' : 'CARRO_PEQUENO',
          price: 50 + (i * 50),
          origin_city: 'São Paulo',
          origin_state: 'SP',
          origin_lat: -23.55 + (i * 0.05),
          origin_lng: -46.63 + (i * 0.05),
          destination_city: 'São Paulo',
          destination_state: 'SP',
          destination_lat: -23.55 - (i * 0.05),
          destination_lng: -46.63 - (i * 0.05),
          pickup_date: new Date(Date.now() + 3600000 * (i + 1)).toISOString().split('T')[0],
          delivery_date: new Date(Date.now() + 3600000 * (i + 4)).toISOString().split('T')[0],
          description: `Entrega express por moto - Teste ${i + 1}`,
        });

      if (error) {
        console.error(`Erro ao criar frete moto ${i + 1}:`, error);
      } else {
        console.log(`✅ Frete FRETE_MOTO ${i + 1} criado`);
      }
    }

    // =============== RELATÓRIO FINAL ===============
    const report = {
      success: true,
      timestamp: new Date().toISOString(),
      users_created: {
        PRODUTOR: createdUsers.filter(u => u.role === 'PRODUTOR').length,
        MOTORISTA: createdUsers.filter(u => u.role === 'MOTORISTA').length,
        PRESTADOR_SERVICOS: createdUsers.filter(u => u.role === 'PRESTADOR_SERVICOS').length,
        MOTORISTA_AFILIADO: createdUsers.filter(u => u.role === 'MOTORISTA_AFILIADO').length,
        TOTAL: createdUsers.length,
      },
      credentials: {
        password,
        users: createdUsers.map(u => ({ email: u.email, role: u.role })),
      },
      services_created: {
        GUINCHO: 3,
        RURAL: 3,
        MUDANCA: 3,
        FRETE_MOTO: 3,
        TOTAL: 12,
      },
      affiliated_drivers_linked: affiliatedDriverIds.length,
      tatinha_company_id: tatinhaCompanyId,
    };

    console.log('✅ Geração completa!');
    console.log(JSON.stringify(report, null, 2));

    return new Response(
      JSON.stringify(report),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Erro na geração:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        stack: error.stack 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
