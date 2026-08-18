# PromoDevs

Bot pessoal que agrega cupons de desconto de vários sites e mostra num dashboard próprio.

## Stack

- **Scraper**: `fetch` + `cheerio` (troque para Playwright se o site carregar conteúdo via JS)
- **Validação**: Zod
- **Banco**: SQLite via Drizzle ORM
- **Dashboard**: Next.js (App Router, Server Components)
- **Agendamento**: node-cron

## Como rodar

```bash
npm install
cp .env.example .env

# Cria as tabelas no SQLite
npm run db:push

# Roda os scrapers uma vez (popula o banco)
npm run scrape

# Sobe o dashboard em http://localhost:3000
npm run dev
```

Para deixar rodando o scraper automaticamente de tempos em tempos (em outro terminal):

```bash
npm run scrape:watch
```

Pra ver os dados direto no banco, sem precisar escrever SQL:

```bash
npm run db:studio
```

## Estrutura

```
src/
  scrapers/
    types.ts       -> interface comum que todo scraper implementa
    promobit.ts     -> scraper de exemplo (AJUSTE OS SELETORES, veja comentários no arquivo)
  db/
    schema.ts       -> definição da tabela `cupons`
    client.ts        -> conexão com o SQLite
  scraper-runner.ts -> roda todos os scrapers e salva/atualiza no banco
  scheduler.ts       -> agenda a execução periódica (cron)
app/
  page.tsx           -> dashboard (lê direto do banco, sem API intermediária)
```

## Adicionando um novo agregador (ex: Pelando)

1. Crie `src/scrapers/pelando.ts` implementando a interface `Scraper` (veja `types.ts`)
2. Importe e adicione no array `scrapers` em `src/scraper-runner.ts`
3. Pronto — o banco e o dashboard já funcionam sem nenhuma outra mudança

## Avisos importantes

- **Seletores CSS são placeholders.** Cada site muda o HTML com frequência —
  inspecione a página real antes de rodar em produção (veja comentários em `promobit.ts`).
- **Respeite o `robots.txt` e os Termos de Serviço** de cada site antes de rodar o scraper com frequência.
- Se um site bloquear `fetch` simples (Cloudflare, captcha, conteúdo via JS), o próximo passo
  natural é trocar esse scraper específico para **Playwright**, que abre um navegador de verdade.
