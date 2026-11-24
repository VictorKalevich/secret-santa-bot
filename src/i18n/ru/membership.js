// Тексты src/membership.js (060): вступление, заявки, семьи, «Я участвую», выход
export default {
  // Семьи (008): правила и заморозка состава при идущей жеребьёвке (009)
  'membership.familyNameRule': 'Название семьи — от 1 до 40 символов.',
  'membership.familySize': 'В семье должно быть от 2 до {max} человек.',
  'membership.familyNotFound': 'Семья не найдена.',
  'membership.memberNotFound': 'Участник не найден.',
  'membership.alreadyInFamily': '{name} уже в семье «{family}».',
  'membership.familyFrozen': 'Состав семьи нельзя менять, пока идёт событие «{title}» с проведённой жеребьёвкой: иначе по заменам участников можно было бы вычислить пары. Изменения — после его завершения.',
  // Журнал: семья — название и состав, «Я участвую»
  'membership.audit.familySave': '«{name}»: {people}',
  'membership.audit.familyDelete': '«{name}»',
  'membership.audit.isParticipant': 'участвует',
  'membership.audit.notParticipant': 'не участвует',
  'membership.afterDraw': 'После жеребьёвки так нельзя. Попроси {owner.gen} вписать тебя.',
  // Выход участника (035)
  'membership.leaveAfterDraw': 'Жеребьёвка уже прошла. Чтобы выйти, обратись к владельцу или администраторам.',
  'membership.leaveFinished': 'Событие завершено — выйти из него уже нельзя.',
  'membership.leaveNotice': '🚪 <b>{name}</b> выходит из события {title}.',
  'membership.openEventButton': '🛠 Открыть событие',
  // Возврат удалённых (010)
  'membership.notRemoved': 'Этого человека нет среди удалённых.',
  // Вступление и заявки (008)
  'membership.joinedNotice': '👋 <b>{name}</b> присоединяется к событию {title}',
  'membership.request': '🙋 <b>{name}</b> хочет участвовать в событии {title}.',
  'membership.requestWithUsername': '🙋 <b>{name}</b> (@{username}) хочет участвовать в событии {title}.',
  'membership.acceptButton': '✅ Принять',
  'membership.rejectButton': '❌ Отклонить',
  'membership.requestNotFound': 'Заявка не найдена.',
  'membership.requestDecided': 'Заявка уже рассмотрена.',
  'membership.approveFinished': 'Событие завершено — принять в него уже нельзя.',
  'membership.approveClosed': 'Регистрация на событие «{title}» закрыта — открой её, чтобы принять заявку.',
  // Решение по заявке: участнику и остальным администраторам
  'membership.approvedAfterDraw': '🎉 Заявка одобрена — ты в событии {title}! Жеребьёвка уже прошла — {owner.nom} впишет тебя, бот пришлёт уведомление. А пока напиши письмо Санте.',
  'membership.approved': '🎉 Заявка одобрена — ты в событии {title}! Открой приложение и напиши письмо своему Тайному Санте.',
  'membership.writeLetterButton': '✏️ Написать письмо',
  'membership.requestRejected': 'Заявку на участие в событии {title} отклонили. Если это ошибка, свяжись с владельцем или администратором.',
  'membership.approvedBy': '✅ <b>{by}</b> принял(а) заявку <b>{name}</b> на участие в событии {title}.',
  'membership.rejectedBy': '❌ <b>{by}</b> отклонил(а) заявку <b>{name}</b> на участие в событии {title}.',
};
