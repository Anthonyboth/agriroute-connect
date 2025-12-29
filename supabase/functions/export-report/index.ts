import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExportRequest {
  reportType: 'producer' | 'driver' | 'provider' | 'company' | 'admin';
  format: 'pdf' | 'xlsx';
  dateRangeFrom?: string;
  dateRangeTo?: string;
  sections: ExportSection[];
  title: string;
}

interface ExportSection {
  title: string;
  type: 'kpi' | 'table' | 'list';
  data: any[];
  columns?: { key: string; label: string }[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    const body: ExportRequest = await req.json();
    const { reportType, format, dateRangeFrom, dateRangeTo, sections, title } = body;

    console.log(`[export-report] Exporting ${reportType} report in ${format} format for user ${user.id}`);

    // Register export in database
    const { data: exportRecord, error: insertError } = await supabase
      .from('report_exports')
      .insert({
        user_id: user.id,
        profile_id: profile?.id,
        report_type: reportType,
        format,
        date_range_from: dateRangeFrom,
        date_range_to: dateRangeTo,
        status: 'processing',
        metadata: { title, sections_count: sections.length }
      })
      .select()
      .single();

    if (insertError) {
      console.error('[export-report] Error inserting export record:', insertError);
      throw insertError;
    }

    // Generate file content based on format
    let fileContent: string;
    let contentType: string;
    let fileName: string;

    const dateStr = new Date().toISOString().split('T')[0];

    if (format === 'xlsx') {
      // Generate CSV for XLSX (simplified - client will use xlsx library)
      fileContent = generateCSV(sections, title);
      contentType = 'text/csv';
      fileName = `${title.replace(/\s+/g, '_')}_${dateStr}.csv`;
    } else {
      // Generate HTML for PDF (client will use jspdf)
      fileContent = generateHTMLReport(sections, title, dateRangeFrom, dateRangeTo);
      contentType = 'text/html';
      fileName = `${title.replace(/\s+/g, '_')}_${dateStr}.html`;
    }

    // Update export record as completed
    await supabase
      .from('report_exports')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        file_size_bytes: new TextEncoder().encode(fileContent).length
      })
      .eq('id', exportRecord.id);

    console.log(`[export-report] Export completed: ${exportRecord.id}`);

    return new Response(JSON.stringify({
      success: true,
      exportId: exportRecord.id,
      content: fileContent,
      contentType,
      fileName
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[export-report] Error:', error);
    return new Response(JSON.stringify({ 
      error: 'Erro ao gerar relatório',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function generateCSV(sections: ExportSection[], title: string): string {
  let csv = `${title}\n\n`;

  for (const section of sections) {
    csv += `${section.title}\n`;

    if (section.type === 'kpi' || section.type === 'list') {
      for (const item of section.data) {
        if (typeof item === 'object') {
          csv += Object.values(item).join(',') + '\n';
        } else {
          csv += `${item}\n`;
        }
      }
    } else if (section.type === 'table' && section.columns) {
      // Header
      csv += section.columns.map(c => c.label).join(',') + '\n';
      // Rows
      for (const row of section.data) {
        csv += section.columns.map(c => {
          const val = row[c.key];
          return typeof val === 'string' && val.includes(',') ? `"${val}"` : val;
        }).join(',') + '\n';
      }
    }
    csv += '\n';
  }

  return csv;
}

function generateHTMLReport(
  sections: ExportSection[], 
  title: string, 
  dateFrom?: string, 
  dateTo?: string
): string {
  const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '';
  
  let html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
    h1 { color: #16a34a; border-bottom: 2px solid #16a34a; padding-bottom: 10px; }
    h2 { color: #166534; margin-top: 30px; }
    .period { color: #666; font-size: 14px; margin-bottom: 20px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 20px 0; }
    .kpi-card { background: #f0fdf4; border: 1px solid #86efac; padding: 15px; border-radius: 8px; }
    .kpi-label { font-size: 12px; color: #666; }
    .kpi-value { font-size: 24px; font-weight: bold; color: #16a34a; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
    th { background: #16a34a; color: white; }
    tr:nth-child(even) { background: #f9f9f9; }
    .footer { margin-top: 40px; text-align: center; color: #999; font-size: 12px; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p class="period">Período: ${formatDate(dateFrom)} - ${formatDate(dateTo)}</p>
`;

  for (const section of sections) {
    html += `<h2>${section.title}</h2>`;

    if (section.type === 'kpi') {
      html += '<div class="kpi-grid">';
      for (const item of section.data) {
        html += `
          <div class="kpi-card">
            <div class="kpi-label">${item.label || item.title || ''}</div>
            <div class="kpi-value">${item.value || ''}</div>
          </div>
        `;
      }
      html += '</div>';
    } else if (section.type === 'table' && section.columns) {
      html += '<table>';
      html += '<thead><tr>';
      for (const col of section.columns) {
        html += `<th>${col.label}</th>`;
      }
      html += '</tr></thead><tbody>';
      for (const row of section.data) {
        html += '<tr>';
        for (const col of section.columns) {
          html += `<td>${row[col.key] ?? ''}</td>`;
        }
        html += '</tr>';
      }
      html += '</tbody></table>';
    } else if (section.type === 'list') {
      html += '<ul>';
      for (const item of section.data) {
        html += `<li>${typeof item === 'object' ? JSON.stringify(item) : item}</li>`;
      }
      html += '</ul>';
    }
  }

  html += `
  <div class="footer">
    <p>Relatório gerado automaticamente por AGRIROUTE em ${new Date().toLocaleString('pt-BR')}</p>
  </div>
</body>
</html>`;

  return html;
}
