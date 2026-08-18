import { chromium } from "playwright";
import fs from "node:fs";

const browser = await chromium.launch();
const page = await browser.newPage({
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
});
await page.goto("https://www.promobit.com.br/cupons/", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(3000);

const html = await page.content();
console.log("HTML length:", html.length);

fs.writeFileSync("./inspect-out.html", html);

const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 500));
console.log("BODY TEXT SAMPLE:\n", bodyText);

await browser.close();
