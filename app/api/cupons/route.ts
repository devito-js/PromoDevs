import { db } from "@/db/client";
import { cupons } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/cupons?dominio=mercadolivre.com.br
 * GET /api/cupons?loja=Mercado%20Livre  (alternativa, quando não há domínio)
 *
 * Endpoint de leitura pública (só cupons, nada sensível) usado pela extensão
 * de navegador (ver extension/) pra descobrir os cupons ativos da loja que o
 * usuário está visitando no momento. Filtra por domínio quando possível —
 * mais confiável que o nome da loja, que varia de escrita entre fontes (ex:
 * "AliExpress" no Promobit vs "Aliexpress" no Pelando; ver o comentário em
 * src/db/schema.ts sobre o campo `dominio`).
 *
 * CORS liberado pra qualquer origem: é leitura pública de dados que já são
 * públicos nos sites de cupom de origem, sem autenticação nem PII envolvida.
 */
const CORS_HEADERS = { "Access-Control-Allow-Origin": "*" };

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dominioParam = searchParams
    .get("dominio")
    ?.replace(/^www\./, "")
    .toLowerCase();
  const lojaParam = searchParams.get("loja");

  if (!dominioParam && !lojaParam) {
    return NextResponse.json(
      { erro: "Informe o parâmetro 'dominio' ou 'loja'." },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const cuponsAtivos = await db
    .select()
    .from(cupons)
    .where(eq(cupons.ativo, true));

  const filtrados = dominioParam
    ? cuponsAtivos.filter(
        (c) =>
          c.dominio &&
          (dominioParam === c.dominio || dominioParam.endsWith(`.${c.dominio}`))
      )
    : cuponsAtivos.filter(
        (c) => c.loja.toLowerCase() === lojaParam!.toLowerCase()
      );

  const resposta = filtrados
    .sort((a, b) => b.vistoEm.localeCompare(a.vistoEm))
    .map((c) => ({
      id: c.id,
      loja: c.loja,
      titulo: c.titulo,
      codigo: c.codigo,
      desconto: c.desconto,
      urlOrigem: c.urlOrigem,
      fonte: c.fonte,
    }));

  return NextResponse.json({ cupons: resposta }, { headers: CORS_HEADERS });
}

// Preflight — inofensivo aqui (GET simples, sem credenciais), mas alguns
// clientes (fetch de extensão em modo mais estrito) disparam OPTIONS antes.
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...CORS_HEADERS,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  });
}
