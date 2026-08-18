// Testes do mecanismo de "aplicar cupom" do content.js — carrega o arquivo
// de verdade (não uma reimplementação) em duas páginas de teste locais e
// verifica o comportamento fim a fim, sem precisar de um site real nem de
// login em conta nenhuma:
//
//  1. checkout-com-campo.html: tem um input "controlado" (o estado interno
//     só atualiza via listener de 'input', simulando React/Vue) — confirma
//     que o preenchimento programático dispara os eventos certos e não é
//     só cosmético, e que o botão "Aplicar" da página é encontrado e
//     clicado.
//  2. checkout-sem-campo.html: não tem nenhum campo de cupom — confirma que
//     o fallback (copiar pro clipboard) entra em ação em vez de falhar
//     silenciosamente.
//
// Rodar com: npm run test:extension
import { chromium } from "playwright";
import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTENT_JS = path.resolve(__dirname, "../content.js");

// Registra o stub de window.chrome já com o código do cupom embutido.
// Importante: `addInitScript` serializa a função via toString() e a
// reavalia numa realm nova — closures do lado Node.js (ex: `codigo` vindo
// de fora) não sobrevivem a isso. Por isso passamos `codigo` como segundo
// argumento de `addInitScript`, que o Playwright injeta corretamente, em
// vez de capturar via closure.
function registrarStubChrome(page, codigo) {
  return page.addInitScript((codigoCupom) => {
    window.chrome = {
      runtime: {
        sendMessage(_msg, callback) {
          callback({
            ok: true,
            cupons: [
              {
                id: 1,
                loja: "Loja de teste",
                titulo: "10% OFF em tudo",
                codigo: codigoCupom,
                desconto: "10% OFF",
                urlOrigem: "https://example.com/cupom",
                fonte: "teste",
              },
            ],
          });
        },
      },
    };
  }, codigo);
}

async function abrirPainelEClicarAplicar(page) {
  await page.addScriptTag({ path: CONTENT_JS });
  await page.waitForFunction(() => !!document.getElementById("promodevs-widget-root")?.shadowRoot);

  await page.evaluate(() => {
    document.getElementById("promodevs-widget-root").shadowRoot.querySelector(".botao").click();
  });
  // Espera o painel de fato renderizar o(s) cupom(ns) — a resposta do
  // background é assíncrona mesmo quando o stub chama o callback "na hora".
  await page.waitForFunction(() => {
    const sombra = document.getElementById("promodevs-widget-root")?.shadowRoot;
    return !!sombra?.querySelector(".painel .cupom");
  });

  await page.evaluate(() => {
    document.getElementById("promodevs-widget-root").shadowRoot.querySelector(".aplicar")?.click();
  });
  // Espera o texto do botão sair do estado inicial "Aplicar" (o click
  // dispara mostrarFeedback(), que troca o texto de forma síncrona).
  await page.waitForFunction(() => {
    const botao = document.getElementById("promodevs-widget-root")?.shadowRoot?.querySelector(".aplicar");
    return !!botao && botao.textContent !== "Aplicar";
  });

  return page.evaluate(() => {
    const b = document.getElementById("promodevs-widget-root").shadowRoot.querySelector(".aplicar");
    return b ? b.textContent : null;
  });
}

async function testeComCampo(context) {
  const page = await context.newPage();
  await registrarStubChrome(page, "TESTE123");
  await page.goto("file://" + path.resolve(__dirname, "fixtures/checkout-com-campo.html"));

  const textoBotao = await abrirPainelEClicarAplicar(page);

  const resultado = await page.evaluate(() => ({
    valorInterno: window.__estadoInterno.valorReal,
    campoValueVisual: document.getElementById("campo-desconto").value,
    botaoClicado: window.__botaoAplicarClicado === true,
  }));

  await page.close();

  const ok =
    resultado.valorInterno === "TESTE123" &&
    resultado.campoValueVisual === "TESTE123" &&
    resultado.botaoClicado === true &&
    textoBotao === "Aplicado!";

  return {
    nome: "campo React-like é preenchido e botão 'Aplicar' da página é clicado",
    ok,
    detalhes: { ...resultado, textoBotao },
  };
}

async function testeSemCampo(context) {
  const page = await context.newPage();
  await registrarStubChrome(page, "SEMFORM10");
  await page.goto("file://" + path.resolve(__dirname, "fixtures/checkout-sem-campo.html"));

  const textoBotao = await abrirPainelEClicarAplicar(page);
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());

  await page.close();

  const ok = clipboard === "SEMFORM10" && /não achei o campo/i.test(textoBotao ?? "");

  return {
    nome: "sem campo de cupom na página, cai pro fallback de copiar",
    ok,
    detalhes: { clipboard, textoBotao },
  };
}

const browser = await chromium.launch();
const context = await browser.newContext();
await context.grantPermissions(["clipboard-read", "clipboard-write"]);

const resultados = [await testeComCampo(context), await testeSemCampo(context)];

await browser.close();

let todosPassaram = true;
for (const r of resultados) {
  const status = r.ok ? "✅" : "❌";
  console.log(`${status} ${r.nome}`);
  if (!r.ok) {
    console.log("   detalhes:", JSON.stringify(r.detalhes));
    todosPassaram = false;
  }
}

process.exit(todosPassaram ? 0 : 1);
