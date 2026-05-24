const state = {
  apiUrl: localStorage.getItem("RPC_API_URL") || window.RPC_API_URL || "https://rpc-team-crm.onrender.com",
  orderSiteUrl: localStorage.getItem("RPC_ORDER_SITE_URL") || window.RPC_ORDER_SITE_URL || "https://rpc-order-website.onrender.com",
  token: localStorage.getItem("RPC_WEB_TOKEN") || "",
  user: null,
  orders: [],
  users: [],
  tasks: [],
  timer: null,
};

const $ = (id) => document.getElementById(id);
const money = (v) => `${Number(v || 0).toLocaleString("ru-RU")} ₽`;
const esc = (s) => String(s ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[c]));

function log(message) {
  const box = $("logBox");
  if (!box) return;
  box.textContent = `[${new Date().toLocaleTimeString()}] ${message}\n` + box.textContent;
}

function roleLevel() {
  return state.user?.role || "guest";
}

function isOwner() { return roleLevel() === "owner"; }
function isOwnerManager() { return ["owner", "manager"].includes(roleLevel()); }

function setRoleVisibility() {
  document.querySelectorAll(".owner-only").forEach(el => el.classList.toggle("hidden-by-role", !isOwner()));
  document.querySelectorAll(".owner-manager-only").forEach(el => el.classList.toggle("hidden-by-role", !isOwnerManager()));
}

function setPage(page) {
  if (!state.token) return;
  document.querySelectorAll(".page").forEach(el => el.classList.remove("active-page"));
  $(`${page}Page`)?.classList.add("active-page");
  document.querySelectorAll(".nav-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.page === page));
  const titles = {dashboard:"Главная", orders:"Заказы", workers:"Рабочие", tasks:"Задачи", system:"Система", settings:"Настройки"};
  $("pageTitle").textContent = titles[page] || "RPC Panel";
}

function showAuth() {
  $("authView").classList.remove("hidden");
  $("appView").classList.add("hidden");
  $("logoutBtn").classList.add("hidden");
  $("profileName").textContent = "Гость";
  $("profileRole").textContent = "offline";
  clearInterval(state.timer);
}

function showApp() {
  $("authView").classList.add("hidden");
  $("appView").classList.remove("hidden");
  $("logoutBtn").classList.remove("hidden");
  $("profileName").textContent = state.user?.name || state.user?.username || "RPC";
  $("profileRole").textContent = `${state.user?.role || "user"} • ${state.user?.approved ? "approved" : "waiting"}`;
  setRoleVisibility();
  setPage("dashboard");
  refreshAll();
  clearInterval(state.timer);
  state.timer = setInterval(refreshSoft, 5000);
}

async function api(path, options = {}) {
  const headers = {...(options.headers || {})};
  if (!(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const res = await fetch(`${state.apiUrl}${path}`, {...options, headers});
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = text; }
  if (!res.ok) {
    const msg = typeof data === "string" ? data : (data.detail || `HTTP ${res.status}`);
    throw new Error(msg);
  }
  return data;
}

async function login(username, password) {
  const data = await api("/auth/login", {method:"POST", body: JSON.stringify({username, email: username, password})});
  state.token = data.access_token;
  state.user = data.user;
  localStorage.setItem("RPC_WEB_TOKEN", state.token);
  log(`Вход: ${state.user.username} / ${state.user.role}`);
  showApp();
}

async function register() {
  const payload = {
    name: $("regName").value.trim(),
    username: $("regUsername").value.trim(),
    email: $("regEmail").value.trim(),
    password: $("regPassword").value,
    role: $("regRole").value,
  };
  const data = await api("/auth/register", {method:"POST", body: JSON.stringify(payload)});
  state.token = data.access_token;
  state.user = data.user;
  localStorage.setItem("RPC_WEB_TOKEN", state.token);
  log(`Регистрация: ${state.user.username} / ${state.user.role}`);
  showApp();
}

async function loadMe() {
  if (!state.token) return showAuth();
  try {
    state.user = await api("/me");
    showApp();
  } catch (e) {
    localStorage.removeItem("RPC_WEB_TOKEN");
    state.token = "";
    showAuth();
  }
}

async function loadOrders() {
  state.orders = await api("/orders");
  renderOrders();
}

async function loadQueueStats() {
  const q = await fetch(`${state.apiUrl}/public/queue`).then(r => r.json());
  $("statTotal").textContent = q.total ?? "—";
  $("statNew").textContent = q.new ?? "—";
  $("statWork").textContent = q.in_work ?? "—";
  $("statSlots").textContent = q.free_slots ?? "—";
}

function renderOrders() {
  const search = ($("orderSearch")?.value || "").toLowerCase();
  const status = $("statusFilter")?.value || "";
  let orders = [...state.orders];
  if (search) orders = orders.filter(o => `${o.client_name} ${o.service} ${o.contact} ${o.notes}`.toLowerCase().includes(search));
  if (status) orders = orders.filter(o => String(o.status || "").toLowerCase() === status.toLowerCase());
  const html = orders.map(orderCard).join("") || emptyCard("Заказов пока нет");
  $("ordersList").innerHTML = html;
  $("latestOrders").innerHTML = state.orders.slice(0, 5).map(orderCard).join("") || emptyCard("Новых заявок нет");
  bindOrderCards();
}

function workerOptions(selectedId = null) {
  const list = state.users.filter(u => ["worker", "manager", "owner"].includes(u.role) && u.is_active && u.approved);
  return [`<option value="">Не назначен</option>`, ...list.map(u => `<option value="${u.id}" ${Number(selectedId) === Number(u.id) ? "selected" : ""}>${esc(u.name || u.username)} • ${esc(u.role)}</option>`)].join("");
}

function orderCard(o) {
  const canAssign = isOwnerManager();
  return `
    <article class="order-card" data-id="${o.id}">
      <div class="card-top">
        <div>
          <div class="card-title">#RPC-${String(o.id).padStart(5, "0")} • ${esc(o.service || "Заказ")}</div>
          <div class="meta">${esc(o.client_name || "Клиент")} • ${esc(o.contact || "контакт не указан")}</div>
        </div>
        <span class="badge">${esc(o.status || "new")}</span>
      </div>
      <div class="card-grid">
        <div class="info-pill"><b>${money(o.price)}</b>Бюджет</div>
        <div class="info-pill"><b>${money(o.prepaid)}</b>Предоплата</div>
        <div class="info-pill"><b>${money(o.rest)}</b>Остаток</div>
        <div class="info-pill"><b>${esc(o.deadline || "—")}</b>Дедлайн</div>
      </div>
      <div class="meta">${esc(o.notes || "Описание не указано")}</div>
      <div class="card-actions">
        <select class="statusSelect">
          ${["new","discussion","waiting_prepay","in_work","review","done","paid","cancelled"].map(s => `<option value="${s}" ${o.status===s?"selected":""}>${s}</option>`).join("")}
        </select>
        <button class="mini-btn saveStatusBtn">Статус</button>
        ${canAssign ? `<select class="assignSelect">${workerOptions(o.worker_id)}</select><button class="mini-btn assignBtn">Назначить</button>` : ""}
      </div>
    </article>`;
}

function bindOrderCards() {
  document.querySelectorAll(".order-card").forEach(card => {
    const id = card.dataset.id;
    card.querySelector(".saveStatusBtn")?.addEventListener("click", async () => {
      const status = card.querySelector(".statusSelect").value;
      try {
        await api(`/orders/${id}/status`, {method:"PATCH", body: JSON.stringify({status})});
        log(`Заказ #${id}: статус ${status}`);
        await refreshSoft();
      } catch (e) { log(`Ошибка статуса #${id}: ${e.message}`); }
    });
    card.querySelector(".assignBtn")?.addEventListener("click", async () => {
      const value = card.querySelector(".assignSelect").value;
      try {
        await api(`/orders/${id}/assign`, {method:"PATCH", body: JSON.stringify({worker_id: value ? Number(value) : null})});
        log(`Заказ #${id}: назначение изменено`);
        await refreshSoft();
      } catch (e) { log(`Ошибка назначения #${id}: ${e.message}`); }
    });
  });
}

async function loadUsers() {
  if (!isOwnerManager()) return;
  state.users = await api("/users");
  renderWorkers();
  renderTaskAssignees();
}

function renderWorkers() {
  const box = $("workersList");
  if (!box) return;
  box.innerHTML = state.users.map(u => `
    <article class="worker-card" data-id="${u.id}">
      <div class="card-top">
        <div><div class="card-title">${esc(u.name || u.username)}</div><div class="meta">${esc(u.username)} • ${esc(u.email || "no email")}</div></div>
        <span class="badge ${u.role === "owner" ? "owner" : (!u.approved ? "wait" : "")}">${esc(u.role)}${u.approved ? "" : " • WAIT"}</span>
      </div>
      <div class="card-actions owner-only">
        <select class="roleSelect">
          ${["worker","manager","owner"].map(r => `<option value="${r}" ${u.role===r?"selected":""}>${r}</option>`).join("")}
        </select>
        <button class="mini-btn roleBtn">Роль</button>
        <button class="mini-btn approveBtn">${u.approved ? "Снять approve" : "Approve"}</button>
        <button class="mini-btn activeBtn">${u.is_active ? "Выключить" : "Включить"}</button>
      </div>
    </article>`).join("") || emptyCard("Рабочих пока нет");
  setRoleVisibility();
  bindWorkerCards();
}

function bindWorkerCards() {
  document.querySelectorAll(".worker-card").forEach(card => {
    const id = card.dataset.id;
    const user = state.users.find(u => Number(u.id) === Number(id));
    card.querySelector(".roleBtn")?.addEventListener("click", async () => {
      try {
        await api(`/users/${id}/role`, {method:"PATCH", body: JSON.stringify({role: card.querySelector(".roleSelect").value})});
        log(`Пользователь #${id}: роль изменена`);
        await loadUsers();
      } catch(e) { log(`Ошибка роли: ${e.message}`); }
    });
    card.querySelector(".approveBtn")?.addEventListener("click", async () => {
      try {
        await api(`/users/${id}/approve`, {method:"PATCH", body: JSON.stringify({approved: !user.approved})});
        log(`Пользователь #${id}: approve изменён`);
        await loadUsers();
      } catch(e) { log(`Ошибка approve: ${e.message}`); }
    });
    card.querySelector(".activeBtn")?.addEventListener("click", async () => {
      try {
        await api(`/users/${id}/active`, {method:"PATCH", body: JSON.stringify({is_active: !user.is_active})});
        log(`Пользователь #${id}: active изменён`);
        await loadUsers();
      } catch(e) { log(`Ошибка active: ${e.message}`); }
    });
  });
}

async function loadTasks() {
  state.tasks = await api("/tasks");
  renderTasks();
}

function renderTaskAssignees() {
  const sel = $("taskAssignee");
  if (!sel) return;
  sel.innerHTML = workerOptions();
}

function renderTasks() {
  $("tasksList").innerHTML = state.tasks.map(t => `
    <article class="task-card" data-id="${t.id}">
      <div class="card-top">
        <div><div class="card-title">${esc(t.title)}</div><div class="meta">${esc(t.description || "Без описания")} ${t.order_id ? `• order #${t.order_id}` : ""}</div></div>
        <span class="badge">${esc(t.status)}</span>
      </div>
      <div class="card-actions">
        <select class="taskStatusSelect">
          ${["not_started","in_work","review","done","cancelled"].map(s => `<option value="${s}" ${t.status===s?"selected":""}>${s}</option>`).join("")}
        </select>
        <button class="mini-btn taskStatusBtn">Сохранить</button>
      </div>
    </article>`).join("") || emptyCard("Задач пока нет");
  document.querySelectorAll(".task-card").forEach(card => {
    const id = card.dataset.id;
    card.querySelector(".taskStatusBtn")?.addEventListener("click", async () => {
      try {
        await api(`/tasks/${id}/status`, {method:"PATCH", body: JSON.stringify({status: card.querySelector(".taskStatusSelect").value})});
        log(`Задача #${id}: статус изменён`);
        await loadTasks();
      } catch(e) { log(`Ошибка задачи: ${e.message}`); }
    });
  });
}

function emptyCard(text) { return `<article class="order-card"><div class="card-title">${esc(text)}</div><div class="meta">Данных нет или сервер недоступен.</div></article>`; }

async function refreshSoft() {
  try {
    await Promise.all([loadQueueStats(), loadOrders(), loadTasks(), isOwnerManager() ? loadUsers() : Promise.resolve()]);
    $("serverLine").textContent = `ONLINE • ${new Date().toLocaleTimeString()}`;
  } catch (e) {
    $("serverLine").textContent = "SYNC ERROR";
    log(`Обновление: ${e.message}`);
  }
}

async function refreshAll() {
  log("Обновляю данные...");
  await refreshSoft();
}

function bindEvents() {
  $("loginTab").onclick = () => { $("loginTab").classList.add("active"); $("registerTab").classList.remove("active"); $("loginForm").classList.remove("hidden"); $("registerForm").classList.add("hidden"); };
  $("registerTab").onclick = () => { $("registerTab").classList.add("active"); $("loginTab").classList.remove("active"); $("registerForm").classList.remove("hidden"); $("loginForm").classList.add("hidden"); };
  $("loginForm").onsubmit = async (e) => {
    e.preventDefault();
    $("authError").classList.add("hidden");
    try { await login($("loginUsername").value.trim(), $("loginPassword").value); }
    catch(err) { $("authError").textContent = err.message; $("authError").classList.remove("hidden"); }
  };
  $("registerForm").onsubmit = async (e) => {
    e.preventDefault();
    $("authError").classList.add("hidden");
    try { await register(); }
    catch(err) { $("authError").textContent = err.message; $("authError").classList.remove("hidden"); }
  };
  document.querySelectorAll(".nav-btn").forEach(btn => btn.addEventListener("click", () => setPage(btn.dataset.page)));
  $("logoutBtn").onclick = () => { localStorage.removeItem("RPC_WEB_TOKEN"); state.token = ""; state.user = null; showAuth(); };
  $("refreshBtn").onclick = refreshAll;
  $("dashReload").onclick = refreshAll;
  $("clearLogBtn").onclick = () => $("logBox").textContent = "";
  $("openOrderSiteBtn").onclick = () => window.open(state.orderSiteUrl, "_blank");
  $("openDocsBtn").onclick = () => window.open(`${state.apiUrl}/docs`, "_blank");
  $("orderSearch").oninput = renderOrders;
  $("statusFilter").onchange = renderOrders;
  $("loadWorkersBtn").onclick = loadUsers;
  $("taskForm").onsubmit = async (e) => {
    e.preventDefault();
    try {
      await api("/tasks", {method:"POST", body: JSON.stringify({
        title: $("taskTitle").value.trim(),
        deadline: $("taskDeadline").value.trim(),
        assignee_id: $("taskAssignee").value ? Number($("taskAssignee").value) : null,
        priority: $("taskPriority").value,
      })});
      $("taskTitle").value = "";
      log("Задача создана");
      await loadTasks();
    } catch(e) { log(`Ошибка создания задачи: ${e.message}`); }
  };
  $("checkApiBtn").onclick = async () => {
    try { const d = await fetch(`${state.apiUrl}/`).then(r => r.json()); $("apiStatus").textContent = `${d.status} • ${d.version}`; log("Сервер online"); }
    catch(e) { $("apiStatus").textContent = e.message; }
  };
  $("checkDbBtn").onclick = async () => {
    try { const d = await api("/admin/database/status"); $("dbStatus").textContent = `${d.mode} • ${d.persistent ? "persistent" : "temporary"}`; log("База проверена"); }
    catch(e) { $("dbStatus").textContent = e.message; }
  };
  $("testTgBtn").onclick = async () => {
    try { await api("/admin/telegram/test", {method:"POST", body:"{}"}); $("tgStatus").textContent = "OK, сообщение отправлено"; log("Telegram test OK"); }
    catch(e) { $("tgStatus").textContent = e.message; }
  };
  $("syncOwnersBtn").onclick = async () => {
    try { const d = await api("/admin/env/owners/sync", {method:"POST", body:"{}"}); log(`Env owners sync: emails=${d.owner_emails}, usernames=${d.owner_usernames}`); await loadUsers(); }
    catch(e) { log(`Env owners sync error: ${e.message}`); }
  };
  $("apiInput").value = state.apiUrl;
  $("orderSiteInput").value = state.orderSiteUrl;
  $("saveSettingsBtn").onclick = () => {
    state.apiUrl = $("apiInput").value.trim().replace(/\/$/, "");
    state.orderSiteUrl = $("orderSiteInput").value.trim().replace(/\/$/, "");
    localStorage.setItem("RPC_API_URL", state.apiUrl);
    localStorage.setItem("RPC_ORDER_SITE_URL", state.orderSiteUrl);
    log("Настройки сохранены");
  };
}

bindEvents();
loadMe();
