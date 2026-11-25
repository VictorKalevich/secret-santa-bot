// Тексты части приложения 04-settings (063): экран «Настройки» — профиль, язык, уведомления, «О боте» и раздел
// «Владелец бота» (все события, кто может создавать, журнал бота, передача прав)
export default {
  'app.settings.title': 'Настройки',
  // «Профиль» и шторка «Твоё имя» (035)
  'app.settings.profile.title': 'Профиль',
  'app.settings.profile.editName': '✏️ Изменить имя',
  'app.settings.name.title': 'Твоё имя',
  'app.settings.name.hint': 'Имя одно во всех событиях. Его видят владелец, администраторы и твой Санта, а при раскрытии — твой подопечный.',
  'app.settings.name.empty': 'Напиши имя',
  'app.settings.name.saved': 'Имя сохранено',
  // 061: язык бота и приложения; name — название языка на самом языке
  'app.settings.lang.button': '🌐 Язык',
  'app.settings.lang.auto': 'Как в Telegram ({name})',
  'app.settings.lang.hint': 'Бот и приложение будут на этом языке. «Как в Telegram» — язык твоего Telegram.',
  // Уведомления: режим и к каким сообщениям он относится
  'app.settings.notify.title': 'Уведомления',
  'app.settings.notify.sound': '🔔 Звук',
  'app.settings.notify.silent': '🔕 Тихо',
  'app.settings.notify.off': '🚫 Выкл',
  // Раздел владельца бота
  'app.settings.bot.title': 'Владелец бота',
  'app.settings.bot.events': '🗂 Все события',
  'app.settings.bot.creators': '✍️ Кто может создавать события',
  'app.settings.bot.log': '📜 Журнал бота',
  'app.settings.bot.pass': '👑 Передать права владельца бота',
  // «Все события»: новые первыми, по 50; {owner} — имя владельца события, {n} — участников
  'app.settings.events.title': 'Все события',
  'app.settings.events.about': 'Владелец — {owner} · участников: {n}',
  'app.settings.events.more': 'Показать ещё',
  'app.settings.events.empty': 'Событий пока нет.',
  // «Кто может создавать события» (закрытый бот)
  'app.settings.creators.title': 'Кто может создавать события',
  'app.settings.creators.hint': 'Создавать события можешь ты и те, кому ты разрешишь. Создавший событие становится его владельцем.',
  'app.settings.creators.empty': 'Других людей в боте пока нет.',
  'app.settings.creators.on': '«{name}» теперь может создавать события',
  'app.settings.creators.off': '«{name}» больше не может создавать события',
  // Передать права владельца бота
  'app.settings.pass.title': 'Права владельца бота',
  'app.settings.pass.hint': 'Владелец бота один: он видит все события и переносит участие на новый аккаунт. Твои события останутся за тобой.',
  'app.settings.pass.choose': 'Кому передать…',
  'app.settings.pass.empty': 'Передать права пока некому.',
  'app.settings.pass.confirm': 'Передать права владельца бота «{name}»? Твои события останутся за тобой, но чужие события и журнал бота ты больше не увидишь.',
  'app.settings.pass.done': '👑 Права владельца бота переданы',
};
