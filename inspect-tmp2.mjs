import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
});

const apiCalls = [];
page.on("request", (req) => {
  const url = req.url();
  if (url.includes("api") || url.includes("cupom") || url.includes("coupon")) {
    apiCalls.push(url);
  }
});

await page.goto("https://www.promobit.com.br/cupons/", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(2000);

// scroll to bottom a few times to trigger lazy load
for (let i = 0; i < 5; i++) {
  await page.mouse.wheel(0, 3000);
  await page.waitForTimeout(1500);
}

console.log("Captured calls:\n" + apiCalls.join("\n"));

await browser.close();
