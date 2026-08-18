# PromoDevs — extensão de navegador

Mostra os cupons ativos (do seu dashboard PromoDevs, rodando localmente) num
botão flutuante na página da loja que você está visitando. Você clica em
"Copiar" pra testar o cupom no checkout — a extensão não aplica nada
sozinha, você continua no controle.

## Como funciona

- O `content.js` roda nas páginas das lojas listadas em
  `manifest.json > content_scripts.matches` e desenha um botão "🏷️ Cupons"
  no canto da tela.
- Ao clicar, ele pede pro `background.js` (service worker) buscar os cupons
  daquele domínio na rota `/api/cupons?dominio=...` do dashboard Next.js —
  isso roda fora da página visitada, então não esbarra em CORS/CSP do site
  da loja.
- O painel lista os cupons com um botão "Copiar" (código pra área de
  transferência) e "Abrir" (leva pra página de origem do cupom).

## Instalar (modo desenvolvedor)

1. Rode o dashboard: `npm run dev` (precisa estar rodando pra extensão
   funcionar — por padrão ela busca em `http://localhost:3000`).
2. Abra `chrome://extensions` (ou `edge://extensions`).
3. Ative o "Modo do desenvolvedor" (canto superior direito).
4. Clique em "Carregar sem compactação" e selecione esta pasta
   (`extension/`).
5. Visite uma loja coberta (ex: mercadolivre.com.br, amazon.com.br,
   shopee.com.br) e clique no botão "🏷️ Cupons" no canto inferior direito.

Se o dashboard estiver rodando em outra URL/porta, ajuste em
"Opções" da extensão (clique direito no ícone > Opções).

## Limitações conhecidas (é um MVP)

- **Lista de lojas é estática.** `manifest.json` só injeta o botão nos
  domínios listados em `content_scripts.matches`. Quando um scraper novo
  trouxer lojas novas pro banco, essa lista precisa ser atualizada à mão
  aqui (o manifest não lê o banco — é um arquivo estático avaliado antes de
  qualquer requisição).
- **Só localhost por padrão.** `host_permissions` no manifest só libera
  `http://localhost/*` e `http://127.0.0.1/*`. Se você apontar a extensão
  pra um dashboard hospedado em outro domínio, o fetch do `background.js`
  vai falhar por falta de permissão — precisaria adicionar esse host no
  manifest.
- **Não aplica cupom sozinha.** De propósito — testar cupons automaticamente
  no checkout de uma loja de verdade (login, requisições em sequência) é o
  tipo de padrão que sistemas antifraude são treinados pra pegar. Essa
  versão só facilita você testar manualmente, com um clique.
