// Content script — roda nas páginas das lojas listadas em
// manifest.json > content_scripts.matches. Não faz fetch direto pro
// dashboard (isso é feito pelo background.js, ver comentário lá); aqui só
// desenha o widget e delega a busca.
(function () {
  const hostname = location.hostname.replace(/^www\./, "");

  // Isola o widget do CSS da página host com Shadow DOM — sem isso, o botão
  // e o painel ficariam à mercê dos estilos globais de cada loja.
  const raiz = document.createElement("div");
  raiz.id = "promodevs-widget-root";
  raiz.style.all = "initial";
  document.documentElement.appendChild(raiz);
  const sombra = raiz.attachShadow({ mode: "open" });

  const estilo = document.createElement("style");
  estilo.textContent = `
    :host, * { box-sizing: border-box; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
    .botao {
      position: fixed; bottom: 20px; right: 20px; z-index: 2147483647;
      background: #1a1a1a; color: white; border: none; border-radius: 999px;
      padding: 10px 16px; font-size: 14px; cursor: pointer;
      box-shadow: 0 2px 10px rgba(0,0,0,0.25);
    }
    .painel {
      position: fixed; bottom: 70px; right: 20px; z-index: 2147483647;
      width: 320px; max-height: 60vh; overflow-y: auto;
      background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      padding: 12px; display: none;
    }
    .painel.aberto { display: block; }
    .painel h3 { margin: 0 0 8px; font-size: 14px; color: #1a1a1a; }
    .cupom { border: 1px solid #e2e2e5; border-radius: 8px; padding: 8px 10px; margin-bottom: 8px; }
    .cupom-titulo { font-size: 12px; color: #333; margin-bottom: 6px; line-height: 1.3; }
    .cupom-linha { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    .cupom-codigo { font-family: monospace; font-size: 13px; background: #f0f0f2; padding: 2px 6px; border-radius: 6px; }
    .acoes { display: flex; gap: 6px; }
    .botao-acao {
      border: 1px solid #d5d5d9; background: white; border-radius: 6px;
      padding: 4px 8px; font-size: 12px; cursor: pointer; text-decoration: none; color: #1a1a1a;
    }
    .botao-acao.copiado { background: #16a34a; color: white; border-color: #16a34a; }
    .vazio, .carregando, .erro { font-size: 13px; color: #666; padding: 4px 0 8px; }
    .erro { color: #b91c1c; }
    .fonte { font-size: 10px; color: #999; margin-top: 2px; }
  `;
  sombra.appendChild(estilo);

  const botao = document.createElement("button");
  botao.className = "botao";
  botao.textContent = "🏷️ Cupons";
  sombra.appendChild(botao);

  const painel = document.createElement("div");
  painel.className = "painel";
  sombra.appendChild(painel);

  let carregado = false;

  botao.addEventListener("click", () => {
    painel.classList.toggle("aberto");
    if (!painel.classList.contains("aberto") || carregado) return;
    carregado = true;
    buscarCupons();
  });

  function buscarCupons() {
    painel.innerHTML = `<h3>Cupons — ${hostname}</h3><div class="carregando">Buscando…</div>`;

    chrome.runtime.sendMessage({ tipo: "BUSCAR_CUPONS", dominio: hostname }, (resposta) => {
      if (chrome.runtime.lastError) {
        painel.innerHTML = `<h3>Cupons — ${hostname}</h3><div class="erro">Erro de comunicação com a extensão: ${escaparHtml(
          chrome.runtime.lastError.message
        )}</div>`;
        return;
      }

      if (!resposta?.ok) {
        painel.innerHTML = `<h3>Cupons — ${hostname}</h3><div class="erro">Não consegui buscar os cupons (${escaparHtml(
          resposta?.erro ?? "erro desconhecido"
        )}). O dashboard PromoDevs (npm run dev) está rodando? Confira a URL nas opções da extensão.</div>`;
        return;
      }

      if (resposta.cupons.length === 0) {
        painel.innerHTML = `<h3>Cupons — ${hostname}</h3><div class="vazio">Nenhum cupom ativo pra essa loja no momento.</div>`;
        return;
      }

      painel.innerHTML = `<h3>Cupons — ${hostname} (${resposta.cupons.length})</h3>`;
      for (const cupom of resposta.cupons) {
        painel.appendChild(criarItemCupom(cupom));
      }
    });
  }

  function criarItemCupom(cupom) {
    const item = document.createElement("div");
    item.className = "cupom";

    const acoesHtml = cupom.codigo
      ? `<span class="cupom-codigo">${escaparHtml(cupom.codigo)}</span>
         <div class="acoes">
           <button class="botao-acao copiar">Copiar</button>
           <a class="botao-acao" href="${escaparAtributo(cupom.urlOrigem)}" target="_blank" rel="noopener noreferrer">Abrir</a>
         </div>`
      : `<span class="fonte">Sem código</span>
         <a class="botao-acao" href="${escaparAtributo(cupom.urlOrigem)}" target="_blank" rel="noopener noreferrer">Abrir oferta</a>`;

    item.innerHTML = `
      <div class="cupom-titulo">${escaparHtml(cupom.titulo)}</div>
      <div class="cupom-linha">${acoesHtml}</div>
      <div class="fonte">via ${escaparHtml(cupom.fonte)}</div>
    `;

    const botaoCopiar = item.querySelector(".copiar");
    if (botaoCopiar) {
      botaoCopiar.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(cupom.codigo);
          botaoCopiar.textContent = "Copiado!";
          botaoCopiar.classList.add("copiado");
          setTimeout(() => {
            botaoCopiar.textContent = "Copiar";
            botaoCopiar.classList.remove("copiado");
          }, 1500);
        } catch {
          botaoCopiar.textContent = "Falhou :(";
        }
      });
    }

    return item;
  }

  function escaparHtml(texto) {
    const div = document.createElement("div");
    div.textContent = texto ?? "";
    return div.innerHTML;
  }

  function escaparAtributo(texto) {
    return escaparHtml(texto).replace(/"/g, "&quot;");
  }
})();
