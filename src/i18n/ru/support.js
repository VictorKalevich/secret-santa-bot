// Тексты src/support.js (060): обращения участника к организаторам (012). {name}, {author}, {to} — имена (HTML уже
// экранирован), {title} — название события в кавычках, {text} — текст сообщения.
export default {
  // Отказы
  'support.noRecipients': 'Сейчас некому ответить на обращение.',
  'support.closed': 'Обращение уже закрыто.',
  'support.notFound': 'Обращение не найдено.',
  'support.ownThread': 'Это твоё обращение — его может взять кто-то другой.',
  'support.empty': 'Пустое сообщение.',
  'support.sendFailed': 'Не получилось отправить — попробуй ещё раз.',
  'support.noOpen': 'Открытого обращения нет.',
  'support.hidden': 'Обращение ведёт {name} — переписку видят он(а) и владелец.',
  'support.alreadyTaken': 'Обращение уже взял(а) {name}.',
  'support.takeOwn': 'Своё обращение взять нельзя.',
  'support.ledBy': 'Обращение ведёт {name}.',
  'support.passRights': 'Передать обращение может тот, кто его ведёт, или владелец.',
  'support.passTarget': 'Передать можно владельцу или другому администратору.',
  'support.alreadyLed': 'Обращение и так ведёт {name}.',
  'support.passRace': 'Обращение изменилось одновременно с этим действием — обнови экран и попробуй ещё раз.',
  'support.closeRights': 'Закрыть обращение может тот, кто его ведёт, или владелец.',
  // Ответственный без имени (счётчики экрана события)
  'support.assigneeFallback': 'ответственный',
  // Кнопки под уведомлениями
  'support.replyButton': '↩️ Ответить',
  'support.openButton': '💬 Открыть',
  'support.takeButton': '🙋 Взять',
  // Кто ответил или закрыл — участнику ({role})
  'support.role.owner': 'Владелец',
  'support.role.admin': 'Администратор',
  // Уведомления организаторам
  'support.notice.opened': '🆘 <b>{name}</b> просит помощи в событии {title}:\n\n{text}',
  'support.notice.added': '💬 <b>{name}</b> дополняет обращение ({title}):\n\n{text}',
  'support.notice.writes': '💬 <b>{name}</b> пишет в обращении ({title}):\n\n{text}',
  'support.notice.closedByUser': '✅ <b>{name}</b> закрыл(а) обращение ({title}).',
  'support.notice.taken': '🙋 <b>{name}</b> взял(а) обращение <b>{author}</b> ({title}).',
  'support.notice.passedToYou': '↪️ <b>{name}</b> передал(а) тебе обращение <b>{author}</b> ({title}).',
  'support.notice.passed': '↪️ <b>{name}</b> передал(а) обращение <b>{author}</b> ({title}) — теперь его ведёт <b>{to}</b>.',
  'support.notice.closed': '✅ <b>{name}</b> закрыл(а) обращение <b>{author}</b> ({title}).',
  'support.notice.returned': '🔄 Обращение <b>{author}</b> ({title}) снова ничьё.',
  // Уведомления участнику
  'support.user.taken': '🙋 Твоё обращение в событии {title} взял(а) <b>{name}</b> — ответ придёт сюда.',
  'support.user.reply': '💬 {role} <b>{name}</b> отвечает ({title}):\n\n{text}',
  'support.user.passed': '↪️ Твоё обращение в событии {title} теперь ведёт <b>{name}</b>.',
  'support.user.closed': '✅ {role} <b>{name}</b> закрыл(а) твоё обращение в событии {title}. Если вопрос остался — просто напиши снова.',
  'support.user.returned': '🔄 Твоё обращение в событии {title} снова ждёт ответа.',
};
