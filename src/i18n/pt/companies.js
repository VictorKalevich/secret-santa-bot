// Texts of src/companies.js (060): rooms — creation, names, room owner, owner link, deletion. Owner-rights refusals
// (target, "already the owner", "already transferred") are shared with roles.js, keys roles.*
export default {
  // Refusals
  'companies.ownLimit': 'Você pode gerenciar no máximo duas salas suas — transfira ou exclua uma delas.',
  'companies.recent': 'Uma sala com esse nome acabou de ser criada.',
  'companies.nameRule': 'O nome da sala deve ter de 1 a 40 caracteres.',
  'companies.labelRule': 'O nome deve ter até 40 caracteres.',
  'companies.hasEvents': 'A sala tem eventos — exclua-os primeiro.',
  'companies.ownDelete': 'Só o dono da sala pode excluí-la.',
  'companies.alreadyOwner': 'Já é o dono.',
  // Room owner link (bot: /start own_<code>)
  'companies.ownerLinkGone': 'Este link de dono já foi usado ou revogado. Peça um novo.',
  'companies.newOwner': '👑 Você é o dono da sua sala no “Amigo Secreto”: cria eventos, convida pessoas e nomeia administradores.',
  // Room without own or shared name — its number among the rooms of the person
  'companies.numbered': 'Sala {n}',
  // Room owner change: {who}, {by} — names (HTML), {title} — room name in quotes
  'companies.owner.transferred': '👑 <b>Você recebeu os direitos de dono da sala.</b> Agora você nomeia e remove administradores, zera e exclui eventos e abre a área restrita — tudo no app.',
  'companies.owner.returned': '👑 <b>{by}</b> passou a sala {title} para você: agora você volta a gerenciá-la.',
  'companies.owner.prevNext': 'ℹ️ Os direitos de dono da sala agora são de <b>{who}</b>. Você continua como administrador.',
  'companies.owner.prevBot': 'ℹ️ A sala voltou a ser gerenciada pelo dono do bot. Você continua como administrador.',
  'companies.owner.byLink': '👑 <b>{who}</b> agora é o dono da sala {title}.',
  'companies.owner.byLinkUsername': '👑 <b>{who}</b> (@{username}) agora é o dono da sala {title}.',
  'companies.owner.passed': 'ℹ️ <b>{by}</b> transferiu os direitos de dono da sala {title}: agora o dono é <b>{who}</b>.',
  'companies.owner.notice': 'ℹ️ <b>{who}</b> agora é o dono.',
  // Deletion of an empty room: by the room owner (open bot) and by the bot owner
  'companies.deleted.byOwner': 'O dono excluiu a sala em que você era administrador: não havia eventos nela.',
  'companies.deleted.yours': 'O dono do bot excluiu a sala que você gerenciava: não havia eventos nela.',
  'companies.deleted.admin': 'O dono do bot excluiu a sala em que você era administrador: não havia eventos nela.',
  // Log: {title} — room name
  'companies.audit.byLink': 'pelo link: {name}',
  'companies.audit.toBotOwner': '→ dono do bot',
  'companies.audit.ownerChanged': '“{title}”: {details}',
  'companies.audit.linkRevoked': '“{title}”: revogado',
  'companies.audit.linkCreated': '“{title}”: criado',
  'companies.audit.roomDeleted': '“{title}”, pessoas: {n}',
};
