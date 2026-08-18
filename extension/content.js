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
    .aviso-falha {
      display: flex; justify-content: space-between; align-items: center; gap: 6px;
      background: #fff3cd; color: #7a5b00; border: 1px solid #ffe08a; border-radius: 6px;
      padding: 4px 6px; font-size: 11px; margin: 4px 0;
    }
    .remover-aviso {
      border: none; background: transparent; cursor: pointer; font-size: 12px;
      color: #7a5b00; padding: 0 2px; line-height: 1;
    }
    .marcar-falha {
      border: none; background: transparent; cursor: pointer; font-size: 10px;
      color: #aaa; text-decoration: underline; padding: 0; margin-left: 4px;
    }
    .marcar-falha:hover { color: #b91c1c; }
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

    chrome.runtime.sendMessage({ tipo: "BUSCAR_CUPONS", dominio: hostname }, async (resposta) => {
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

      const falhas = await carregarFalhas();

      painel.innerHTML = `<h3>Cupons — ${hostname} (${resposta.cupons.length})</h3>`;
      for (const cupom of resposta.cupons) {
        painel.appendChild(criarItemCupom(cupom, falhas[cupom.id] ?? null));
      }
    });
  }

  function criarItemCupom(cupom, falhaInfo) {
    const item = document.createElement("div");
    item.className = "cupom";

    const acoesHtml = cupom.codigo
      ? `<span class="cupom-codigo">${escaparHtml(cupom.codigo)}</span>
         <div class="acoes">
           <button class="botao-acao aplicar">Aplicar</button>
           <a class="botao-acao" href="${escaparAtributo(cupom.urlOrigem)}" target="_blank" rel="noopener noreferrer">Abrir</a>
         </div>`
      : `<span class="fonte">Sem código</span>
         <a class="botao-acao" href="${escaparAtributo(cupom.urlOrigem)}" target="_blank" rel="noopener noreferrer">Abrir oferta</a>`;

    item.innerHTML = `
      <div class="cupom-titulo">${escaparHtml(cupom.titulo)}</div>
      <div class="cupom-linha">${acoesHtml}</div>
      <div class="fonte">via ${escaparHtml(cupom.fonte)} <button class="marcar-falha">não funcionou</button></div>
    `;

    // Mostra o aviso ANTES do usuário decidir clicar em "Aplicar" — é o que
    // foi pedido: guardar que um cupom não funcionou e avisar da próxima
    // vez, pra não perder tempo tentando o mesmo código de novo.
    if (falhaInfo) {
      item.querySelector(".cupom-titulo").after(criarAvisoFalha(cupom, falhaInfo.quando));
    }

    const botaoAplicar = item.querySelector(".aplicar");
    if (botaoAplicar) {
      botaoAplicar.addEventListener("click", () => aplicarOuCopiar(cupom, botaoAplicar));
    }

    item.querySelector(".marcar-falha").addEventListener("click", async () => {
      await marcarComoFalhou(cupom);
      if (!item.querySelector(".aviso-falha")) {
        item.querySelector(".cupom-titulo").after(criarAvisoFalha(cupom, new Date().toISOString()));
      }
    });

    return item;
  }

  function criarAvisoFalha(cupom, quandoIso) {
    const aviso = document.createElement("div");
    aviso.className = "aviso-falha";
    aviso.innerHTML = `⚠️ Marcado como "não funcionou" em ${formatarData(quandoIso)} <button class="remover-aviso" title="Remover aviso">✕</button>`;
    aviso.querySelector(".remover-aviso").addEventListener("click", async () => {
      await removerMarcacaoFalha(cupom.id);
      aviso.remove();
    });
    return aviso;
  }

  function formatarData(iso) {
    try {
      return new Date(iso).toLocaleDateString("pt-BR");
    } catch {
      return "";
    }
  }

  // Histórico de cupons marcados como "não funcionou", guardado em
  // chrome.storage.local (persiste entre sessões do navegador, mas fica só
  // nessa máquina — não sincroniza com storage.sync de propósito, já que é
  // um dado de uso, não de configuração). Chave por `cupom.id` (o id do
  // banco do dashboard, estável entre rodadas do scraper pelo mesmo hash de
  // dedup — ver scraper-runner.ts).
  const CHAVE_STORAGE_FALHAS = "cuponsFalharam";

  async function carregarFalhas() {
    const resultado = await chrome.storage.local.get(CHAVE_STORAGE_FALHAS);
    return resultado[CHAVE_STORAGE_FALHAS] ?? {};
  }

  async function marcarComoFalhou(cupom) {
    const falhas = await carregarFalhas();
    falhas[cupom.id] = {
      quando: new Date().toISOString(),
      dominio: hostname,
      titulo: cupom.titulo,
    };
    await chrome.storage.local.set({ [CHAVE_STORAGE_FALHAS]: falhas });
  }

  async function removerMarcacaoFalha(cupomId) {
    const falhas = await carregarFalhas();
    delete falhas[cupomId];
    await chrome.storage.local.set({ [CHAVE_STORAGE_FALHAS]: falhas });
  }

  function mostrarFeedback(botao, texto, duracaoMs = 2500) {
    const original = "Aplicar";
    botao.textContent = texto;
    botao.classList.add("copiado");
    setTimeout(() => {
      botao.textContent = original;
      botao.classList.remove("copiado");
    }, duracaoMs);
  }

  // Tenta preencher e aplicar o cupom direto na página atual. Se não achar
  // um campo que pareça ser de cupom (loja não coberta, checkout não
  // carregado, etc.), cai pro comportamento antigo: copia pro clipboard e
  // avisa que não achou o campo.
  async function aplicarOuCopiar(cupom, botao) {
    const campo = encontrarCampoCupom();

    if (campo) {
      preencherCampo(campo, cupom.codigo);
      campo.scrollIntoView({ behavior: "smooth", block: "center" });
      campo.focus();

      const botaoDaPagina = encontrarBotaoAplicar(campo);
      if (botaoDaPagina) {
        botaoDaPagina.click();
        mostrarFeedback(botao, "Aplicado!");
      } else {
        mostrarFeedback(botao, "Preenchido — clique em aplicar", 3500);
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(cupom.codigo);
      mostrarFeedback(botao, "Copiado (não achei o campo)", 3500);
    } catch {
      mostrarFeedback(botao, "Falhou :(");
    }
  }

  // Heurística genérica: em vez de mapear o campo de cupom loja por loja
  // (frágil, e inviável de verificar em todas sem logar numa conta de
  // verdade em cada uma), procura por qualquer input de texto visível cujo
  // id/name/placeholder/aria-label/label associado combine com um padrão
  // comum de "campo de cupom" em português/inglês/espanhol.
  const REGEX_CAMPO_CUPOM = /cupom|cup[oó]n|coupon|voucher|c[oó]digo\s*promo|promo\s*code|gift\s*card/i;
  const REGEX_BOTAO_APLICAR = /aplicar|usar\s*cupom|apply|resgatar|confirmar|^ok$/i;

  function encontrarCampoCupom() {
    const candidatos = document.querySelectorAll(
      'input[type="text"], input[type="search"], input:not([type])'
    );

    for (const input of candidatos) {
      if (!ehVisivel(input)) continue;

      const pistas = [
        input.id,
        input.name,
        input.placeholder,
        input.getAttribute("aria-label"),
        rotuloAssociado(input),
      ]
        .filter(Boolean)
        .join(" ");

      if (REGEX_CAMPO_CUPOM.test(pistas)) return input;
    }

    return null;
  }

  function rotuloAssociado(input) {
    if (input.id) {
      const label = document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
      if (label) return label.textContent ?? "";
    }
    const labelPai = input.closest("label");
    return labelPai ? labelPai.textContent ?? "" : "";
  }

  function ehVisivel(elemento) {
    const retangulo = elemento.getBoundingClientRect();
    const estilo = getComputedStyle(elemento);
    return (
      retangulo.width > 0 &&
      retangulo.height > 0 &&
      estilo.visibility !== "hidden" &&
      estilo.display !== "none"
    );
  }

  // Muitos sites (React, Vue etc.) sobrescrevem o setter de `value` do input
  // pra manter o estado interno do framework sincronizado com o que
  // aparece na tela. Atribuir `input.value = x` direto muda só o que
  // aparece — o framework nunca fica sabendo, e ao clicar "aplicar" ele
  // manda o valor antigo (vazio). Usar o setter *nativo* do protótipo e
  // depois disparar os eventos manualmente é o jeito de contornar isso.
  function preencherCampo(input, valor) {
    const setterNativo = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    ).set;
    setterNativo.call(input, valor);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function encontrarBotaoAplicar(campo) {
    let container = campo.parentElement;

    // Sobe até 5 níveis a partir do campo — checkouts costumam agrupar
    // campo + botão de aplicar num container próximo (um form, uma div
    // "aplicar cupom" etc.), não em qualquer lugar da página.
    for (let nivel = 0; container && nivel < 5; nivel++, container = container.parentElement) {
      const botoes = container.querySelectorAll('button, input[type="submit"], a[role="button"]');
      for (const botao of botoes) {
        const texto = botao.textContent || botao.value || "";
        if (REGEX_BOTAO_APLICAR.test(texto)) return botao;
      }
    }

    return null;
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
