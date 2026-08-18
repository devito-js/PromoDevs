import { createHash } from "node:crypto";
import { db } from "./db/client";
import { cupons } from "./db/schema";
import { sql } from "drizzle-orm";
import { promobitScraper } from "./scrapers/promobit";
import { pelandoScraper } from "./scrapers/pelando";
import type { Scraper } from "./scrapers/types";

// Lista de scrapers ativos — adicionar um novo agregador é só importar e
// colocar aqui, desde que ele implemente a interface `Scraper`.
const scrapers: Scraper[] = [promobitScraper, pelandoScraper];

function calcularHash(fonte: string, urlOrigem: string) {
  // `urlOrigem` é único por cupom em qualquer fonte (ex: o Promobit usa
  // "/Redirect/cupom/<id>", com um id próprio por cupom). Usar (fonte + loja
  // + código) como antes colidia sempre que duas ofertas da mesma loja não
  // tinham código (ex: só um link promocional) — o segundo cupom sobrescrevia
  // o primeiro em vez de ser tratado como um item novo.
  return createHash("sha256").update(`${fonte}|${urlOrigem}`).digest("hex");
}

async function rodarScraper(scraper: Scraper) {
  console.log(`[${scraper.nome}] iniciando busca...`);

  let cuponsBrutos: Awaited<ReturnType<Scraper["buscarCupons"]>> = [];
  try {
    cuponsBrutos = await scraper.buscarCupons();
  } catch (erro) {
    console.error(`[${scraper.nome}] falhou:`, erro);
    return; // um scraper falhando não deve derrubar os outros
  }

  const agora = new Date().toISOString();

  for (const cupom of cuponsBrutos) {
    const hash = calcularHash(scraper.nome, cupom.urlOrigem);

    // "Upsert": se o cupom já existe (mesmo hash), só atualizamos `vistoEm`
    // e marcamos como ativo de novo. Se não existe, inserimos novo.
    await db
      .insert(cupons)
      .values({
        hash,
        loja: cupom.loja,
        dominio: cupom.lojaDominio ?? null,
        titulo: cupom.titulo,
        codigo: cupom.codigo ?? null,
        desconto: cupom.desconto ?? null,
        expiraEm: cupom.expiraEm ?? null,
        fonte: scraper.nome,
        urlOrigem: cupom.urlOrigem,
        ativo: true,
        vistoEm: agora,
        criadoEm: agora,
      })
      .onConflictDoUpdate({
        target: cupons.hash,
        // Também atualiza `dominio` no conflito — isso faz o backfill de
        // cupons que já existiam antes desse campo ser adicionado, sem
        // precisar apagar e re-popular o banco.
        set: { vistoEm: agora, ativo: true, dominio: cupom.lojaDominio ?? null },
      });
  }

  console.log(`[${scraper.nome}] ${cuponsBrutos.length} cupons processados.`);
}

async function main() {
  for (const scraper of scrapers) {
    await rodarScraper(scraper);
  }

  // Marca como inativo qualquer cupom que não foi visto há mais de 3 dias —
  // sinal de que provavelmente saiu do ar ou expirou.
  const tresDiasAtras = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  await db.run(
    sql`UPDATE cupons SET ativo = 0 WHERE visto_em < ${tresDiasAtras}`
  );

  console.log("Concluído.");
  process.exit(0);
}

main();
