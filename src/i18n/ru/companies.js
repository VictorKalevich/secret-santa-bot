// Подробности прежних записей журнала бота о комнатах (051–062; с 063 комнат нет, код их не пишет). Запись с
// details_tx показывается по этим ключам на языке смотрящего (AUDIT_HISTORY, src/db.js) — из словарей они не удаляются.
// {title} — название комнаты
export default {
  'companies.audit.byLink': 'по ссылке: {name}',
  'companies.audit.toBotOwner': '→ владелец бота',
  'companies.audit.ownerChanged': '«{title}»: {details}',
  'companies.audit.linkRevoked': '«{title}»: отозвана',
  'companies.audit.linkCreated': '«{title}»: создана',
  'companies.audit.roomDeleted': '«{title}», людей: {n}',
};
