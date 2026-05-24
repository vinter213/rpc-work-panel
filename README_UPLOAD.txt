RPC OWNER / WORKER WEB PANEL — FLAT GITHUB FILES

Это файлы для репозитория rpc-admin-panel.
Папки создавать не надо. Просто закинь все файлы в корень GitHub.

Файлы:
- index.html
- style.css
- app.js
- config.js
- rpc-avatar.png

Что удалить/заменить в rpc-admin-panel:
- index.html
- style.css
- app.js
- config.js

Потом загрузи новые файлы из этого архива в корень репозитория.

ВАЖНО:
В config.js проверь backend:
window.RPC_CONFIG = {
  API_URL: "https://rpc-team-crm.onrender.com"
};

Если backend называется иначе — поменяй ссылку.

Backend должен иметь endpoints V3:
POST /auth/login
POST /auth/register
GET /orders
PATCH /orders/{id}/status
PATCH /orders/{id}/assign
GET /users
PATCH /users/{id}/approve
PATCH /users/{id}/active
PATCH /users/{id}/role
GET /tasks
POST /tasks
PATCH /tasks/{id}/status
POST /admin/telegram/test
GET /admin/database/status
POST /admin/sync-owner

Owner через Render Environment Variables:
RPC_OWNER_EMAILS=daniel134745@gmail.com
RPC_OWNER_USERNAMES=ViNter,vinter
RPC_AUTO_OWNER_PASSWORD=твой_пароль
RPC_DEFAULT_OWNER_NAME=ViNter
RPC_FIRST_USER_OWNER=false
