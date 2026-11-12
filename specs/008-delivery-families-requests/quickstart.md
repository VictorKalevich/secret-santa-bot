# Quickstart: проверка 008-delivery-families-requests

```powershell
npx wrangler d1 migrations apply DB --local   # схема 8
npm test
npm run test:e2e
npm run screenshots
```

| Сценарий (e2e) | Ожидание |
|---|---|
| `delivery_on`, участник сохраняет адрес | Санта видит `ward.delivery`; `admin.state`, `admin.wishlist`, `admin.audit` не содержат адреса; `has_delivery: true` |
| адрес выключен | `delivery.save` → 400; `ward.delivery` нет |
| новый эвент | адрес предзаполнен прошлым |
| подопечный меняет адрес | Санте «обновил письмо или адрес» после cron |
| семья {A, B}, 20 жеребьёвок | ни разу A→B или B→A; `families_on: false` — ограничение снято |
| семья делает жеребьёвку невозможной | `admin.draw.check` → причина со словом «семьи» |
| человек во второй семье | 400 «уже в семье» |
| перенос участника из семьи | новый аккаунт в семье |
| `approval`, новый человек по ссылке | заявка, не участник; админу кнопки |
| `req:<id>:a` в чате | участник, уведомление; повторное нажатие — «уже рассмотрена» |
| `admin.request.decide` reject | уведомление, не участник; повторная заявка возможна |
