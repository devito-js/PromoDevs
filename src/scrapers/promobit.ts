import { type Scraper, type CupomBruto, cupomBrutoSchema } from "./types";
import { extrairDominioRegistravel } from "./dominio";

const API_URL = "https://api.promobit.com.br/coupon";
const SITE_URL = "https://www.promobit.com.br";

/**
 * Formato (parcial) que a API real do Promobit devolve. Descoberto inspecionando
 * as requisições que a própria página https://www.promobit.com.br/cupons/ faz
 * no navegador (aba Network) — é a mesma API que alimenta a lista de cupons
 * que a gente vê na tela, então não depende de raspar HTML nem de classes CSS
 * (que mudam com frequência).
 *
 * Se um dia esse endpoint sumir ou mudar de formato, o próximo passo natural
 * é trocar para Playwright: abrir a página com um browser de verdade e ler o
 * JSON embutido em <script id="__NEXT_DATA__"> — os mesmos campos aparecem
 * lá (em camelCase, ex: `couponCode` em vez de `coupon_code`).
 */
interface CupomApiPromobit {
  coupon_id: number;
  coupon_discount: string | null;
  coupon_discount_value: string | null;
  coupon_status_name: string | null;
  coupon_title: string;
  coupon_code: string | null;
  coupon_url: string;
  coupon_until: string | null;
  store_name: string;
  store_domain: string | null;
}

interface RespostaApiPromobit {
  coupons: CupomApiPromobit[];
  after?: number | null;
}

export const promobitScraper: Scraper = {
  nome: "promobit",

  async buscarCupons(): Promise<CupomBruto[]> {
    // `type=best` é o mesmo filtro usado na home de cupons do site.
    // `limit=50` é um valor conservador; a API aceita paginar via o campo
    // `after` da resposta, mas isso fica pra quando o volume justificar.
    const url = `${API_URL}?limit=50&type=best`;

    const resposta = await fetch(url, {
      headers: {
        // Alguns endpoints de API ainda bloqueiam requisições sem
        // User-Agent/Referer de navegador.
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "application/json",
        Referer: `${SITE_URL}/cupons/`,
      },
    });

    if (!resposta.ok) {
      throw new Error(
        `Promobit (API) respondeu ${resposta.status} ao buscar ${url}`
      );
    }

    const dados = (await resposta.json()) as RespostaApiPromobit;

    const cuponsEncontrados: CupomBruto[] = [];

    for (const cupom of dados.coupons ?? []) {
      // A API pode retornar cupons em outros status (ex: pendente de revisão).
      // Só nos interessam os já aprovados e publicados no site.
      if (cupom.coupon_status_name && cupom.coupon_status_name !== "APPROVED") {
        continue;
      }

      const candidato = {
        loja: cupom.store_name,
        lojaDominio: cupom.store_domain
          ? extrairDominioRegistravel(cupom.store_domain)
          : null,
        titulo: cupom.coupon_title,
        codigo: cupom.coupon_code || null,
        desconto: cupom.coupon_discount || cupom.coupon_discount_value || null,
        expiraEm: cupom.coupon_until || null,
        // `coupon_url` vem relativo (ex: "/Redirect/cupom/68502")
        urlOrigem: new URL(cupom.coupon_url, SITE_URL).toString(),
      };

      // Validamos com Zod antes de aceitar — se a API mudou e algum campo
      // obrigatório vier vazio, esse item é descartado em vez de quebrar tudo.
      const resultado = cupomBrutoSchema.safeParse(candidato);
      if (resultado.success) {
        cuponsEncontrados.push(resultado.data);
      }
    }

    return cuponsEncontrados;
  },
};
