import { db } from "@/db/client";
import { cupons } from "@/db/schema";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { FiltroLoja } from "./FiltroLoja";

// Server Component: esse código roda no servidor a cada request e busca
// direto do SQLite — não existe um "fetch" pro cliente, o Next já manda o
// HTML pronto. É a vantagem de usar Next.js aqui em vez de montar uma API
// REST separada só pra alimentar essa tela.
//
// `searchParams` chega como Promise no Next 15 — o filtro de loja (ver
// FiltroLoja.tsx) manda pra cá via "/?loja=Nome da Loja".
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ loja?: string }>;
}) {
  const { loja: lojaSelecionada } = await searchParams;

  // Lojas com cupom ativo, pra popular o filtro — sempre com todas as opções
  // disponíveis, independente do filtro atualmente aplicado.
  const lojasDisponiveis = await db
    .select({ loja: cupons.loja, total: sql<number>`count(*)` })
    .from(cupons)
    .where(eq(cupons.ativo, true))
    .groupBy(cupons.loja)
    .orderBy(asc(cupons.loja));

  const condicoes = lojaSelecionada
    ? and(eq(cupons.ativo, true), eq(cupons.loja, lojaSelecionada))
    : eq(cupons.ativo, true);

  const cuponsAtivos = await db
    .select()
    .from(cupons)
    .where(condicoes)
    .orderBy(asc(cupons.loja), desc(cupons.vistoEm));

  // Agrupa por loja pra exibir em seções — a ordenação já veio do banco
  // (alfabética por loja), então só precisamos preservar a ordem aqui.
  const cuponsPorLoja = new Map<string, typeof cuponsAtivos>();
  for (const cupom of cuponsAtivos) {
    const grupo = cuponsPorLoja.get(cupom.loja) ?? [];
    grupo.push(cupom);
    cuponsPorLoja.set(cupom.loja, grupo);
  }

  return (
    <main>
      <h1>PromoDevs 🏷️</h1>
      <p className="subtitulo">
        {cuponsAtivos.length} cupons ativos, agregados de{" "}
        {new Set(cuponsAtivos.map((c) => c.fonte)).size} fonte(s).
      </p>

      <FiltroLoja lojas={lojasDisponiveis} lojaSelecionada={lojaSelecionada} />

      {cuponsAtivos.length === 0 ? (
        <div className="vazio">
          {lojaSelecionada ? (
            `Nenhum cupom ativo para "${lojaSelecionada}".`
          ) : (
            <>
              Nenhum cupom ainda. Rode <code>npm run scrape</code> pra popular
              o banco.
            </>
          )}
        </div>
      ) : (
        [...cuponsPorLoja.entries()].map(([loja, cuponsDaLoja]) => (
          <section key={loja} className="secao-loja">
            <h2 className="titulo-loja">
              {loja}{" "}
              <span className="contagem-loja">({cuponsDaLoja.length})</span>
            </h2>
            <div className="grid">
              {cuponsDaLoja.map((cupom) => (
                <a
                  key={cupom.id}
                  href={cupom.urlOrigem}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cupom-card"
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <div>
                    <div className="cupom-titulo">{cupom.titulo}</div>
                    <div className="cupom-fonte">via {cupom.fonte}</div>
                  </div>
                  {cupom.codigo && (
                    <div className="cupom-codigo">{cupom.codigo}</div>
                  )}
                </a>
              ))}
            </div>
          </section>
        ))
      )}
    </main>
  );
}
