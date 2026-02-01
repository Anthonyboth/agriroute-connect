import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface TokenTestResult {
  tokenName: string;
  success: boolean;
  environment: "production" | "homologation" | null;
  error?: string;
  responseStatus?: number;
  responseSnippet?: string;
}

async function testToken(
  tokenValue: string,
  tokenName: string,
  testCnpj: string
): Promise<TokenTestResult> {
  if (!tokenValue || tokenValue.trim() === "") {
    return {
      tokenName,
      success: false,
      environment: null,
      error: "Token não configurado ou vazio",
    };
  }

  const token = tokenValue.trim();
  const authHeader = `Basic ${btoa(`${token}:`)}`;

  // Test production first
  const prodUrl = `https://api.focusnfe.com.br/v2/empresas/${testCnpj}`;
  const homologUrl = `https://homologacao.focusnfe.com.br/v2/empresas/${testCnpj}`;

  console.log(`[test-focus-tokens] Testing ${tokenName} on PRODUCTION...`);

  try {
    const prodResponse = await fetch(prodUrl, {
      method: "GET",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
    });

    const prodText = await prodResponse.text();

    if (prodResponse.status === 200 || prodResponse.status === 404) {
      // 200 = empresa existe, 404 = empresa não existe mas token válido
      console.log(`[test-focus-tokens] ${tokenName} WORKS on PRODUCTION (status ${prodResponse.status})`);
      return {
        tokenName,
        success: true,
        environment: "production",
        responseStatus: prodResponse.status,
        responseSnippet: prodText.slice(0, 100),
      };
    }

    if (prodResponse.status === 401) {
      console.log(`[test-focus-tokens] ${tokenName} FAILED on production (401), trying homologation...`);
    } else {
      console.log(`[test-focus-tokens] ${tokenName} got unexpected status ${prodResponse.status} on production`);
    }
  } catch (err) {
    console.log(`[test-focus-tokens] ${tokenName} production fetch error: ${err}`);
  }

  // Test homologation
  console.log(`[test-focus-tokens] Testing ${tokenName} on HOMOLOGATION...`);

  try {
    const homologResponse = await fetch(homologUrl, {
      method: "GET",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
    });

    const homologText = await homologResponse.text();

    if (homologResponse.status === 200 || homologResponse.status === 404) {
      console.log(`[test-focus-tokens] ${tokenName} WORKS on HOMOLOGATION (status ${homologResponse.status})`);
      return {
        tokenName,
        success: true,
        environment: "homologation",
        responseStatus: homologResponse.status,
        responseSnippet: homologText.slice(0, 100),
      };
    }

    console.log(`[test-focus-tokens] ${tokenName} FAILED on both environments`);
    return {
      tokenName,
      success: false,
      environment: null,
      error: `Produção e Homologação retornaram erro`,
      responseStatus: homologResponse.status,
      responseSnippet: homologText.slice(0, 150),
    };
  } catch (err) {
    return {
      tokenName,
      success: false,
      environment: null,
      error: `Erro de conexão: ${err}`,
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log("[test-focus-tokens] Starting token validation...");

  // Get all tokens
  const token1 = Deno.env.get("FOCUS_NFE_TOKEN_1") || "";
  const token2 = Deno.env.get("FOCUS_NFE_TOKEN_2") || "";
  const token3 = Deno.env.get("FOCUS_NFE_TOKEN_3") || "";
  const currentToken = Deno.env.get("FOCUS_NFE_TOKEN") || "";

  // Use a test CNPJ - this is a common test CNPJ used for validation
  // We're just checking if the token authenticates, not if the company exists
  const testCnpj = "62965243000111"; // Same CNPJ from logs

  const results: TokenTestResult[] = [];

  // Test each token
  if (token1) {
    results.push(await testToken(token1, "FOCUS_NFE_TOKEN_1", testCnpj));
  }
  if (token2) {
    results.push(await testToken(token2, "FOCUS_NFE_TOKEN_2", testCnpj));
  }
  if (token3) {
    results.push(await testToken(token3, "FOCUS_NFE_TOKEN_3", testCnpj));
  }

  // Also test current token
  if (currentToken) {
    results.push(await testToken(currentToken, "FOCUS_NFE_TOKEN (atual)", testCnpj));
  }

  // Find working production token
  const workingProdToken = results.find(
    (r) => r.success && r.environment === "production"
  );

  // Find working homolog token as fallback
  const workingHomologToken = results.find(
    (r) => r.success && r.environment === "homologation"
  );

  const workingToken = workingProdToken || workingHomologToken;

  console.log("[test-focus-tokens] Results:", JSON.stringify(results, null, 2));

  const summary = {
    tested_tokens: results.length,
    results,
    recommendation: workingToken
      ? {
          use_token: workingToken.tokenName,
          environment: workingToken.environment,
          message: `O token ${workingToken.tokenName} funciona no ambiente de ${
            workingToken.environment === "production" ? "PRODUÇÃO" : "HOMOLOGAÇÃO"
          }. Atualize FOCUS_NFE_TOKEN com o valor deste token.`,
        }
      : {
          message:
            "Nenhum token funcionou. Verifique se os tokens estão corretos e se sua conta Focus NFe está ativa.",
        },
    current_token_status: currentToken
      ? results.find((r) => r.tokenName === "FOCUS_NFE_TOKEN (atual)")
      : { error: "FOCUS_NFE_TOKEN não está configurado" },
  };

  return json(200, summary);
});
