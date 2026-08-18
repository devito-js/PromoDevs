import { db } from "@/db/client";
import { cupons } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

// Server Component: esse código roda no servidor a cada request e busca
// direto do SQLite — não existe um "fetch" pro cliente, o Next já manda o
// HTML pronto. É a vantagem de usar Next.js aqui em vez de montar uma API
// REST separada só pra alimentar essa tela.
export default async function Home() {
  const cuponsAtivos = await db
    .select()
    .from(cupons)
    .where(eq(cupons.ativo, true))
    .orderBy(desc(cupons.vistoEm));

  return (
    <main>
      <h1>PromoDevs 🏷️</h1>
      <p className="subtitulo">
        {cuponsAtivos.length} cupons ativos, agregados de {" "}
        {new Set(cuponsAtivos.map((c) => c.fonte)).size} fonte(s).
      </p>

      {cuponsAtivos.length === 0 ? (
        <div className="vazio">
          Nenhum cupom ainda. Rode <code>npm run scrape</code> pra popular o
          banco.
        </div>
      ) : (
        <div className="grid">
          {cuponsAtivos.map((cupom) => (
            <a
              key={cupom.id}
              href={cupom.urlOrigem}
              target="_blank"
              rel="noopener noreferrer"
              className="cupom-card"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div>
                <div className="cupom-loja">{cupom.loja}</div>
                <div className="cupom-titulo">{cupom.titulo}</div>
                <div className="cupom-fonte">via {cupom.fonte}</div>
              </div>
              {cupom.codigo && (
                <div className="cupom-codigo">{cupom.codigo}</div>
              )}
            </a>
          ))}
        </div>
      )}
    </main>
  );
}
