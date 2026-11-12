# Quickstart: проверка 007-admin-tools

```powershell
npx wrangler d1 migrations apply DB --local   # схема 7
npm test
npm run test:e2e
npm run screenshots
```

| Сценарий (e2e) | Ожидание |
|---|---|
| `admin.announce` в эвент | сообщение каждому участнику; `event.get.announcements[0]` с текстом и автором; участник получает 403 на `admin.announce` |
| `draw_auto_date` = сегодня, cron | жеребьёвка проведена, журнал `draw.auto`; невозможная → админам «Автожеребьёвка … не прошла», дата снята |
| `event_date` = позавчера/4 дня назад (SQL) + `reveal_auto`/`finish_auto`, cron | раскрытие, затем завершение |
| `ward.received` | Санте одно «получил подарок»; в `admin.state` `gift_received: true`; повторная отметка — без второго уведомления |
| Санта не открыл подопечного | `ward_seen: false`; после `ward.get` — `true` |
| создание по образцу с `invite` | параметры и исключения скопированы, исключение действует после вступления обоих, приглашения разосланы |
| `admin.draw.cancel` до просмотров | пары удалены, письма на месте, уведомления; после `ward.get` хотя бы одного — 400 |
| `admin.audit` | записи по эвенту (`wishlist.view`, `draw`, …), общие (`role.grant`, `transfer`); участник — 403 |
| все новые ответы админа | не содержат `ward`/`santa`/пар |
