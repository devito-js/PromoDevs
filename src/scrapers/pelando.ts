import { type Scraper, type CupomBruto, cupomBrutoSchema } from "./types";

const SITE_URL = "https://www.pelando.com.br";

// Lista de lojas cobertas. O Pelando organiza cupons por página de loja
// (/cupons-de-descontos/<slug>), não numa listagem única com todas as lojas
// como o Promobit — então cobrimos loja por loja. Adicionar uma nova loja é
// só incluir o slug aqui (o mesmo usado na URL da página da loja).
const LOJAS_SLUGS = ["mercado-livre", "amazon", "aliexpress", "shopee", "magalu"];

// Limite de cupons processados por loja — cada cupom exige uma segunda
// requisição (a página de detalhe) só pra descobrir o código. Isso evita que
// uma loja com uma página enorme gere centenas de requisições numa rodada só.
const MAX_CUPONS_POR_LOJA = 40;

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
};

function aguardar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface OfertaLdJson {
  "@type": string;
  "@id"?: string;
  name?: string;
  url?: string;
}

/**
 * O Pelando é renderizado no servidor (Astro) e embute os dados de cada
 * cupom como JSON-LD (schema.org) em <script id="coupon-store-graph">. Isso
 * já vem pronto no HTML — descoberto inspecionando o código-fonte da página,
 * sem precisar de browser nem de seletores CSS frágeis.
 *
 * O JSON-LD não traz o código do cupom (isso só aparece na página de
 * detalhe de cada oferta, ver `buscarCodigo` abaixo).
 */
function extrairOfertas(html: string): {
  ofertas: OfertaLdJson[];
  nomeLoja: string | null;
  dominioLoja: string | null;
} {
  const match = html.match(
    /<script id="coupon-store-graph"[^>]*>([\s\S]*?)<\/script>/
  );
  if (!match) return { ofertas: [], nomeLoja: null, dominioLoja: null };

  let dados: { "@graph"?: Array<Record<string, unknown>> };
  try {
    dados = JSON.parse(match[1]);
  } catch {
    return { ofertas: [], nomeLoja: null, dominioLoja: null };
  }

  const grafo = dados["@graph"] ?? [];

  const ofertas = grafo.filter(
    (no) => no["@type"] === "Offer"
  ) as unknown as OfertaLdJson[];

  const organizacaoLoja = grafo.find(
    (no) =>
      no["@type"] === "Organization" &&
      typeof no["@id"] === "string" &&
      no["@id"].includes("#store-org")
  );

  // A URL do site oficial da loja (não a do Pelando) vem em `url`, ex:
  // "https://www.mercadolivre.com.br/" — extraímos só o hostname, sem
  // "www." nem protocolo.
  let dominioLoja: string | null = null;
  const urlLoja = organizacaoLoja?.url as string | undefined;
  if (urlLoja) {
    try {
      dominioLoja = new URL(urlLoja).hostname.replace(/^www\./, "");
    } catch {
      dominioLoja = null;
    }
  }

  return {
    ofertas,
    nomeLoja: (organizacaoLoja?.name as string) ?? null,
    dominioLoja,
  };
}

/**
 * O código do cupom (ex: "MAKE20") aparece direto no HTML da página de
 * detalhe, no atributo `data-code` do botão de copiar — também renderizado
 * no servidor, então um fetch simples é suficiente.
 */
async function buscarCodigo(urlDetalhe: string): Promise<string | null> {
  const resposta = await fetch(urlDetalhe, { headers: HEADERS });
  if (!resposta.ok) return null;

  const html = await resposta.text();
  const match = html.match(/data-code="([^"]+)"/);
  return match?.[1] ?? null;
}

export const pelandoScraper: Scraper = {
  nome: "pelando",

  async buscarCupons(): Promise<CupomBruto[]> {
    const cuponsEncontrados: CupomBruto[] = [];

    for (const slug of LOJAS_SLUGS) {
      const urlListagem = `${SITE_URL}/cupons-de-descontos/${slug}`;

      let html: string;
      try {
        const resposta = await fetch(urlListagem, { headers: HEADERS });
        if (!resposta.ok) {
          console.warn(
            `[pelando] loja "${slug}" respondeu ${resposta.status}, pulando.`
          );
          continue;
        }
        html = await resposta.text();
      } catch (erro) {
        console.warn(`[pelando] falha ao buscar loja "${slug}":`, erro);
        continue;
      }

      const { ofertas, nomeLoja, dominioLoja } = extrairOfertas(html);

      for (const oferta of ofertas.slice(0, MAX_CUPONS_POR_LOJA)) {
        if (!oferta.url || !oferta.name) continue;

        // Pausa curta entre requisições pra não martelar o servidor deles —
        // cada cupom aqui exige uma segunda requisição (a página de detalhe).
        await aguardar(300);

        const codigo = await buscarCodigo(oferta.url).catch(() => null);

        const candidato = {
          loja: nomeLoja ?? slug,
          lojaDominio: dominioLoja,
          titulo: oferta.name,
          codigo,
          // O Pelando não expõe um campo de desconto separado — o valor
          // (ex: "20% off") já vem embutido no título da oferta.
          desconto: null,
          expiraEm: null,
          urlOrigem: oferta.url,
        };

        const resultado = cupomBrutoSchema.safeParse(candidato);
        if (resultado.success) {
          cuponsEncontrados.push(resultado.data);
        }
      }
    }

    return cuponsEncontrados;
  },
};
