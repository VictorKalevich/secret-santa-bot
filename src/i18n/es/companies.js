// Spanish: texts of src/companies.js (rooms: creation, names, room owner, owner link, deletion).
export default {
  // Refusals
  'companies.ownLimit': 'Puedes gestionar como máximo dos salas propias: transfiere o elimina una de ellas.',
  'companies.recent': 'Se acaba de crear una sala con este nombre.',
  'companies.nameRule': 'El nombre de la sala debe tener entre 1 y 40 caracteres.',
  'companies.labelRule': 'El nombre puede tener hasta 40 caracteres.',
  'companies.hasEvents': 'La sala tiene eventos: elimínalos primero.',
  'companies.ownDelete': 'Solo su propietario puede eliminar la sala.',
  'companies.alreadyOwner': 'Ya es propietario(a).',
  // Room owner link (bot: /start own_<code>)
  'companies.ownerLinkGone': 'Este enlace de propietario ya se usó o fue revocado. Pide uno nuevo.',
  'companies.newOwner': '👑 Eres el propietario de tu sala en «Amigo Secreto»: creas eventos, invitas a gente y nombras administradores.',
  // Room without its own or shared name: its number among the person rooms
  'companies.numbered': 'Sala {n}',
  // Room owner change: {who}, {by} are names (HTML), {title} is the room name in quotes
  'companies.owner.transferred': '👑 <b>Te han transferido la propiedad de la sala.</b> Ahora nombras y quitas administradores, reinicias y eliminas eventos y abres la vista de supervisión, todo desde la app.',
  'companies.owner.returned': '👑 <b>{by}</b> te devolvió la sala {title}: vuelves a gestionarla tú.',
  'companies.owner.prevNext': 'ℹ️ Ahora la propiedad de la sala es de <b>{who}</b>. Sigues teniendo permisos de administrador.',
  'companies.owner.prevBot': 'ℹ️ La sala vuelve a gestionarla el propietario del bot. Sigues teniendo permisos de administrador.',
  'companies.owner.byLink': '👑 Nuevo propietario de la sala {title}: <b>{who}</b>.',
  'companies.owner.byLinkUsername': '👑 Nuevo propietario de la sala {title}: <b>{who}</b> (@{username}).',
  'companies.owner.passed': 'ℹ️ <b>{by}</b> transfirió la propiedad de la sala {title}: ahora el propietario es <b>{who}</b>.',
  'companies.owner.notice': 'ℹ️ Nuevo propietario: <b>{who}</b>.',
  // Deleting an empty room: by the room owner (open bot) and by the bot owner
  'companies.deleted.byOwner': 'El propietario eliminó una sala en la que tenías permisos de administrador: no tenía eventos.',
  'companies.deleted.yours': 'El propietario del bot eliminó la sala que gestionabas: no tenía eventos.',
  'companies.deleted.admin': 'El propietario del bot eliminó una sala en la que tenías permisos de administrador: no tenía eventos.',
  // Activity log: {title} is the room name
  'companies.audit.byLink': 'por enlace: {name}',
  'companies.audit.toBotOwner': '→ propietario del bot',
  'companies.audit.ownerChanged': '«{title}»: {details}',
  'companies.audit.linkRevoked': '«{title}»: revocado',
  'companies.audit.linkCreated': '«{title}»: creado',
  'companies.audit.roomDeleted': '«{title}», personas: {n}',
};
