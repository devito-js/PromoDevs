import cron from "node-cron";
import { execSync } from "node:child_process";

// Roda a cada 3 horas. Sintaxe cron: minuto hora dia mês dia-da-semana
// "0 */3 * * *" = no minuto 0, de 3 em 3 horas
const AGENDA = "0 */3 * * *";

console.log(`Agendador iniciado. Vai rodar o scraper na agenda: "${AGENDA}"`);

cron.schedule(AGENDA, () => {
  console.log(`[${new Date().toISOString()}] Rodando scrapers...`);
  try {
    execSync("npm run scrape", { stdio: "inherit" });
  } catch (erro) {
    console.error("Erro ao rodar scraper agendado:", erro);
  }
});

// Roda uma vez imediatamente ao iniciar, sem esperar o primeiro tick da agenda
execSync("npm run scrape", { stdio: "inherit" });
