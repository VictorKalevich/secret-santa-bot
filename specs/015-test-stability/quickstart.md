# Quickstart: проверка 015

```powershell
npm test                                                   # 5 раз подряд, лучше от батареи — 0 падений
node --test --test-name-pattern="^012" tests/e2e.test.mjs  # 2 раза подряд — «принудительная отмена» зелёная
npm run test:all                                           # перед слиянием в main
```

Ожидается: проверки времени жеребьёвки (`planDraw: 50 человек…`) проходят с прежним порогом 10 мс; в выводе e2e нет
«Не дождались: уведомления об отмене», в журнале Worker нет «Network connection lost» и `budget exceeded`.
