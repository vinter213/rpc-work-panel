RPC OWNER/WORKER WEB PANEL - NAV FIX

Это плоский комплект файлов для GitHub. Папок внутри нет.

Что исправлено:
- боковое меню теперь реально переключает разделы;
- Dashboard, Orders, Workers, Clients, Tasks, Telegram, Settings — отдельные экраны;
- поиск работает в Orders;
- кнопки View all открывают нужные разделы;
- Telegram/Database/Sync Owner вынесены в рабочие разделы;
- дизайн оставлен в неоновом RPC стиле;
- аватарка rpc-avatar.png подключена в интерфейс.

Куда заливать:
Репозиторий rpc-admin-panel, прямо в корень.

Заменить файлы:
index.html
style.css
app.js
config.js
rpc-avatar.png

После загрузки:
1. Сделай deploy rpc-admin-panel.
2. Открой сайт.
3. Нажми слева Orders / Workers / Tasks / Telegram / Settings.
Теперь они должны переключать экраны, а не быть затычками.
