(() => {
  const cfg = window.RPC_CONFIG || {};
  const API = (cfg.API_URL || "https://rpc-team-crm.onrender.com").replace(/\/$/, "");
  const REFRESH_MS = cfg.REFRESH_MS || 5000;
  const $ = (id) => document.getElementById(id);

  const state = {
    token: localStorage.getItem("rpc_token") || "",
    user: JSON.parse(localStorage.getItem("rpc_user") || "null"),
    orders: [], users: [], tasks: [], clients: [], view: localStorage.getItem("rpc_view") || "dashboard",
    health: null
  };

  const titles = {
    dashboard:["OWNER / WORKER PANEL","Dashboard","Общий центр управления заказами, рабочими и задачами."],
    orders:["ORDER CONTROL","Orders","Все заявки с сайта, назначение рабочих и смена статуса."],
    workers:["TEAM CONTROL","Workers","Подтверждение, роли, активность и управление рабочими."],
    clients:["CLIENT BASE","Clients","Клиенты собраны из заказов и клиентского портала."],
    tasks:["TASK MANAGER","Tasks","Задачи для рабочих, статусы и контроль выполнения."],
    telegram:["NOTIFICATIONS","Telegram","Проверка уведомлений, базы и связи с сервером."],
    settings:["SYSTEM SETTINGS","Settings","Настройки профиля, API и выход из панели."]
  };

  function esc(v){return String(v ?? "").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));}
  function msg(el,text,type=""){if(!el)return; el.textContent=text||""; el.className="msg "+type;}
  function role(){return String(state.user?.role||"worker").toLowerCase();}
  function isOwner(){return role()==="owner";}
  function canManage(){return ["owner","manager"].includes(role());}

  async function api(path,opt={}){
    const headers={"Content-Type":"application/json",...(opt.headers||{})};
    if(state.token) headers.Authorization=`Bearer ${state.token}`;
    const res=await fetch(API+path,{...opt,headers});
    const text=await res.text(); let data=null;
    try{data=text?JSON.parse(text):null}catch{data={detail:text}}
    if(!res.ok){const d=data?.detail||data?.message||`HTTP ${res.status}`; throw new Error(Array.isArray(d)?d.map(x=>x.msg||JSON.stringify(x)).join(", "):d)}
    return data;
  }

  function saveSession(token,user){state.token=token;state.user=user;localStorage.setItem("rpc_token",token);localStorage.setItem("rpc_user",JSON.stringify(user));}
  function clearSession(){state.token="";state.user=null;localStorage.removeItem("rpc_token");localStorage.removeItem("rpc_user");}
  function applyRoleVisibility(){document.querySelectorAll(".owner-only").forEach(e=>e.style.display=isOwner()?"":"none");document.querySelectorAll(".owner-manager-only").forEach(e=>e.style.display=canManage()?"":"none");}

  function statusName(s){return ({new:"New",pending:"Pending",in_progress:"In progress",completed:"Completed",cancelled:"Cancelled"}[String(s||"new")]||s||"New");}
  function statusClass(s){s=String(s||""); if(s.includes("complete"))return "green"; if(s.includes("cancel")||s.includes("pending"))return "red"; return "";}
  function getOrderClient(o){return o.client_name||o.name||o.client||o.customer||"Client";}
  function getOrderBudget(o){return o.budget||o.price||o.amount||"—";}
  function getOrderWorker(o){return o.worker_name||o.assigned_worker_name||o.worker||o.assigned_to_name||"not assigned";}

  function setView(view){
    state.view=view; localStorage.setItem("rpc_view",view);
    document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
    const t=titles[view]||titles.dashboard; $("viewEyebrow").textContent=t[0]; $("viewTitle").textContent=t[1]; $("viewSubtitle").textContent=t[2];
    renderView();
  }

  function renderStats(){
    $("statOrders").textContent=state.orders.length;
    $("statWorkers").textContent=state.users.filter(u=>["worker","manager","owner"].includes(String(u.role||"").toLowerCase())).length;
    $("statTasks").textContent=state.tasks.length;
    $("statServer").textContent=state.health?"Online":"Offline";
    $("serverVersion").textContent=state.health?.version||"checking";
  }

  function orderCard(o){
    const id=o.id||o.order_id||"?";
    return `<div class="order">
      <div class="order-top"><div><div class="id">#RPC-${esc(id)}</div><b>${esc(o.service||o.title||"Order")}</b></div><span class="pill ${statusClass(o.status)}">• ${esc(statusName(o.status))}</span></div>
      <div class="muted">Client: ${esc(getOrderClient(o))}</div>
      <div class="muted">Contact: ${esc(o.contact||o.email||o.telegram||"—")}</div>
      <div class="row"><span>Budget: <b>${esc(getOrderBudget(o))}</b></span><span class="muted">Worker: ${esc(getOrderWorker(o))}</span></div>
      <div class="actions">
        ${canManage()?`<button class="mini" onclick="RPC.assignOrder('${id}')">Assign</button>`:""}
        <button class="mini" onclick="RPC.changeStatus('${id}','in_progress')">In progress</button>
        <button class="mini" onclick="RPC.changeStatus('${id}','completed')">Complete</button>
        <button class="mini" onclick="RPC.changeStatus('${id}','cancelled')">Cancel</button>
      </div>
    </div>`;
  }

  function workerCard(u){
    const id=u.id||u.user_id||""; const name=u.name||u.username||u.email||"Worker";
    return `<div class="worker"><img class="avatar-sm" src="rpc-avatar.png" alt=""><div>
      <div class="worker-top"><div><b>${esc(name)}</b><div class="muted">${esc(u.role||"worker")} • ${u.approved?"approved":"not approved"} • ${u.is_active===false?"disabled":"active"}</div></div><span class="pill green">Online</span></div>
      ${isOwner()?`<div class="actions">
        <button class="mini" onclick="RPC.approveUser('${id}',true)">Approve</button>
        <button class="mini" onclick="RPC.toggleUser('${id}',false)">Disable</button>
        <button class="mini" onclick="RPC.toggleUser('${id}',true)">Enable</button>
        <button class="mini" onclick="RPC.setRole('${id}','worker')">Worker</button>
        <button class="mini" onclick="RPC.setRole('${id}','manager')">Manager</button>
        <button class="mini" onclick="RPC.setRole('${id}','owner')">Owner</button>
      </div>`:""}
    </div></div>`;
  }

  function taskCard(t){
    const id=t.id||t.task_id||"";
    return `<div class="task"><div class="order-top"><b>${esc(t.title||"Task")}</b><span class="pill ${statusClass(t.status)}">${esc(statusName(t.status))}</span></div>
      <p class="muted">${esc(t.description||"Без описания")}</p>
      <div class="actions"><button class="mini" onclick="RPC.changeTaskStatus('${id}','in_progress')">In progress</button><button class="mini" onclick="RPC.changeTaskStatus('${id}','completed')">Complete</button></div>
    </div>`;
  }

  function clientsFromOrders(){
    const map=new Map(); state.orders.forEach(o=>{const key=(getOrderClient(o)+"|"+(o.contact||"")).toLowerCase(); if(!map.has(key))map.set(key,{name:getOrderClient(o),contact:o.contact||o.email||"—",orders:0,total:0}); const c=map.get(key); c.orders++; const n=parseFloat(String(getOrderBudget(o)).replace(/[^0-9.]/g,"")); if(!Number.isNaN(n))c.total+=n;}); return [...map.values()];
  }

  function renderDashboard(){
    return `<section class="grid-3">
      <article class="panel glass"><div class="head"><h2>Recent Orders</h2><button class="mini" onclick="RPC.goto('orders')">View all</button></div>${state.orders.slice(0,4).map(orderCard).join("")||`<div class="empty">Заказов пока нет.</div>`}</article>
      <article class="panel glass"><div class="head"><h2>Workers Status</h2><button class="mini" onclick="RPC.goto('workers')">View all</button></div>${state.users.slice(0,4).map(workerCard).join("")||`<div class="empty">Рабочих пока нет.</div>`}</article>
      <article class="panel glass"><div class="head"><h2>Quick Actions</h2></div><div class="quick-grid">
        <button class="quick owner-manager-only" onclick="document.getElementById('orderModal').showModal()"><b>▣</b>Create Order</button>
        <button class="quick owner-manager-only" onclick="document.getElementById('taskModal').showModal()"><b>☑</b>New Task</button>
        <button class="quick owner-only" onclick="RPC.telegramTest()"><b>✈</b>Telegram Test</button>
        <button class="quick" onclick="RPC.goto('settings')"><b>⚙</b>Settings</button>
      </div><div id="actionMessage" class="msg"></div></article>
      <article class="panel glass full"><div class="head"><h2>Activity Timeline</h2></div>${state.orders.slice(0,5).map(o=>`<div class="timeline-item"><b>New/updated order #RPC-${esc(o.id||o.order_id)}</b><div class="muted">${esc(getOrderClient(o))} • ${esc(statusName(o.status))}</div></div>`).join("")||`<div class="empty">Активности пока нет.</div>`}</article>
    </section>`;
  }

  function renderOrders(){return `<section class="panel glass full"><div class="head"><h2>Orders</h2><div class="row"><select id="statusFilter"><option value="">All statuses</option><option value="new">New</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select><button class="mini owner-manager-only" onclick="document.getElementById('orderModal').showModal()">+ Order</button></div></div><div id="ordersBox"></div></section>`;}
  function fillOrders(){const q=($("searchInput")?.value||"").toLowerCase(); const f=$("statusFilter")?.value||""; const list=state.orders.filter(o=>(!f||String(o.status||"")===f)&&JSON.stringify(o).toLowerCase().includes(q)); const box=$("ordersBox"); if(box)box.innerHTML=list.map(orderCard).join("")||`<div class="empty">Ничего не найдено.</div>`;}
  function renderWorkers(){return `<section class="panel glass full"><div class="head"><h2>Workers</h2><button class="mini owner-manager-only" onclick="RPC.reload()">Reload</button></div>${state.users.map(workerCard).join("")||`<div class="empty">Рабочих пока нет или у тебя нет прав видеть список.</div>`}</section>`;}
  function renderClients(){const clients=state.clients.length?state.clients:clientsFromOrders(); return `<section class="grid-2"><article class="panel glass full"><div class="head"><h2>Clients</h2><span class="pill">${clients.length} clients</span></div>${clients.map(c=>`<div class="client"><b>${esc(c.name||c.email||"Client")}</b><div class="muted">${esc(c.contact||c.email||"—")}</div><div>Orders: <b>${esc(c.orders||0)}</b> ${c.total?`• Total: <b>${esc(c.total)}</b>`:""}</div></div>`).join("")||`<div class="empty">Клиенты появятся после заказов.</div>`}</article></section>`;}
  function renderTasks(){return `<section class="panel glass full"><div class="head"><h2>Tasks</h2><button class="mini owner-manager-only" onclick="document.getElementById('taskModal').showModal()">+ Task</button></div>${state.tasks.map(taskCard).join("")||`<div class="empty">Задач пока нет.</div>`}</section>`;}
  function renderTelegram(){return `<section class="grid-2"><article class="panel glass"><div class="head"><h2>Telegram</h2></div><p class="muted">Проверка уведомлений бота.</p><button class="primary owner-only" onclick="RPC.telegramTest()">✈ Send test notification</button><div id="actionMessage" class="msg"></div></article><article class="panel glass"><div class="head"><h2>Database</h2></div><p class="muted">Проверка базы и API.</p><button class="primary owner-only" onclick="RPC.dbStatus()">◉ Check database</button><div id="dbMessage" class="msg"></div></article></section>`;}
  function renderSettings(){return `<section class="grid-2"><article class="panel glass"><div class="head"><h2>Account</h2></div><div class="settings-list"><div class="kv"><span>Name</span><b>${esc(state.user?.name||state.user?.username)}</b></div><div class="kv"><span>Role</span><b>${esc(state.user?.role)}</b></div><div class="kv"><span>Email</span><b>${esc(state.user?.email||"—")}</b></div><div class="kv"><span>API</span><b>${esc(API)}</b></div></div><div class="actions"><button class="mini" onclick="navigator.clipboard.writeText('${API}')">Copy API</button><button class="mini" onclick="RPC.logout()">Logout</button></div></article><article class="panel glass"><div class="head"><h2>Owner Sync</h2></div><p class="muted">Берёт Owner из Environment Variables backend-а.</p><button class="primary owner-only" onclick="RPC.syncOwner()">♛ Sync Owner</button><div id="actionMessage" class="msg"></div></article></section>`;}

  function renderView(){
    const root=$("viewRoot");
    root.innerHTML={dashboard:renderDashboard,orders:renderOrders,workers:renderWorkers,clients:renderClients,tasks:renderTasks,telegram:renderTelegram,settings:renderSettings}[state.view]?.()||renderDashboard();
    applyRoleVisibility(); renderStats(); if(state.view==="orders") { const sf=$("statusFilter"); if(sf)sf.addEventListener("change",fillOrders); fillOrders(); }
  }

  async function loadHealth(){try{state.health=await api("/");$("systemStatus").textContent="All Systems Operational";}catch(e){state.health=null;$("systemStatus").textContent="Server offline";} renderStats();}
  async function loadOrders(){try{state.orders=await api("/orders");}catch(e){state.orders=[];console.warn(e)} renderStats(); if(["dashboard","orders","clients"].includes(state.view))renderView();}
  async function loadUsers(){if(!canManage()){state.users=[];renderStats();return} try{state.users=await api("/users");}catch(e){state.users=[];console.warn(e)} fillTaskAssignee(); renderStats(); if(["dashboard","workers"].includes(state.view))renderView();}
  async function loadTasks(){try{state.tasks=await api("/tasks");}catch(e){state.tasks=[];console.warn(e)} renderStats(); if(["dashboard","tasks"].includes(state.view))renderView();}
  async function loadClients(){try{state.clients=await api("/clients");}catch(e){state.clients=[];} if(state.view==="clients")renderView();}
  async function loadAll(){if(!state.token)return; await Promise.all([loadHealth(),loadOrders(),loadUsers(),loadTasks(),loadClients()]);}

  function fillTaskAssignee(){const s=$("taskAssignee"); if(!s)return; const workers=state.users.filter(u=>["worker","manager","owner"].includes(String(u.role||"").toLowerCase())); s.innerHTML=`<option value="">Без назначения</option>`+workers.map(u=>`<option value="${esc(u.id)}">${esc(u.name||u.username||u.email)}</option>`).join("");}

  async function login(e){e.preventDefault(); msg($("authMsg"),"Вход..."); try{const data=await api("/auth/login",{method:"POST",body:JSON.stringify({username:$("loginUsername").value.trim(),password:$("loginPassword").value})}); saveSession(data.access_token||data.token,data.user||data); showApp();}catch(err){msg($("authMsg"),err.message,"err");}}
  async function register(e){e.preventDefault(); msg($("authMsg"),"Создаю аккаунт..."); try{const data=await api("/auth/register",{method:"POST",body:JSON.stringify({name:$("regName").value.trim(),username:$("regUsername").value.trim(),email:$("regEmail").value.trim(),password:$("regPassword").value,role:"worker"})}); msg($("authMsg"),data.message||"Аккаунт создан. Жди подтверждения Owner.","ok"); setAuthTab("login");}catch(err){msg($("authMsg"),err.message,"err");}}
  async function createOrder(e){e.preventDefault(); try{await api("/public/order",{method:"POST",body:JSON.stringify({client_name:$("orderClientName").value,contact:$("orderContact").value,service:$("orderService").value,budget:$("orderBudget").value,price:$("orderBudget").value,description:$("orderDescription").value})}); $("orderModal").close();$("orderForm").reset();await loadOrders();}catch(err){alert(err.message)}}
  async function createTask(e){e.preventDefault(); try{await api("/tasks",{method:"POST",body:JSON.stringify({title:$("taskTitle").value,description:$("taskDescription").value,assigned_to:$("taskAssignee").value||null})}); $("taskModal").close();$("taskForm").reset();await loadTasks();}catch(err){alert(err.message)}}

  function showApp(){ $("authScreen").classList.add("hidden"); $("appScreen").classList.remove("hidden"); $("profileName").textContent=state.user?.name||state.user?.username||"RPC User"; $("profileRole").textContent=`${state.user?.role||"worker"} • Online`; titles.dashboard[1]=`Welcome back, ${state.user?.name||state.user?.username||"RPC User"} 👋`; applyRoleVisibility(); setView(state.view); loadAll(); }
  function showAuth(){ $("authScreen").classList.remove("hidden"); $("appScreen").classList.add("hidden"); }
  function setAuthTab(tab){document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.auth===tab)); $("loginForm").classList.toggle("hidden",tab!=="login"); $("registerForm").classList.toggle("hidden",tab!=="register");}
  function tick(){const d=new Date();$("clockText").textContent=d.toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"});$("dayLabel").textContent=d.toLocaleDateString("ru-RU",{weekday:"long",day:"2-digit",month:"long"});}

  window.RPC={
    goto:setView, reload:loadAll, logout(){clearSession();showAuth();},
    async changeStatus(id,status){try{await api(`/orders/${id}/status`,{method:"PATCH",body:JSON.stringify({status})});await loadOrders();}catch(e){alert(e.message)}},
    async assignOrder(id){if(!state.users.length)await loadUsers(); const workers=state.users.filter(u=>["worker","manager","owner"].includes(String(u.role||"").toLowerCase())); const num=prompt("Выбери номер рабочего:\n"+workers.map((u,i)=>`${i+1}. ${u.name||u.username||u.email}`).join("\n")); const w=workers[Number(num)-1]; if(!w)return; try{await api(`/orders/${id}/assign`,{method:"PATCH",body:JSON.stringify({worker_id:w.id})});await loadOrders();}catch(e){alert(e.message)}},
    async approveUser(id,approved){try{await api(`/users/${id}/approve`,{method:"PATCH",body:JSON.stringify({approved})});await loadUsers();}catch(e){alert(e.message)}},
    async toggleUser(id,is_active){try{await api(`/users/${id}/active`,{method:"PATCH",body:JSON.stringify({is_active})});await loadUsers();}catch(e){alert(e.message)}},
    async setRole(id,role){try{await api(`/users/${id}/role`,{method:"PATCH",body:JSON.stringify({role})});await loadUsers();}catch(e){alert(e.message)}},
    async changeTaskStatus(id,status){try{await api(`/tasks/${id}/status`,{method:"PATCH",body:JSON.stringify({status})});await loadTasks();}catch(e){alert(e.message)}},
    async telegramTest(){const el=$("actionMessage"); msg(el,"Отправляю..."); try{const d=await api("/admin/telegram/test",{method:"POST",body:JSON.stringify({})}); msg(el,d.message||"Telegram работает","ok");}catch(e){msg(el,e.message,"err")}},
    async dbStatus(){const el=$("dbMessage"); msg(el,"Проверяю..."); try{const d=await api("/admin/database/status"); msg(el,JSON.stringify(d),"ok");}catch(e){msg(el,e.message,"err")}},
    async syncOwner(){const el=$("actionMessage"); msg(el,"Синхронизирую Owner..."); try{const d=await api("/admin/sync-owner",{method:"POST",body:JSON.stringify({})}); msg(el,d.message||"Owner synced","ok"); await loadUsers();}catch(e){msg(el,e.message,"err")}}
  };

  function bind(){
    document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>setAuthTab(b.dataset.auth)));
    document.querySelectorAll(".nav-item").forEach(b=>b.addEventListener("click",()=>setView(b.dataset.view)));
    $("loginForm").addEventListener("submit",login); $("registerForm").addEventListener("submit",register);
    $("logoutBtn").addEventListener("click",()=>RPC.logout()); $("refreshBtn").addEventListener("click",loadAll); $("syncOwnerBtn").addEventListener("click",()=>RPC.syncOwner());
    $("orderForm").addEventListener("submit",createOrder); $("taskForm").addEventListener("submit",createTask);
    $("searchInput").addEventListener("input",()=>{if(state.view==="orders")fillOrders();});
    document.addEventListener("keydown",e=>{if(e.ctrlKey&&e.key.toLowerCase()==="k"){e.preventDefault();$("searchInput")?.focus();}});
  }

  document.addEventListener("DOMContentLoaded",()=>{bind();tick();setInterval(tick,1000); if(state.token&&state.user)showApp(); else showAuth(); setInterval(()=>{if(state.token)loadAll();},REFRESH_MS);});
})();
