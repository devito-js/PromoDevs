import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/**
 * Tabela principal: cada linha é um cupom encontrado por algum scraper.
 *
 * Guardamos `fonte` (de qual agregador ele veio) e `urlOrigem` (link direto
 * pra página do cupom) pra sempre ser possível rastrear e re-verificar.
 *
 * `hash` é um identificador único calculado a partir de (fonte + loja + codigo)
 * — usamos ele para evitar duplicar o mesmo cupom a cada rodada do scraper
 * (isso é feito com "upsert": se o hash já existe, só atualizamos `vistoEm`).
 */
export const cupons = sqliteTable("cupons", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  hash: text("hash").notNull().unique(),

  loja: text("loja").notNull(),
  titulo: text("titulo").notNull(),
  codigo: text("codigo"), // pode ser null quando é só um link promocional, sem código
  desconto: text("desconto"), // texto livre: "20%", "R$50 OFF" etc — normalizar é complicado por loja
  expiraEm: text("expira_em"), // ISO date, quando disponível
  fonte: text("fonte").notNull(), // ex: "promobit", "pelando"
  urlOrigem: text("url_origem").notNull(),

  ativo: integer("ativo", { mode: "boolean" }).notNull().default(true),
  vistoEm: text("visto_em").notNull(), // última vez que o scraper confirmou esse cupom
  criadoEm: text("criado_em").notNull(),
});

export type Cupom = typeof cupons.$inferSelect;
export type NovoCupom = typeof cupons.$inferInsert;
