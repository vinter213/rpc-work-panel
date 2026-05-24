(() => {
  const cfg = window.RPC_CONFIG || {};
  const API = (cfg.API_URL || "https://rpc-team-crm.onrender.com").replace(/\/$/, "");
  const REFRESH_MS = cfg.REFRESH_MS || 5000;

  const $ = (id) => document.getElementById(id);
  const state = {
    token: localStorage.getItem("rpc_token") || "",
    user: JSON.parse(localStorage.getItem("rpc_user") || "null"),
    orders: [],
    users: [],
    tasks: [],
    activeView: "dashboard"
  };

  function msg(el, text, type="") {
    if (!el) return;
    el.textContent = text || "";
    el.className = "message " + type;
  }

  async function api(path, options = {}) {
    const headers = {"Content-Type":"application/json", ...(options.headers || {})};
    if (state.token) headers.Authorization = `Bearer ${state.token}`;
    const res = await fetch(API + path, {...options, headers});
    let data = null;
    const text = await res.text();
    try { data = text ? JSON.parse(text) : null; } catch { data = {detail:text}; }
    if (!res.ok) {
      const detail = data?.detail || data?.message || `HTTP ${res.status}`;
      throw new Error(Array.isArray(detail) ? detail.map(x=>x.msg||JSON.stringify(x)).join(", ") : detail);
    }
    return data;
  }

  function saveSession(token, user) {
    state.token = token;
    state.user = user;
    localStorage.setItem("rpc_token", token);
    localStorage.setItem("rpc_user", JSON.stringify(user));
  }

  function clearSession() {
    state.token = "";
    state.user = null;
    localStorage.removeItem("rpc_token");
    localStorage.removeItem("rpc_user");
  }

  function role() {
    return String(state.user?.role || "").toLowerCase();
  }

  function isOwner() { return role() === "owner"; }
  function isManager() { return role() === "manager"; }
  function canManage() { return isOwner() || isManager(); }

  function applyRoleVisibility() {
    document.querySelectorAll(".owner-only").forEach(el => el.style.display = isOwner() ? "" : "none");
    document.querySelectorAll(".owner-manager-only").forEach(el => el.style.display = canManage() ? "" : "none");
  }

  function showDashboard() {
    $("authScreen").classList.add("hidden");
    $("dashboardScreen").classList.remove("hidden");
    $("profileName").textContent = state.user?.name || state.user?.username || "RPC User";
    $("profileRole").textContent = `${state.user?.role || "worker"} • Online`;
    $("welcomeTitle").textContent = `Welcome back, ${state.user?.name || state.user?.username || "RPC User"} 👋`;
    applyRoleVisibility();
    loadAll();
  }

  function showAuth() {
    $("authScreen").classList.remove("hidden");
    $("dashboardScreen").classList.add("hidden");
  }

  function setAuthTab(tab) {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.authTab === tab));
    $("loginForm").classList.toggle("hidden", tab !== "login");
    $("registerForm").classList.toggle("hidden", tab !== "register");
    msg($("authMessage"), "");
  }

  function safe(v, fallback="—") {
    return (v === null || v === undefined || v === "") ? fallback : String(v);
  }

  function statusClass(status) {
    const s = String(status || "").toLowerCase();
    if (s.includes("complete") || s.includes("done")) return "completed";
    if (s.includes("cancel")) return "cancelled";
    if (s.includes("new")) return "new";
    return "";
  }

  function statusText(status) {
    const map = {
      new: "New",
      in_progress: "In progress",
      completed: "Completed",
      cancelled: "Cancelled",
      pending: "Pending"
    };
    return map[status] || safe(status, "New");
  }

  function renderOrders() {
    const q = $("searchInput").value.trim().toLowerCase();
    const filter = $("statusFilter").value;
    const list = $("ordersList");
    const items = state.orders.filter(o => {
      const hay = JSON.stringify(o).toLowerCase();
      const okQ = !q || hay.includes(q);
      const okF = !filter || String(o.status || "").toLowerCase() === filter;
      return okQ && okF;
    });

    if (!items.length) {
      list.innerHTML = `<div class="order-card"><b>Заказов пока нет</b><span class="hint">Создай тестовую заявку с сайта или через кнопку + Order.</span></div>`;
      return;
    }

    list.innerHTML = items.map(o => {
      const id = o.id ?? o.order_id ?? "";
      const client = o.client_name || o.name || o.customer_name || "Client";
      const service = o.service || o.title || "Service";
      const budget = o.budget || o.price || o.amount || "—";
      const status = o.status || "new";
      const assigned = o.assigned_to_name || o.worker_name || o.assigned_to || "not assigned";
      return `
        <div class="order-card">
          <div class="order-top">
            <div>
              <div class="order-id">#RPC-${safe(id)}</div>
              <b>${escapeHtml(service)}</b>
            </div>
            <span class="badge ${statusClass(status)}">● ${escapeHtml(statusText(status))}</span>
          </div>
          <div class="order-meta">
            <span>Client: ${escapeHtml(client)}</span>
            <span>Budget: ${escapeHtml(String(budget))}</span>
            <span>Worker: ${escapeHtml(String(assigned))}</span>
            <span>${escapeHtml(o.created_at || o.date || "")}</span>
          </div>
          <div class="card-actions">
            ${canManage() ? `<button onclick="RPC.assignOrder('${id}')">Assign</button>` : ""}
            <button onclick="RPC.changeStatus('${id}','in_progress')">In progress</button>
            <button onclick="RPC.changeStatus('${id}','completed')">Complete</button>
            <button onclick="RPC.changeStatus('${id}','cancelled')">Cancel</button>
          </div>
        </div>
      `;
    }).join("");
  }

  function renderWorkers() {
    const list = $("workersList");
    const workers = state.users.filter(u => ["worker","manager","owner"].includes(String(u.role||"").toLowerCase()));
    $("statWorkers").textContent = workers.length;

    if (!workers.length) {
      list.innerHTML = `<div class="worker-card"><b>Рабочих пока нет</b><span class="hint">Пусть worker зарегистрируется, потом Owner подтвердит аккаунт.</span></div>`;
      return;
    }

    list.innerHTML = workers.map(u => {
      const active = u.is_active !== false;
      const approved = u.approved !== false;
      return `
        <div class="worker-card">
          <div class="worker-top">
            <div class="worker-main">
              <img class="worker-avatar" src="rpc-avatar.png" alt="">
              <div>
                <b>${escapeHtml(u.name || u.username || "Worker")}</b>
                <div class="worker-role">${escapeHtml(u.role || "worker")} • ${approved ? "approved" : "waiting"} • ${active ? "active" : "disabled"}</div>
              </div>
            </div>
            <span class="badge ${active && approved ? "completed" : "new"}">${active && approved ? "Online" : "Locked"}</span>
          </div>
          ${isOwner() ? `
          <div class="card-actions">
            <button onclick="RPC.approveUser('${u.id}', true)">Approve</button>
            <button onclick="RPC.toggleUser('${u.id}', ${!active})">${active ? "Disable" : "Enable"}</button>
            <button onclick="RPC.setRole('${u.id}', 'worker')">Worker</button>
            <button onclick="RPC.setRole('${u.id}', 'manager')">Manager</button>
            <button onclick="RPC.setRole('${u.id}', 'owner')">Owner</button>
          </div>` : ""}
        </div>
      `;
    }).join("");

    const assignee = $("taskAssignee");
    assignee.innerHTML = `<option value="">Без назначения</option>` + workers.map(u => `<option value="${u.id}">${escapeHtml(u.name || u.username || u.email || u.id)}</option>`).join("");
  }

  function renderTasks() {
    const list = $("tasksList");
    $("statTasks").textContent = state.tasks.length;
    if (!state.tasks.length) {
      list.innerHTML = `<div class="task-card"><b>Задач пока нет</b><span class="hint">Owner/Manager может создать задачу.</span></div>`;
      return;
    }
    list.innerHTML = state.tasks.map(t => `
      <div class="task-card">
        <div class="task-top">
          <b>${escapeHtml(t.title || "Task")}</b>
          <span class="badge ${statusClass(t.status)}">${escapeHtml(statusText(t.status || "new"))}</span>
        </div>
        <span class="hint">${escapeHtml(t.description || "")}</span>
        <div class="card-actions">
          <button onclick="RPC.changeTaskStatus('${t.id}','in_progress')">In progress</button>
          <button onclick="RPC.changeTaskStatus('${t.id}','completed')">Complete</button>
        </div>
      </div>
    `).join("");
  }

  function renderStats() {
    $("statOrders").textContent = state.orders.length;
  }

  async function loadHealth() {
    try {
      const data = await api("/");
      $("statServer").textContent = "Online";
      $("serverVersion").textContent = data.version || data.status || "connected";
      $("systemStatus").textContent = "All Systems Operational";
    } catch (e) {
      $("statServer").textContent = "Offline";
      $("serverVersion").textContent = "backend error";
      $("systemStatus").textContent = "Server Error";
    }
  }

  async function loadOrders() {
    try { state.orders = await api("/orders"); }
    catch(e) { state.orders = []; console.warn(e); }
    renderOrders(); renderStats();
  }

  async function loadUsers() {
    if (!canManage()) { state.users = []; renderWorkers(); return; }
    try { state.users = await api("/users"); }
    catch(e) { state.users = []; console.warn(e); }
    renderWorkers();
  }

  async function loadTasks() {
    try { state.tasks = await api("/tasks"); }
    catch(e) { state.tasks = []; console.warn(e); }
    renderTasks();
  }

  async function loadAll() {
    if (!state.token) return;
    await Promise.all([loadHealth(), loadOrders(), loadUsers(), loadTasks()]);
  }

  function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  }

  async function login(ev) {
    ev.preventDefault();
    msg($("authMessage"), "Вход...");
    try {
      const data = await api("/auth/login", {
        method:"POST",
        body:JSON.stringify({
          username: $("loginUsername").value.trim(),
          password: $("loginPassword").value
        })
      });
      saveSession(data.access_token || data.token, data.user || data);
      msg($("authMessage"), "Успешный вход", "ok");
      showDashboard();
    } catch(e) {
      msg($("authMessage"), e.message, "bad");
    }
  }

  async function register(ev) {
    ev.preventDefault();
    msg($("authMessage"), "Создаю аккаунт...");
    try {
      const data = await api("/auth/register", {
        method:"POST",
        body:JSON.stringify({
          name: $("regName").value.trim(),
          email: $("regEmail").value.trim(),
          username: $("regUsername").value.trim(),
          password: $("regPassword").value,
          role: "worker"
        })
      });
      msg($("authMessage"), data.message || "Аккаунт создан. Жди подтверждения Owner.", "ok");
      setAuthTab("login");
      $("loginUsername").value = $("regEmail").value.trim();
    } catch(e) {
      msg($("authMessage"), e.message, "bad");
    }
  }

  async function createOrder(ev) {
    ev.preventDefault();
    try {
      await api("/public/order", {
        method:"POST",
        body:JSON.stringify({
          client_name: $("orderClientName").value,
          contact: $("orderContact").value,
          service: $("orderService").value,
          budget: $("orderBudget").value,
          price: $("orderBudget").value,
          description: $("orderDescription").value
        })
      });
      $("orderModal").close();
      $("orderForm").reset();
      await loadOrders();
    } catch(e) { alert(e.message); }
  }

  async function createTask(ev) {
    ev.preventDefault();
    try {
      await api("/tasks", {
        method:"POST",
        body:JSON.stringify({
          title: $("taskTitle").value,
          description: $("taskDescription").value,
          assigned_to: $("taskAssignee").value || null
        })
      });
      $("taskModal").close();
      $("taskForm").reset();
      await loadTasks();
    } catch(e) { alert(e.message); }
  }

  async function safePost(path, body={}, ok="Готово") {
    msg($("actionMessage"), "Запрос...");
    try {
      const data = await api(path, {method:"POST", body:JSON.stringify(body)});
      msg($("actionMessage"), data.message || ok, "ok");
      await loadAll();
    } catch(e) {
      msg($("actionMessage"), e.message, "bad");
    }
  }

  window.RPC = {
    async changeStatus(id, status) {
      try {
        await api(`/orders/${id}/status`, {method:"PATCH", body:JSON.stringify({status})});
        await loadOrders();
      } catch(e) { alert(e.message); }
    },
    async assignOrder(id) {
      const workers = state.users.filter(u => ["worker","manager","owner"].includes(String(u.role||"").toLowerCase()));
      const label = workers.map((u,i)=>`${i+1}. ${u.name || u.username || u.email}`).join("\n");
      const num = prompt("Выбери номер рабочего:\n" + label);
      const worker = workers[Number(num)-1];
      if (!worker) return;
      try {
        await api(`/orders/${id}/assign`, {method:"PATCH", body:JSON.stringify({worker_id: worker.id})});
        await loadOrders();
      } catch(e) { alert(e.message); }
    },
    async approveUser(id, approved) {
      try { await api(`/users/${id}/approve`, {method:"PATCH", body:JSON.stringify({approved})}); await loadUsers(); }
      catch(e) { alert(e.message); }
    },
    async toggleUser(id, active) {
      try { await api(`/users/${id}/active`, {method:"PATCH", body:JSON.stringify({is_active: active})}); await loadUsers(); }
      catch(e) { alert(e.message); }
    },
    async setRole(id, role) {
      try { await api(`/users/${id}/role`, {method:"PATCH", body:JSON.stringify({role})}); await loadUsers(); }
      catch(e) { alert(e.message); }
    },
    async changeTaskStatus(id, status) {
      try { await api(`/tasks/${id}/status`, {method:"PATCH", body:JSON.stringify({status})}); await loadTasks(); }
      catch(e) { alert(e.message); }
    }
  };

  function initParticles() {
    const box = $("particles");
    for (let i=0;i<70;i++){
      const p = document.createElement("i");
      p.className = "particle";
      p.style.left = Math.random()*100 + "vw";
      p.style.top = (80 + Math.random()*40) + "vh";
      p.style.animationDuration = (5 + Math.random()*8) + "s";
      p.style.animationDelay = (-Math.random()*10) + "s";
      box.appendChild(p);
    }
  }

  function tickClock() {
    const d = new Date();
    $("clockText").textContent = d.toLocaleTimeString("ru-RU", {hour:"2-digit", minute:"2-digit"});
    $("dayLabel").textContent = d.toLocaleDateString("ru-RU", {weekday:"long", day:"2-digit", month:"long"});
  }

  function bind() {
    document.querySelectorAll("[data-auth-tab]").forEach(b => b.addEventListener("click", () => setAuthTab(b.dataset.authTab)));
    $("loginForm").addEventListener("submit", login);
    $("registerForm").addEventListener("submit", register);
    $("logoutBtn").addEventListener("click", () => { clearSession(); showAuth(); });
    $("refreshBtn").addEventListener("click", loadAll);
    $("hardRefreshBtn").addEventListener("click", () => location.reload());
    $("searchInput").addEventListener("input", renderOrders);
    $("statusFilter").addEventListener("change", renderOrders);
    $("loadUsersBtn").addEventListener("click", loadUsers);
    $("createOrderBtn").addEventListener("click", () => $("orderModal").showModal());
    $("createTaskBtn").addEventListener("click", () => $("taskModal").showModal());
    $("orderForm").addEventListener("submit", createOrder);
    $("taskForm").addEventListener("submit", createTask);
    $("telegramTestBtn").addEventListener("click", () => safePost("/admin/telegram/test", {}, "Telegram test sent"));
    $("syncOwnerBtn").addEventListener("click", () => safePost("/admin/sync-owner", {}, "Owner synced"));
    $("dbStatusBtn").addEventListener("click", async () => {
      msg($("actionMessage"), "Проверка базы...");
      try { const d = await api("/admin/database/status"); msg($("actionMessage"), JSON.stringify(d), "ok"); }
      catch(e) { msg($("actionMessage"), e.message, "bad"); }
    });
    $("copyApiBtn").addEventListener("click", async () => {
      await navigator.clipboard.writeText(API);
      msg($("actionMessage"), "API URL скопирован", "ok");
    });
    document.querySelectorAll(".nav-item").forEach(b => b.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      state.activeView = b.dataset.view;
    }));
    document.addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.key.toLowerCase() === "k") { e.preventDefault(); $("searchInput")?.focus(); }
    });
  }

  initParticles();
  bind();
  tickClock();
  setInterval(tickClock, 1000);
  if (state.token && state.user) showDashboard(); else showAuth();
  setInterval(() => { if (state.token) loadAll(); }, REFRESH_MS);
})();
