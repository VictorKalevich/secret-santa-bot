// Тексты части приложения 02-core (060): ядро — поля, даты, календарь, кто может действие владельца, слова подтверждения
export default {
  // Подпись кнопки «×» поля ввода (дизайн-система, bindClearableInput)
  'app.core.clearField': 'Очистить поле «{label}»',
  // Даты: «25 ноября», «25 ноября 2026», время — по правилам языка (toLocaleTimeString)
  'app.core.locale': 'ru-RU',
  'app.core.date': '{day} {month}',
  'app.core.dateYear': '{date} {year}',
  'app.core.dateNone': 'Не выбрана',
  'app.core.monthsGen': ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
  'app.core.monthsNom': ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
  'app.core.weekdays': ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
  'app.core.todayAt': 'сегодня в {time}',
  'app.core.yesterdayAt': 'вчера в {time}',
  'app.core.dateAt': '{date} в {time}',
  // Свой календарь (027)
  'app.core.calendar.title': 'Дата',
  'app.core.calendar.month': '{month} {year}',
  'app.core.calendar.prev': 'Предыдущий месяц',
  'app.core.calendar.next': 'Следующий месяц',
  'app.core.calendar.done': 'Готово',
  'app.core.calendar.reset': 'Сбросить',
  'app.core.calendar.close': 'Закрыть',
  // Кто может действие владельца (ownerWord): в компании с назначенным владельцем и в компании владельца бота
  'app.core.owner.nom': 'владелец',
  'app.core.owner.gen': 'владельца',
  'app.core.owner.dat': 'владельцу',
  'app.core.owner.ins': 'владельцем',
  'app.core.owner.nomCap': 'Владелец',
  'app.core.botOwner.nom': 'владелец бота',
  'app.core.botOwner.gen': 'владельца бота',
  'app.core.botOwner.dat': 'владельцу бота',
  'app.core.botOwner.ins': 'владельцем бота',
  'app.core.botOwner.nomCap': 'Владелец бота',
  // Пересылка приглашения в чат (037)
  'app.core.shareInvite': '🎄 Играем в Тайного Санту — «{title}»! Заходи по ссылке:',
  // Слова подтверждения: их вводит человек, проверяют приложение и сервер
  'app.core.word.open': 'ОТКРЫТЬ',
  'app.core.word.leave': 'ВЫЙТИ',
  'app.core.word.delete': 'УДАЛИТЬ',
  'app.core.word.reset': 'СБРОС',
  'app.core.word.cancel': 'ОТМЕНА',
};
