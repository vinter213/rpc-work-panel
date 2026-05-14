RPC ADMIN PANEL — MAIN SITE STYLE
=================================

Структура архива:

RPC_ADMIN_PANEL_MAIN_SITE_STYLE/
├── index.html
├── style.css
├── app.js
├── config.js
├── rpc-avatar.png
└── README_RU.txt

Внутри папки нет других папок.

Что сделано:
- стиль админки переделан под основной RPC Order Website;
- тот же тёмный фон;
- красно-фиолетовый неон;
- большая hero-секция как на сайте;
- аватарка RPC с glow;
- карточки, кнопки, формы и панели в едином стиле;
- подключение к CRM API сохранено;
- логин через /auth/login;
- проверка сервера, базы, Telegram;
- заказы и работники с fallback demo-данными, если endpoint не отвечает.

Для Render Static Site:
Build Command:
echo no build

Publish Directory:
.

Настройка сервера:
Открой config.js и поменяй RPC_API_URL, если сервер другой.
