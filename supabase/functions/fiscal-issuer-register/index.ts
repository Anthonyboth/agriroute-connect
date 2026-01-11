import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============= CPF/CNPJ Validation =============
function normalizeDocument(doc: string): string {
  return doc.replace(/\D/g, '');
}

function validateCPF(cpf: string): boolean {
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cpf.charAt(i)) * (10 - i);
  }
  let remainder = sum % 11;
  let firstDigit = remainder < 2 ? 0 : 11 - remainder;
  if (parseInt(cpf.charAt(9)) !== firstDigit) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cpf.charAt(i)) * (11 - i);
  }
  remainder = sum % 11;
  let secondDigit = remainder < 2 ? 0 : 11 - remainder;
  return parseInt(cpf.charAt(10)) === secondDigit;
}

function validateCNPJ(cnpj: string): boolean {
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
  
  let sum = 0;
  let weight = 2;
  for (let i = 11; i >= 0; i--) {
    sum += parseInt(cnpj.charAt(i)) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  let remainder = sum % 11;
  let firstDigit = remainder < 2 ? 0 : 11 - remainder;
  if (parseInt(cnpj.charAt(12)) !== firstDigit) return false;
  
  sum = 0;
  weight = 2;
  for (let i = 12; i >= 0; i--) {
    sum += parseInt(cnpj.charAt(i)) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  remainder = sum % 11;
  let secondDigit = remainder < 2 ? 0 : 11 - remainder;
  return parseInt(cnpj.charAt(13)) === secondDigit;
}

function isValidDocument(doc: string): boolean {
  const normalized = normalizeDocument(doc);
  if (normalized.length === 11) return validateCPF(normalized);
  if (normalized.length === 14) return validateCNPJ(normalized);
  return false;
}

// ============= Validation Schema =============
const IssuerTypeSchema = z.enum(['CPF', 'CNPJ', 'MEI']);
const RegimeTributarioSchema = z.enum([
  'simples_nacional',
  'simples_nacional_excesso', 
  'lucro_presumido',
  'lucro_real'
]);

const RegisterIssuerSchema = z.object({
  issuer_type: IssuerTypeSchema,
  cpf_cnpj: z.string()
    .transform(normalizeDocument)
    .refine((doc) => doc.length === 11 || doc.length === 14, {
      message: "Documento deve ser CPF (11 dígitos) ou CNPJ (14 dígitos)"
    })
    .refine(isValidDocument, {
      message: "CPF ou CNPJ inválido"
    }),
  razao_social: z.string().min(2, "Razão social muito curta").max(200),
  nome_fantasia: z.string().max(200).optional(),
  inscricao_estadual: z.string().max(20).optional(),
  inscricao_municipal: z.string().max(20).optional(),
  regime_tributario: RegimeTributarioSchema,
  cnae_principal: z.string().max(10).optional(),
  endereco_logradouro: z.string().max(200).optional(),
  endereco_numero: z.string().max(20).optional(),
  endereco_complemento: z.string().max(100).optional(),
  endereco_bairro: z.string().max(100).optional(),
  endereco_cidade: z.string().max(100).optional(),
  endereco_uf: z.string().length(2).optional(),
  endereco_cep: z.string().max(10).optional(),
  endereco_ibge: z.string().max(10).optional(),
  email_fiscal: z.string().email().optional(),
  telefone_fiscal: z.string().max(20).optional(),
});

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'Perfil não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const validation = RegisterIssuerSchema.safeParse(body);
    
    if (!validation.success) {
      return new Response(
        JSON.stringify({ 
          error: 'Dados inválidos', 
          details: validation.error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = validation.data;

    // Check if issuer already exists for this profile
    const { data: existingIssuer } = await supabase
      .from('fiscal_issuers')
      .select('id')
      .eq('profile_id', profile.id)
      .maybeSingle();

    if (existingIssuer) {
      return new Response(
        JSON.stringify({ error: 'Emissor fiscal já cadastrado para este perfil' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if CPF/CNPJ is already registered
    const { data: existingDoc } = await supabase
      .from('fiscal_issuers')
      .select('id')
      .eq('cpf_cnpj', data.cpf_cnpj)
      .maybeSingle();

    if (existingDoc) {
      return new Response(
        JSON.stringify({ error: 'Este CPF/CNPJ já está cadastrado em outro emissor' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create the fiscal issuer
    const now = new Date().toISOString();
    const issuerData = {
      profile_id: profile.id,
      issuer_type: data.issuer_type,
      cpf_cnpj: data.cpf_cnpj,
      razao_social: data.razao_social,
      nome_fantasia: data.nome_fantasia || null,
      inscricao_estadual: data.inscricao_estadual || null,
      inscricao_municipal: data.inscricao_municipal || null,
      regime_tributario: data.regime_tributario,
      cnae_principal: data.cnae_principal || null,
      endereco_logradouro: data.endereco_logradouro || null,
      endereco_numero: data.endereco_numero || null,
      endereco_complemento: data.endereco_complemento || null,
      endereco_bairro: data.endereco_bairro || null,
      endereco_cidade: data.endereco_cidade || null,
      endereco_uf: data.endereco_uf || null,
      endereco_cep: data.endereco_cep || null,
      endereco_ibge: data.endereco_ibge || null,
      email_fiscal: data.email_fiscal || null,
      telefone_fiscal: data.telefone_fiscal || null,
      status: 'DOCUMENT_VALIDATED',
      ambiente: 'homologacao',
      created_at: now,
      updated_at: now,
    };

    const { data: issuer, error: insertError } = await supabase
      .from('fiscal_issuers')
      .insert(issuerData)
      .select()
      .single();

    if (insertError) {
      console.error('[fiscal-issuer-register] Insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Erro ao cadastrar emissor fiscal' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create fiscal wallet with initial balance
    const { error: walletError } = await supabase
      .from('fiscal_wallet')
      .insert({
        issuer_id: issuer.id,
        balance: 0,
        total_credits_purchased: 0,
        total_emissions_used: 0,
        created_at: now,
        updated_at: now,
      });

    if (walletError) {
      console.error('[fiscal-issuer-register] Wallet creation error:', walletError);
      // Non-fatal - wallet can be created later
    }

    console.log(`[fiscal-issuer-register] Issuer created: ${issuer.id} for profile ${profile.id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        issuer,
        message: 'Emissor fiscal cadastrado com sucesso'
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[fiscal-issuer-register] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
