const DASHBOARD_URL_PADRAO = "http://localhost:3000";

const input = document.getElementById("dashboard-url");
const status = document.getElementById("status");

chrome.storage.sync.get("dashboardUrl", ({ dashboardUrl }) => {
  input.value = dashboardUrl || DASHBOARD_URL_PADRAO;
});

document.getElementById("salvar").addEventListener("click", () => {
  const valor = input.value.trim().replace(/\/$/, "") || DASHBOARD_URL_PADRAO;
  chrome.storage.sync.set({ dashboardUrl: valor }, () => {
    status.textContent = "Salvo!";
    setTimeout(() => (status.textContent = ""), 1500);
  });
});
