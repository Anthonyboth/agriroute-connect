import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { mdfe_id } = await req.json();

    if (!mdfe_id) {
      throw new Error('mdfe_id é obrigatório');
    }

    console.log(`[MDFe DACTE] Gerando DACTE para MDFe ${mdfe_id}`);

    // Get MDFe data
    const { data: mdfe, error: mdfeError } = await supabaseClient
      .from('mdfe_manifestos')
      .select(`
        *,
        condutores:mdfe_condutores(*),
        veiculos:mdfe_veiculos(*),
        documentos:mdfe_documentos(*)
      `)
      .eq('id', mdfe_id)
      .single();

    if (mdfeError || !mdfe) {
      throw new Error('MDFe não encontrado');
    }

    // Generate simple HTML DACTE
    const html = generateDacteHTML(mdfe);

    // Convert to PDF using a simple HTML-to-PDF approach
    // For production, you'd want to use a proper PDF library
    const pdfBlob = new Blob([html], { type: 'text/html' });
    
    // Upload to Storage
    const fileName = `dacte-${mdfe.chave_acesso}.html`;
    const { data: uploadData, error: uploadError } = await supabaseClient.storage
      .from('mdfe-dactes')
      .upload(fileName, pdfBlob, {
        contentType: 'text/html',
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    // Get signed URL for private bucket (24 hours for DACTE documents)
    const { data: signedUrlData, error: signedUrlError } = await supabaseClient.storage
      .from('mdfe-dactes')
      .createSignedUrl(fileName, 86400); // 24 hours

    if (signedUrlError || !signedUrlData?.signedUrl) {
      throw new Error('Falha ao gerar URL de acesso ao DACTE');
    }

    // Store the file path instead of URL (we'll generate signed URLs on-demand)
    // Update MDFe with storage path for on-demand signed URL generation
    await supabaseClient
      .from('mdfe_manifestos')
      .update({ dacte_url: `mdfe-dactes/${fileName}` })
      .eq('id', mdfe_id);

    console.log(`[MDFe DACTE] DACTE gerado com sucesso: mdfe-dactes/${fileName}`);

    return new Response(
      JSON.stringify({
        success: true,
        dacte_url: signedUrlData.signedUrl,
        storage_path: `mdfe-dactes/${fileName}`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[MDFe DACTE] Erro:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});

function generateDacteHTML(mdfe: any): string {
  const isContingencia = mdfe.status === 'CONTINGENCIA' || mdfe.status === 'PENDENTE';
  const condutor = mdfe.condutores[0] || {};
  const veiculo = mdfe.veiculos[0] || {};

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>DACTE - ${mdfe.chave_acesso}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 20px;
      font-size: 12px;
    }
    .header {
      text-align: center;
      border: 2px solid #000;
      padding: 10px;
      margin-bottom: 20px;
    }
    .header h1 {
      margin: 0;
      font-size: 18px;
    }
    .contingencia-warning {
      background-color: #ff0;
      padding: 10px;
      text-align: center;
      font-weight: bold;
      border: 2px solid #f00;
      margin-bottom: 20px;
    }
    .section {
      border: 1px solid #000;
      padding: 10px;
      margin-bottom: 10px;
    }
    .section-title {
      font-weight: bold;
      margin-bottom: 10px;
      background-color: #ccc;
      padding: 5px;
    }
    .row {
      display: flex;
      margin-bottom: 5px;
    }
    .col {
      flex: 1;
      padding: 5px;
    }
    .label {
      font-weight: bold;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    table th, table td {
      border: 1px solid #000;
      padding: 5px;
      text-align: left;
    }
    table th {
      background-color: #ccc;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>DACTE - Documento Auxiliar do CT-e</h1>
    <p>Manifesto Eletrônico de Documentos Fiscais</p>
  </div>

  ${
    isContingencia
      ? `<div class="contingencia-warning">
    ⚠️ DOCUMENTO EMITIDO EM CONTINGÊNCIA - AGUARDANDO AUTORIZAÇÃO SEFAZ
  </div>`
      : ''
  }

  <div class="section">
    <div class="section-title">IDENTIFICAÇÃO DO MDFE</div>
    <div class="row">
      <div class="col">
        <span class="label">Chave de Acesso:</span> ${mdfe.chave_acesso}
      </div>
    </div>
    <div class="row">
      <div class="col">
        <span class="label">Número:</span> ${mdfe.numero_mdfe}
      </div>
      <div class="col">
        <span class="label">Série:</span> ${mdfe.serie}
      </div>
      <div class="col">
        <span class="label">Data Emissão:</span> ${new Date(
          mdfe.data_emissao
        ).toLocaleString('pt-BR')}
      </div>
    </div>
    ${
      mdfe.protocolo_autorizacao
        ? `<div class="row">
      <div class="col">
        <span class="label">Protocolo SEFAZ:</span> ${mdfe.protocolo_autorizacao}
      </div>
    </div>`
        : ''
    }
    <div class="row">
      <div class="col">
        <span class="label">Status:</span> ${getStatusLabel(mdfe.status)}
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">PERCURSO</div>
    <div class="row">
      <div class="col">
        <span class="label">Origem:</span> ${mdfe.municipio_carregamento_nome} - ${
    mdfe.uf_inicio
  }
      </div>
      <div class="col">
        <span class="label">Destino:</span> ${mdfe.municipio_descarregamento_nome} - ${
    mdfe.uf_fim
  }
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">VEÍCULO</div>
    <div class="row">
      <div class="col">
        <span class="label">Placa:</span> ${veiculo.placa || 'N/A'}
      </div>
      <div class="col">
        <span class="label">RENAVAM:</span> ${veiculo.renavam || 'N/A'}
      </div>
      <div class="col">
        <span class="label">Tara:</span> ${veiculo.tara || 0} kg
      </div>
      <div class="col">
        <span class="label">Capacidade:</span> ${veiculo.capacidade_kg || 0} kg
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">CONDUTOR</div>
    <div class="row">
      <div class="col">
        <span class="label">Nome:</span> ${condutor.nome || 'N/A'}
      </div>
      <div class="col">
        <span class="label">CPF:</span> ${formatCPF(condutor.cpf || '')}
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">CARGA</div>
    <div class="row">
      <div class="col">
        <span class="label">Peso Bruto:</span> ${mdfe.peso_bruto_kg} kg
      </div>
      <div class="col">
        <span class="label">Valor da Carga:</span> R$ ${mdfe.valor_carga.toFixed(2)}
      </div>
    </div>
  </div>

  ${
    mdfe.documentos && mdfe.documentos.length > 0
      ? `
  <div class="section">
    <div class="section-title">DOCUMENTOS FISCAIS</div>
    <table>
      <thead>
        <tr>
          <th>Tipo</th>
          <th>Número</th>
          <th>Série</th>
          <th>Chave de Acesso</th>
          <th>Valor</th>
        </tr>
      </thead>
      <tbody>
        ${mdfe.documentos
          .map(
            (doc: any) => `
        <tr>
          <td>${doc.tipo_documento}</td>
          <td>${doc.numero_documento}</td>
          <td>${doc.serie_documento}</td>
          <td>${doc.chave_acesso}</td>
          <td>R$ ${doc.valor.toFixed(2)}</td>
        </tr>
        `
          )
          .join('')}
      </tbody>
    </table>
  </div>
  `
      : ''
  }

  <div style="text-align: center; margin-top: 20px; font-size: 10px;">
    <p>Documento gerado eletronicamente - AgriFrete MT</p>
    <p>Gerado em ${new Date().toLocaleString('pt-BR')}</p>
  </div>
</body>
</html>`;
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    PENDENTE: 'Pendente de Transmissão',
    CONTINGENCIA: 'Em Contingência',
    AUTORIZADO: 'Autorizado pela SEFAZ',
    ENCERRADO: 'Encerrado',
    CANCELADO: 'Cancelado',
  };
  return labels[status] || status;
}

function formatCPF(cpf: string): string {
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length !== 11) return cpf;
  return `${cleaned.substring(0, 3)}.${cleaned.substring(3, 6)}.${cleaned.substring(
    6,
    9
  )}-${cleaned.substring(9)}`;
}
