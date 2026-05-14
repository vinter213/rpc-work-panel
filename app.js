let API_URL = localStorage.getItem("RPC_API_URL") || window.RPC_API_URL || "https://rpc-team-crm.onrender.com";
let MAIN_URL = localStorage.getItem("RPC_MAIN_SITE_URL") || window.RPC_MAIN_SITE_URL || "https://rpc-order-website.onrender.com";
let PORTAL_URL = localStorage.getItem("RPC_CLIENT_PORTAL_URL") || window.RPC_CLIENT_PORTAL_URL || "https://rpc-client-portal.onrender.com";
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
  if ($("settingsApiUrl")) $("settingsApiUrl").value = API_URL;
  if ($("settingsMainUrl")) $("settingsMainUrl").value = MAIN_URL;
  if ($("settingsPortalUrl")) $("settingsPortalUrl").value = PORTAL_URL;
  if ($("settingsRenderUrl")) $("settingsRenderUrl").value = RENDER_URL;
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
    log("Сервер ONLINE");
  } catch (e) {
    $("serverStatus").textContent = "OFFLINE";
    log(`Ошибка сервера: ${e.message}`);
  }
}

async function checkDb() {
  try {
    const d = await api("/admin/database/status");
    $("dbStatus").textContent = d.persistent ? "PostgreSQL" : "SQLite";
    $("dbInfo").textContent = d.persistent ? "Подключение успешно" : "DATABASE_URL не подключен";
    log(`База: ${JSON.stringify(d)}`);
  } catch (e) {
    $("dbStatus").textContent = "ERROR";
    $("dbInfo").textContent = e.message;
    log(`Ошибка БД: ${e.message}`);
  }
}

async function testTelegram() {
  try {
    const d = await api("/admin/telegram/test", { method: "POST", body: JSON.stringify({}) });
    $("telegramStatus").textContent = "OK";
    log(`Telegram OK: ${JSON.stringify(d)}`);
  } catch (e) {
    $("telegramStatus").textContent = "ERROR";
    log(`Telegram ошибка: ${e.message}`);
  }
}

function fallbackOrders() {
  return [
    { id: 7231, service: "Optimization", client_name: "@darkfire", price: "700 ₽", status: "НОВЫЙ", date: "2 мин назад" },
    { id: 7230, service: "Avatar Upload", client_name: "@neonwave", price: "500 ₽", status: "В РАБОТЕ", date: "15 мин назад" },
    { id: 7229, service: "Quest Adaptation", client_name: "@quantum", price: "1 000 ₽", status: "ВЫПОЛНЕНО", date: "42 мин назад" },
    { id: 7228, service: "Shading / FX", client_name: "@pixelghost", price: "1 500 ₽", status: "В РАБОТЕ", date: "1 ч назад" },
    { id: 7227, service: "World / Unity", client_name: "@vr_soul", price: "3 000 ₽", status: "НОВЫЙ", date: "2 ч назад" }
  ];
}

function renderDashboardOrders(arr) {
  const box = $("dashboardOrders");
  box.innerHTML = arr.slice(0, 6).map(o => `
    <div class="row">
      <span>#${o.id || "—"}</span>
      <span>${o.service || o.title || o.name || "RPC Order"}</span>
      <span>${o.client_name || o.client || o.username || "@client"}</span>
      <span>${o.price || o.budget || "—"}</span>
      <span><em class="tag">${o.status || "НОВЫЙ"}</em></span>
      <span>${o.date || o.created_at || "сейчас"}</span>
    </div>
  `).join("");
}

async function loadOrders() {
  try {
    let d;
    try { d = await api("/orders"); } catch { d = await api("/public/queue"); }
    const arr = (Array.isArray(d) ? d : (d.orders || []));
    const orders = arr.length ? arr : fallbackOrders();

    $("ordersCount").textContent = orders.length;
    $("todayCount").textContent = orders.length;
    $("newCountInline").textContent = orders.filter(x => String(x.status || "").toLowerCase().includes("new") || String(x.status || "").toLowerCase().includes("нов")).length || 4;
    renderDashboardOrders(orders);

    const list = $("ordersList");
    if (list) {
      list.innerHTML = orders.map(o => `
        <div class="card-item">
          <div>
            <h3>#${o.id || "—"} ${o.service || o.title || o.name || "RPC Order"}</h3>
            <p>${o.client_name || o.client || ""} • ${o.date || o.created_at || ""}</p>
          </div>
          <span class="tag">${o.status || "НОВЫЙ"}</span>
        </div>
      `).join("");
    }
    log(`Заказы загружены: ${orders.length}`);
  } catch (e) {
    const orders = fallbackOrders();
    renderDashboardOrders(orders);
    $("ordersCount").textContent = orders.length;
    log(`Заказы показаны демо, API ошибка: ${e.message}`);
  }
}

async function loadWorkers() {
  const demo = [
    { username: "RedPad", role: "Администратор" },
    { username: "Ghost", role: "Модератор" },
    { username: "Neon", role: "Исполнитель" },
    { username: "Slime", role: "Исполнитель" }
  ];

  try {
    let d;
    try { d = await api("/users"); } catch { d = await api("/workers"); }
    const arr = (Array.isArray(d) ? d : (d.users || d.workers || []));
    renderWorkers(arr.length ? arr : demo);
    log(`Работники загружены: ${(arr.length ? arr : demo).length}`);
  } catch (e) {
    renderWorkers(demo);
    log(`Работники демо, API ошибка: ${e.message}`);
  }
}

function renderWorkers(arr) {
  const list = $("workersList");
  if (!list) return;
  list.innerHTML = arr.map(u => `
    <div class="card-item">
      <div>
        <h3>${u.name || u.username || "Worker"}</h3>
        <p>${u.role || "worker"}</p>
      </div>
      <span class="tag">${u.status || "ONLINE"}</span>
    </div>
  `).join("");
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
  log("Настройки сохранены");
}

function bind() {
  setInputs();

  $("loginBtn").onclick = login;
  $("logoutBtn").onclick = () => {
    token = "";
    localStorage.removeItem("RPC_ADMIN_TOKEN");
    showLogin();
  };

  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.onclick = () => switchPage(btn.dataset.page);
  });

  $("saveApiUrlBtn").onclick = () => {
    API_URL = $("apiUrlInput").value.trim().replace(/\/$/, "");
    localStorage.setItem("RPC_API_URL", API_URL);
    setInputs();
    log(`API URL сохранён: ${API_URL}`);
  };

  $("checkServerBtn").onclick = checkServer;
  $("checkDbBtn").onclick = checkDb;
  $("testTelegramBtn").onclick = testTelegram;
  $("notifyTelegramBtn").onclick = testTelegram;
  $("quickLoadOrdersBtn").onclick = loadOrders;
  $("dashboardLoadOrdersBtn").onclick = loadOrders;
  $("loadOrdersBtn").onclick = loadOrders;
  $("loadWorkersBtn").onclick = loadWorkers;
  $("loadWorkersFullBtn").onclick = loadWorkers;
  $("clearLogBtn").onclick = () => $("logBox").textContent = "";
  $("saveSettingsBtn").onclick = saveSettings;

  $("openDocsBtn").onclick = () => window.open(`${API_URL}/docs`, "_blank");
  $("openApiBtn").onclick = () => window.open(API_URL, "_blank");
  $("openMainSiteBtn").onclick = () => window.open(MAIN_URL, "_blank");
  $("openRenderBtn").onclick = () => window.open(RENDER_URL, "_blank");

  if (token) {
    showApp();
    refreshAll();
  } else {
    showLogin();
    renderDashboardOrders(fallbackOrders());
  }
}

bind();
