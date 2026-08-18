import * as cheerio from "cheerio";
import { type Scraper, type CupomBruto, cupomBrutoSchema } from "./types";
import { extrairDominioRegistravel } from "./dominio";

const SITE_URL = "https://www.cuponomia.com.br";

// Lista de lojas cobertas — mesmo esquema do Pelando (páginas por loja, não
// uma listagem única). Slugs conferidos manualmente batendo em
// /desconto/<slug> (ver histórico do PR/commit); nem sempre bate com o
// slug do Pelando pra loja equivalente (ex: aqui é "magazine-luiza", lá é
// "magalu") — por isso o campo `dominio` (ver abaixo) é o que importa pra
// cruzar com a extensão, não o slug nem o nome de exibição.
const LOJAS_SLUGS = [
  "mercado-livre",
  "amazon",
  "shopee",
  "aliexpress",
  "magazine-luiza",
];

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
};

/**
 * O Cuponomia renderiza a lista de cupons no HTML puro (sem framework JS
 * nem JSON-LD dos cupons — só metadados de Organization/Breadcrumb) — um
 * fetch simples já traz tudo. O nome/domínio da loja vêm de um objeto JS
 * inline (`window.cpnStore = {...}`) que não é JSON válido (chaves sem
 * aspas, um método como valor), então extraímos só os campos que
 * interessam com regex em vez de tentar fazer parse do objeto inteiro.
 *
 * IMPORTANTE: o robots.txt deles bloqueia `/coupon/show/` pra crawlers —
 * por isso a URL que guardamos por cupom (`urlOrigem`) é uma âncora pra
 * página da loja (`/desconto/<slug>#<id>`), não o link de redirecionamento
 * de "Ver Cupom". Isso também evita uma segunda requisição por cupom (like
 * o Pelando precisa) só pra descobrir o domínio: aqui o domínio é o mesmo
 * pra loja inteira, então extraímos uma vez por página.
 */
function extrairNomeEDominioDaLoja(html: string): {
  nome: string | null;
  dominio: string | null;
} {
  const matchNome = html.match(/window\.cpnStore\s*=\s*\{[\s\S]*?name:\s*"([^"]+)"/);
  const matchUrl = html.match(/window\.cpnStore\s*=\s*\{[\s\S]*?targetUrl:\s*"([^"]+)"/);

  const dominio = matchUrl ? extrairDominioRegistravel(matchUrl[1]) : null;

  return { nome: matchNome?.[1] ?? null, dominio };
}

export const cuponomiaScraper: Scraper = {
  nome: "cuponomia",

  async buscarCupons(): Promise<CupomBruto[]> {
    const cuponsEncontrados: CupomBruto[] = [];

    for (const slug of LOJAS_SLUGS) {
      const urlListagem = `${SITE_URL}/desconto/${slug}`;

      let html: string;
      try {
        const resposta = await fetch(urlListagem, { headers: HEADERS });
        if (!resposta.ok) {
          console.warn(
            `[cuponomia] loja "${slug}" respondeu ${resposta.status}, pulando.`
          );
          continue;
        }
        html = await resposta.text();
      } catch (erro) {
        console.warn(`[cuponomia] falha ao buscar loja "${slug}":`, erro);
        continue;
      }

      const { nome: nomeLoja, dominio } = extrairNomeEDominioDaLoja(html);
      const $ = cheerio.load(html);

      $("li.js-scroll-item[data-type]").each((_, elemento) => {
        const item = $(elemento);
        const id = item.attr("id");
        const titulo = item.find(".js-itemTitle").first().text().trim();
        const codigo = item.find(".js-itemCode").first().text().trim();
        const descontoTexto = item.find(".js-couponSmallText").first().text().trim();

        if (!id || !titulo) return;

        const candidato = {
          loja: nomeLoja ?? slug,
          lojaDominio: dominio,
          titulo,
          codigo: codigo || null,
          desconto: descontoTexto || null,
          expiraEm: null, // Cuponomia mostra "verificado há X" no card, não uma data de expiração
          urlOrigem: `${urlListagem}#${id}`,
        };

        const resultado = cupomBrutoSchema.safeParse(candidato);
        if (resultado.success) {
          cuponsEncontrados.push(resultado.data);
        }
      });
    }

    return cuponsEncontrados;
  },
};
