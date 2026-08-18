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
- O painel lista os cupons com um botão "Aplicar" e "Abrir" (leva pra
  página de origem do cupom).
- "Aplicar" tenta achar um campo de cupom na página atual (heurística
  genérica: procura por inputs de texto visíveis cujo id/name/placeholder/
  label combine com "cupom", "coupon", "voucher", "código promocional"
  etc. — ver `encontrarCampoCupom()` em `content.js`), preenche o valor
  (do jeito que frameworks como React reconhecem, não só visualmente) e
  clica num botão de "Aplicar"/"Confirmar" próximo, se achar um. Quando
  não acha nenhum campo compatível na página (loja não coberta, campo
  fora da tela ainda, checkout que exige login antes de mostrar o campo
  etc.), cai pro comportamento antigo: copia o código pro clipboard e
  avisa que não achou o campo — você cola manualmente.

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

## Testes

`npm run test:extension` roda `content.js` de verdade (não uma
reimplementação) contra duas páginas de teste locais em
`extension/tests/fixtures/`: uma com um campo de cupom "controlado" (estilo
React) e outra sem nenhum campo — confirma que o preenchimento programático
funciona de verdade e que o fallback pra copiar entra em ação quando não há
campo. Não substitui testar contra uma loja real, só garante que o mecanismo
central não quebrou.

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
- **Aplica só o cupom que você escolher, um de cada vez.** De propósito —
  testar todos os cupons automaticamente, em sequência, sem você escolher
  (tipo Honey/Coupert) é o tipo de padrão que sistemas antifraude de
  checkout são treinados pra pegar. Essa versão só automatiza o "colar e
  confirmar" do cupom que você já escolheu clicando.
- **A heurística de achar o campo é genérica, não por loja.** Não foi
  verificada contra o checkout de verdade de cada uma das 23 lojas — várias
  delas só mostram o campo de cupom depois de login + itens no carrinho, o
  que não dá pra inspecionar sem uma conta real. Foi validada com um teste
  controlado (`npm run test:extension`) que simula um campo de formulário
  "controlado" (estilo React) e confere que o preenchimento programático
  realmente atualiza o estado interno, não só a aparência — mas o "achar o
  campo certo" depende de cada site ter texto reconhecível (cupom/coupon/
  voucher) perto do campo. Quando não acha, cai pro fallback de copiar.
