// Тексты src/events.js (060): создание, завершение, удаление, сброс, приглашения, раскрытие тайны, напоминания,
// объявления, параметры события
export default {
  'events.titleRule': 'Название события — от 1 до 80 символов.',
  // Создание (063): кто может и лимит; {limit} — предел за 12 месяцев, {date} — когда освободится место
  'events.createRight': 'Создавать события в этом боте может владелец бота и те, кому он разрешил.',
  'events.limit': 'За 12 месяцев можно создать не больше {limit} событий. Следующее — с {date}.',
  // Общая кнопка приложения под сообщением о событии (и в src/pairs.js)
  'events.openButton': '🎁 Открыть',
  // Завершение
  'events.alreadyFinished': 'Событие уже завершено.',
  'events.finished': '🏁 <b>Событие {title} завершено.</b> Спасибо за игру!\n\nПисьмо Санте теперь только для чтения. Переписка открыта ещё 7 дней (до {until}), потом останется для чтения. История события сохранится в приложении.',
  'events.finishedButton': '📚 Открыть',
  // Удаление и полный сброс
  'events.deleted': '🗑 Событие {title} удалено владельцем вместе с письмами и перепиской.',
  'events.alreadyDeleted': 'Событие уже удалено.',
  'events.reset': '🎄 Владелец начал событие {title} заново. Прежние данные удалены. Чтобы участвовать, попроси новую пригласительную ссылку.',
  'events.resetRace': 'Событие уже сброшено или изменилось одновременно со сбросом — обнови экран.',
  // Приглашение участников другого события
  'events.registrationClosed': 'Регистрация закрыта — открой её, чтобы приглашать.',
  'events.setupFirst': 'Сначала открой страницу настройки /setup (см. README).',
  'events.invite': '📨 <b>Приглашение на событие {title}</b> — Тайный Санта.\nНажми кнопку, чтобы участвовать.',
  'events.inviteButton': '🎄 Участвовать',
  'events.inviteAgain': 'Приглашения уже отправлены — повторить можно через минуту.',
  // Раскрытие тайны: {name} — имя Санты
  'events.alreadyRevealed': 'Тайна уже раскрыта.',
  'events.revealed': '🎅 <b>Тайна раскрыта!</b>\n\nВ событии {title} твой Тайный Санта — <b>{name}</b>. С праздником! 🎄',
  // Напоминания: пустое письмо (с дедлайном и без)
  'events.remindAgain': 'Напоминание уже отправлено — повторить можно через минуту.',
  'events.remindUnfilled': '⏰ Напоминание: твоё письмо Санте в событии {title} пока пустое. Заполни его, чтобы Санте было проще выбрать подарок.',
  'events.remindUnfilledBy': '⏰ Напоминание: твоё письмо Санте в событии {title} пока пустое. Заполни его до <b>{date}</b>, чтобы Санте было проще выбрать подарок.',
  // Объявления (007)
  'events.announceFinished': 'Событие завершено — объявления в нём уже не отправить.',
  'events.announceEmpty': 'Напиши текст объявления.',
  'events.announcement': '📣 <b>Объявление · {title}</b>\n\n{text}',
  'events.announcementButton': '📌 Открыть событие',
  'events.announceAgain': 'Это объявление уже отправлено.',
  // Параметры
  'events.ringAfterDraw': 'После жеребьёвки кольцевую жеребьёвку менять нельзя.',
  // Подробности журнала
  'events.auditText.fromTemplate': 'по образцу «{title}»',
  'events.auditText.deleted': '«{title}», участников: {n}',
  'events.auditText.reset': 'удалено участников: {n}',
  'events.auditText.invited': 'из «{title}», приглашено: {n}',
  'events.auditText.pairs': 'пар: {n}',
  'events.auditText.received': 'получили: {n}',
  'events.auditText.settings': 'параметры',
  'events.auditText.ring': 'кольцевая жеребьёвка: {state}',
  'events.auditText.avoidPrevious': 'не повторять прошлые пары: {state}',
  'events.auditText.on': 'вкл',
  'events.auditText.off': 'выкл',
  'events.auditText.registrationOpen': 'открыта',
  'events.auditText.registrationClosed': 'закрыта',
};
