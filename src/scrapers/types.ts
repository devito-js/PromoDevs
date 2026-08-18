import { z } from "zod";

/**
 * Formato padronizado que TODO scraper deve retornar, independente do site
 * de origem. É essa camada que permite adicionar um novo agregador (ex:
 * Pelando, Cuponomia) sem tocar no banco ou no dashboard — só implementando
 * essa mesma forma.
 */
export const cupomBrutoSchema = z.object({
  loja: z.string().min(1),
  titulo: z.string().min(1),
  codigo: z.string().nullable().optional(),
  desconto: z.string().nullable().optional(),
  expiraEm: z.string().nullable().optional(),
  urlOrigem: z.string().url(),
});

export type CupomBruto = z.infer<typeof cupomBrutoSchema>;

/**
 * Todo scraper (um arquivo por site) exporta um objeto assim.
 * `nome` é usado como valor de `fonte` no banco.
 */
export interface Scraper {
  nome: string;
  buscarCupons(): Promise<CupomBruto[]>;
}
