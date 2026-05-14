let API_URL = localStorage.getItem("RPC_API_URL") || window.RPC_API_URL || "https://rpc-team-crm.onrender.com";
let MAIN_URL = localStorage.getItem("RPC_MAIN_SITE_URL") || window.RPC_MAIN_SITE_URL || "";
let PORTAL_URL = localStorage.getItem("RPC_CLIENT_PORTAL_URL") || window.RPC_CLIENT_PORTAL_URL || "";
let RENDER_URL = localStorage.getItem("RPC_RENDER_DASHBOARD_URL") || window.RPC_RENDER_DASHBOARD_URL || "https://dashboard.render.com/";
let token = localStorage.getItem("RPC_ADMIN_TOKEN") || "";

const $ = (id) => document.getElementById(id);

function log(msg) {
  const box = $("logBox");
  if (!box) return;
  const time = new Date().toLocaleTimeString();
  box.textContent = `[${time}] ${msg}\n` + box.textContent;
}

function setApiInputs() {
  $("apiUrlInput").value = API_URL;
  $("settingsApiUrl").value = API_URL;
  $("settingsMainUrl").value = MAIN_URL;
  $("settingsPortalUrl").value = PORTAL_URL;
  $("settingsRenderUrl").value = RENDER_URL;
}

async function api(path, options = {}) {
  const headers = options.headers || {};
  headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = text; }

  if (!res.ok) {
    throw new Error(typeof data === "string" ? data : (data.detail || `HTTP ${res.status}`));
  }
  return data;
}

function showApp() {
  $("loginPage").classList.add("hidden");
  $("dashboardPage").classList.remove("hidden");
  $("logoutBtn").classList.remove("hidden");
}

function showLogin() {
  $("loginPage").classList.remove("hidden");
  document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
  $("logoutBtn").classList.add("hidden");
}

function switchPage(page) {
  if (!token) return showLogin();
  document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
  $(`${page}Page`).classList.remove("hidden");
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.page === page));
}

async function login() {
  $("loginError").classList.add("hidden");
  const username = $("username").value.trim();
  const password = $("password").value;
  if (!username || !password) {
    $("loginError").textContent = "Введи логин и пароль.";
    $("loginError").classList.remove("hidden");
    return;
  }

  try {
    const data = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });
    token = data.access_token;
    localStorage.setItem("RPC_ADMIN_TOKEN", token);
    showApp();
    log(`Вход выполнен: ${username}`);
    await refreshAll();
  } catch (e) {
    $("loginError").textContent = e.message;
    $("loginError").classList.remove("hidden");
  }
}

async function checkServer() {
  try {
    const res = await fetch(`${API_URL}/`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    $("serverStatus").textContent = "ONLINE";
    log("Сервер онлайн.");
  } catch (e) {
    $("serverStatus").textContent = "OFFLINE";
    log(`Ошибка сервера: ${e.message}`);
  }
}

async function checkDb() {
  try {
    const data = await api("/admin/database/status");
    $("dbStatus").textContent = data.persistent ? "POSTGRESQL" : "SQLITE";
    $("dbInfo").textContent = data.persistent ? "Постоянная база включена." : "DATABASE_URL не подключен.";
    log(`База: ${JSON.stringify(data)}`);
  } catch (e) {
    $("dbStatus").textContent = "ERROR";
    $("dbInfo").textContent = e.message;
    log(`Ошибка БД: ${e.message}`);
  }
}

async function testTelegram() {
  try {
    const data = await api("/admin/telegram/test", { method: "POST", body: JSON.stringify({}) });
    $("telegramStatus").textContent = "OK";
    log(`Telegram тест: ${JSON.stringify(data)}`);
  } catch (e) {
    $("telegramStatus").textContent = "ERROR";
    log(`Telegram ошибка: ${e.message}`);
  }
}

async function refreshAll() {
  await checkServer();
  await checkDb();
}

async function loadOrders() {
  const box = $("ordersList");
  box.innerHTML = `<div class="item">Загрузка...</div>`;
  try {
    let data;
    try { data = await api("/orders"); }
    catch { data = await api("/public/queue"); }

    const arr = Array.isArray(data) ? data : (data.orders || []);
    if (!arr.length) {
      box.innerHTML = `<div class="item">Заказов пока нет.</div>`;
      return;
    }

    box.innerHTML = arr.map(o => `
      <div class="item">
        <h3>${o.title || o.service || "Заказ"} #${o.id || ""}</h3>
        <span class="tag">${o.status || "new"}</span>
        <span class="tag">${o.client_name || o.client || "Клиент"}</span>
        <p class="muted">${o.notes || o.description || ""}</p>
      </div>
    `).join("");
    log(`Заказы загружены: ${arr.length}`);
  } catch (e) {
    box.innerHTML = `<div class="item">Ошибка: ${e.message}</div>`;
  }
}

async function loadWorkers() {
  const box = $("workersList");
  box.innerHTML = `<div class="item">Загрузка...</div>`;
  try {
    let data;
    try { data = await api("/users"); }
    catch { data = await api("/workers"); }

    const arr = Array.isArray(data) ? data : (data.users || data.workers || []);
    if (!arr.length) {
      box.innerHTML = `<div class="item">Работников не найдено или endpoint пока не добавлен.</div>`;
      return;
    }

    box.innerHTML = arr.map(u => `
      <div class="item">
        <h3>${u.name || u.username || "Worker"}</h3>
        <span class="tag">${u.role || "worker"}</span>
        <p class="muted">${u.email || ""}</p>
      </div>
    `).join("");
    log(`Работники загружены: ${arr.length}`);
  } catch (e) {
    box.innerHTML = `<div class="item">Ошибка: ${e.message}</div>`;
  }
}

function saveSettings() {
  API_URL = $("settingsApiUrl").value.trim().replace(/\/$/, "");
  MAIN_URL = $("settingsMainUrl").value.trim();
  PORTAL_URL = $("settingsPortalUrl").value.trim();
  RENDER_URL = $("settingsRenderUrl").value.trim();

  localStorage.setItem("RPC_API_URL", API_URL);
  localStorage.setItem("RPC_MAIN_SITE_URL", MAIN_URL);
  localStorage.setItem("RPC_CLIENT_PORTAL_URL", PORTAL_URL);
  localStorage.setItem("RPC_RENDER_DASHBOARD_URL", RENDER_URL);
  setApiInputs();
  log("Настройки сохранены.");
}

function boot() {
  setApiInputs();

  $("loginBtn").onclick = login;
  $("logoutBtn").onclick = () => {
    token = "";
    localStorage.removeItem("RPC_ADMIN_TOKEN");
    showLogin();
  };

  $("saveApiUrlBtn").onclick = () => {
    API_URL = $("apiUrlInput").value.trim().replace(/\/$/, "");
    localStorage.setItem("RPC_API_URL", API_URL);
    setApiInputs();
    log(`API URL сохранён: ${API_URL}`);
  };

  document.querySelectorAll(".nav-btn").forEach(btn => btn.onclick = () => switchPage(btn.dataset.page));

  $("checkServerBtn").onclick = checkServer;
  $("checkDbBtn").onclick = checkDb;
  $("testTelegramBtn").onclick = testTelegram;
  $("refreshAllBtn").onclick = refreshAll;
  $("clearLogBtn").onclick = () => $("logBox").textContent = "";

  $("loadOrdersBtn").onclick = loadOrders;
  $("loadWorkersBtn").onclick = loadWorkers;
  $("saveSettingsBtn").onclick = saveSettings;

  $("openDocsBtn").onclick = () => window.open(`${API_URL}/docs`, "_blank");
  $("openApiBtn").onclick = () => window.open(API_URL, "_blank");
  $("openMainSiteBtn").onclick = () => window.open(MAIN_URL, "_blank");
  $("openPortalBtn").onclick = () => window.open(PORTAL_URL, "_blank");
  $("openRenderBtn").onclick = () => window.open(RENDER_URL, "_blank");

  if (token) showApp(); else showLogin();
}

boot();
