let API_URL = localStorage.getItem("RPC_API_URL") || window.RPC_API_URL || "https://rpc-team-crm.onrender.com";
let MAIN_URL = localStorage.getItem("RPC_MAIN_SITE_URL") || window.RPC_MAIN_SITE_URL || "";
let PORTAL_URL = localStorage.getItem("RPC_CLIENT_PORTAL_URL") || window.RPC_CLIENT_PORTAL_URL || "";
let RENDER_URL = localStorage.getItem("RPC_RENDER_DASHBOARD_URL") || window.RPC_RENDER_DASHBOARD_URL || "https://dashboard.render.com/";
let token = localStorage.getItem("RPC_ADMIN_TOKEN") || "";

const $ = (id) => document.getElementById(id);

function log(msg) {
  const box = $("logBox");
  if (!box) return;
  box.textContent = `[${new Date().toLocaleTimeString()}] ${msg}\n` + box.textContent;
}

function setInputs() {
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
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = text; }
  if (!res.ok) throw new Error(typeof data === "string" ? data : (data.detail || `HTTP ${res.status}`));
  return data;
}

function showLogin() {
  $("loginPage").classList.remove("hidden");
  document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
  $("logoutBtn").classList.add("hidden");
}

function showApp() {
  $("loginPage").classList.add("hidden");
  $("dashboardPage").classList.remove("hidden");
  $("logoutBtn").classList.remove("hidden");
}

function switchPage(page) {
  if (!token) return showLogin();
  document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
  $(`${page}Page`).classList.remove("hidden");
  document.querySelectorAll(".navBtn").forEach(b => b.classList.toggle("active", b.dataset.page === page));

  const titles = {
    dashboard: ["Панель управления", "Контроль сервера, заказов, базы и Telegram."],
    orders: ["Заказы", "Заявки клиентов и статусы."],
    workers: ["Работники", "Команда и роли CRM."],
    notify: ["Уведомления", "Telegram и будущие уведомления клиентам."],
    settings: ["Настройки", "Адреса сайтов и сервера."]
  };
  $("pageTitle").textContent = titles[page][0];
  $("pageSubtitle").textContent = titles[page][1];
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
    const data = await api("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });
    token = data.access_token;
    localStorage.setItem("RPC_ADMIN_TOKEN", token);
    $("profileName").textContent = username;
    showApp();
    log(`Вход выполнен: ${username}`);
    refreshAll();
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
    log(`Сервер ошибка: ${e.message}`);
  }
}

async function checkDb() {
  try {
    const d = await api("/admin/database/status");
    $("dbStatus").textContent = d.persistent ? "POSTGRESQL" : "SQLITE";
    $("dbInfo").textContent = d.persistent ? "Постоянная база включена" : "DATABASE_URL не подключен";
    log(`База: ${JSON.stringify(d)}`);
  } catch (e) {
    $("dbStatus").textContent = "ERROR";
    $("dbInfo").textContent = e.message;
    log(`БД ошибка: ${e.message}`);
  }
}

async function testTelegram() {
  try {
    const d = await api("/admin/telegram/test", { method: "POST", body: JSON.stringify({}) });
    $("telegramStatus").textContent = "OK";
    log(`Telegram тест: ${JSON.stringify(d)}`);
  } catch (e) {
    $("telegramStatus").textContent = "ERROR";
    log(`Telegram ошибка: ${e.message}`);
  }
}

function renderOrders(arr, target) {
  if (!arr.length) {
    target.innerHTML = `<div class="cardItem"><div><h3>Заказов пока нет</h3><p>Когда клиент оставит заявку, она появится здесь.</p></div></div>`;
    return;
  }
  target.innerHTML = arr.slice(0, 8).map(o => `
    <div class="row">
      <b>#${o.id || "—"}</b>
      <div>${o.title || o.service || o.name || "Заказ RPC"}</div>
      <span class="tag">${o.status || "new"}</span>
      <span>${o.price || o.budget || ""}</span>
    </div>
  `).join("");
}

async function loadOrders() {
  const target = $("ordersList");
  const dash = $("dashboardOrders");
  target.innerHTML = `<div class="cardItem"><div><h3>Загрузка...</h3></div></div>`;
  try {
    let d;
    try { d = await api("/orders"); } catch { d = await api("/public/queue"); }
    const arr = Array.isArray(d) ? d : (d.orders || []);
    $("ordersCount").textContent = arr.length;
    $("todayCount").textContent = arr.length;
    $("newCount").textContent = arr.filter(x => String(x.status || "").toLowerCase().includes("new")).length;
    $("doneCount").textContent = arr.filter(x => String(x.status || "").toLowerCase().includes("done") || String(x.status || "").toLowerCase().includes("готов")).length;

    target.innerHTML = arr.length ? arr.map(o => `
      <div class="cardItem">
        <div>
          <h3>${o.title || o.service || o.name || "Заказ RPC"} #${o.id || ""}</h3>
          <p>${o.notes || o.description || o.client_name || "Без описания"}</p>
          <span class="tag">${o.status || "new"}</span>
        </div>
        <b>${o.price || o.budget || ""}</b>
      </div>
    `).join("") : `<div class="cardItem"><div><h3>Заказов пока нет</h3></div></div>`;
    renderOrders(arr, dash);
    log(`Заказы загружены: ${arr.length}`);
  } catch (e) {
    target.innerHTML = `<div class="cardItem"><div><h3>Ошибка</h3><p>${e.message}</p></div></div>`;
    dash.innerHTML = `<div class="cardItem"><div><h3>Ошибка</h3><p>${e.message}</p></div></div>`;
    log(`Заказы ошибка: ${e.message}`);
  }
}

async function loadWorkers() {
  const target = $("workersList");
  target.innerHTML = `<div class="cardItem"><div><h3>Загрузка...</h3></div></div>`;
  try {
    let d;
    try { d = await api("/users"); } catch { d = await api("/workers"); }
    const arr = Array.isArray(d) ? d : (d.users || d.workers || []);
    target.innerHTML = arr.length ? arr.map(u => `
      <div class="cardItem">
        <div><h3>${u.name || u.username || "Worker"}</h3><p>${u.email || ""}</p></div>
        <span class="tag">${u.role || "worker"}</span>
      </div>
    `).join("") : `<div class="cardItem"><div><h3>Работников не найдено</h3><p>Или endpoint пока не добавлен на сервер.</p></div></div>`;
    log(`Работники загружены: ${arr.length}`);
  } catch (e) {
    target.innerHTML = `<div class="cardItem"><div><h3>Ошибка</h3><p>${e.message}</p></div></div>`;
  }
}

async function refreshAll() {
  await checkServer();
  await checkDb();
  await loadOrders();
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
  setInputs();
  log("Настройки сохранены.");
}

function boot() {
  setInputs();
  $("loginBtn").onclick = login;
  $("logoutBtn").onclick = () => { token = ""; localStorage.removeItem("RPC_ADMIN_TOKEN"); showLogin(); };
  $("saveApiUrlBtn").onclick = () => { API_URL = $("apiUrlInput").value.trim().replace(/\/$/, ""); localStorage.setItem("RPC_API_URL", API_URL); setInputs(); log(`API URL: ${API_URL}`); };

  document.querySelectorAll(".navBtn").forEach(btn => btn.onclick = () => switchPage(btn.dataset.page));
  $("checkServerBtn").onclick = checkServer;
  $("checkDbBtn").onclick = checkDb;
  $("testTelegramBtn").onclick = testTelegram;
  $("notifyTelegramBtn").onclick = testTelegram;
  $("refreshAllBtn").onclick = refreshAll;
  $("quickLoadOrdersBtn").onclick = loadOrders;
  $("dashboardLoadOrdersBtn").onclick = loadOrders;
  $("loadOrdersBtn").onclick = loadOrders;
  $("loadWorkersBtn").onclick = loadWorkers;
  $("clearLogBtn").onclick = () => $("logBox").textContent = "";
  $("saveSettingsBtn").onclick = saveSettings;

  $("openDocsBtn").onclick = () => window.open(`${API_URL}/docs`, "_blank");
  $("openApiBtn").onclick = () => window.open(API_URL, "_blank");
  $("openMainSiteBtn").onclick = () => window.open(MAIN_URL, "_blank");
  $("openPortalBtn").onclick = () => window.open(PORTAL_URL, "_blank");
  $("openRenderBtn").onclick = () => window.open(RENDER_URL, "_blank");

  if (token) showApp(); else showLogin();
}

boot();
