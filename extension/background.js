// Service worker (Manifest V3). Faz o fetch pro dashboard PromoDevs em nome
// do content script: rodando aqui, fora da isolated world da página, a
// requisição não esbarra em CORS/CSP da página visitada — só precisa que o
// host do dashboard esteja em `host_permissions` no manifest.json.

const DASHBOARD_URL_PADRAO = "http://localhost:3000";

chrome.runtime.onMessage.addListener((mensagem, _remetente, responder) => {
  if (mensagem?.tipo !== "BUSCAR_CUPONS") return;

  (async () => {
    const { dashboardUrl } = await chrome.storage.sync.get("dashboardUrl");
    const base = (dashboardUrl || DASHBOARD_URL_PADRAO).replace(/\/$/, "");

    try {
      const resposta = await fetch(
        `${base}/api/cupons?dominio=${encodeURIComponent(mensagem.dominio)}`
      );

      if (!resposta.ok) {
        responder({ ok: false, erro: `dashboard respondeu ${resposta.status}` });
        return;
      }

      const dados = await resposta.json();
      responder({ ok: true, cupons: dados.cupons ?? [] });
    } catch (erro) {
      responder({ ok: false, erro: String(erro?.message ?? erro) });
    }
  })();

  return true; // mantém o canal de mensagem aberto pra resposta assíncrona
});
